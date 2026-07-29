import type { ProveedorDeEmision } from '../proveedor/interfaz.ts'
import type { AlmacenDeEmision, Comprobante } from './almacen.ts'
import { idDeSerie } from './almacen.ts'
import {
  estadoSegunProveedor,
  exigeVerificacion,
  transicionPermitida,
  ventaEstaCerrada,
} from './estados.ts'

/**
 * `reconciliarEmisiones`.
 *
 * ## Por qué esta tarea es obligatoria y no una mejora
 *
 * Prohibir el reintento a ciegas deja las ventas indeterminadas sin salida. Esta
 * tarea es la contrapartida: sin ella, la prohibición del principio II
 * convertiría cada respuesta ausente en una venta abandonada, y el vendedor
 * acabaría emitiendo a mano un segundo comprobante, que es justo lo que la
 * prohibición quería evitar.
 *
 * ## Nunca emite
 *
 * Es la restricción que la hace segura. Solo pregunta y adopta lo que encuentra.
 * Si pudiera emitir, sería un segundo camino por el que nace un comprobante, y el
 * contrato dice que solo hay uno.
 *
 * La única acción que se le parece —volver a intentar una venta cuyo documento
 * consta que **no existe**— se delega en `procesarPendientes` moviendo el
 * comprobante a `pendiente`. Así el camino de emisión sigue siendo único.
 */

export interface ResumenDeReconciliacion {
  readonly revisados: number
  readonly resueltos: number
  readonly sinDocumento: number
  readonly requierenIntervencion: number
  readonly noSePudoConsultar: number
}

export interface ContextoDeReconciliacion {
  readonly almacen: AlmacenDeEmision
  readonly proveedor: ProveedorDeEmision
  readonly limite?: number
  readonly ahora?: () => Date
}

const LIMITE_POR_OMISION = 50

export async function reconciliarEmisiones(
  contexto: ContextoDeReconciliacion,
): Promise<ResumenDeReconciliacion> {
  const ahora = (contexto.ahora ?? (() => new Date()))()
  const limite = contexto.limite ?? LIMITE_POR_OMISION

  const indeterminados = await contexto.almacen.comprobantesEnEstado(
    'indeterminado',
    limite,
  )

  // Los `reclamado` envejecidos entran en el mismo barrido. Son el proceso que
  // murió entre la llamada al proveedor y la escritura del resultado: no se puede
  // saber de qué lado murió, así que se pregunta. Sin esto, esas ventas se
  // quedarían invisibles para siempre en un estado que parece transitorio.
  const reclamados = await contexto.almacen.comprobantesEnEstado(
    'reclamado',
    limite,
  )
  const atascados = reclamados.filter((cada) =>
    exigeVerificacion(cada.estado, cada.emitidoEn, ahora),
  )

  const aRevisar = [...indeterminados, ...atascados]

  let resueltos = 0
  let sinDocumento = 0
  let requierenIntervencion = 0
  let noSePudoConsultar = 0

  for (const comprobante of aRevisar) {
    const desenlace = await reconciliarUno(contexto, comprobante)
    if (desenlace === 'resuelto') resueltos++
    else if (desenlace === 'sin_documento') sinDocumento++
    else if (desenlace === 'intervencion') requierenIntervencion++
    else noSePudoConsultar++
  }

  return {
    revisados: aRevisar.length,
    resueltos,
    sinDocumento,
    requierenIntervencion,
    noSePudoConsultar,
  }
}

type Desenlace = 'resuelto' | 'sin_documento' | 'intervencion' | 'no_consultable'

async function reconciliarUno(
  contexto: ContextoDeReconciliacion,
  comprobante: Comprobante,
): Promise<Desenlace> {
  const ahora = (contexto.ahora ?? (() => new Date()))()

  if (comprobante.numero === null || comprobante.serie === '') {
    // Sin par de serie y número no hay nada que consultar. Pasa a intervención
    // en lugar de quedarse dando vueltas en cada barrido.
    await moverAIntervencion(contexto, comprobante, 'sin_serie_ni_numero', ahora)
    return 'intervencion'
  }

  const consulta = await contexto.proveedor.consultarDocumento({
    tipoDocumento: comprobante.tipoDocumento,
    serie: comprobante.serie,
    numero: comprobante.numero,
  })

  if (!consulta.ok) {
    // Una consulta que falla NO significa que el documento no exista. Se deja
    // como estaba para el siguiente barrido: es el error más caro que se podría
    // cometer aquí, porque daría la venta por no emitida y habilitaría un
    // reintento sobre un documento que puede existir.
    await contexto.almacen.actualizarComprobante(comprobante.id, {
      nuevoIntento: {
        momento: ahora,
        resultado: consulta.fallo.clase,
        razon: `consulta_fallida_${consulta.fallo.razon}`,
        rastro: consulta.fallo.rastro,
      },
    })
    return 'no_consultable'
  }

  const documento = consulta.valor

  if (!documento.existe) {
    // Ahora sí consta que no se emitió. La venta puede volver a intentarse, y se
    // encamina por `pendiente` para que lo haga `procesarPendientes`: así el
    // camino de emisión sigue siendo único.
    if (transicionPermitida(comprobante.estado, 'pendiente')) {
      await contexto.almacen.actualizarComprobante(comprobante.id, {
        estado: 'pendiente',
        nuevoIntento: {
          momento: ahora,
          resultado: 'exito',
          razon: 'reconciliado_documento_inexistente',
          rastro: documento.rastro,
        },
      })
    }
    return 'sin_documento'
  }

  if (documento.estado === undefined) {
    // El documento está ahí pero su estado no se entiende. Adivinar aquí sería
    // dar una venta por buena sin serlo.
    await moverAIntervencion(
      contexto,
      comprobante,
      'estado_no_reconocible',
      ahora,
    )
    return 'intervencion'
  }

  // El documento existe y no es nuestro: mismo número, otra venta. Ocurriría si
  // el proveedor no hubiera respetado el número explícito. Es exactamente lo que
  // T027 tiene que descartar, y hasta entonces hay que detectarlo.
  if (!pareceElNuestro(comprobante, documento.total)) {
    await moverAIntervencion(
      contexto,
      comprobante,
      'documento_ajeno_en_ese_numero',
      ahora,
    )
    return 'intervencion'
  }

  const estado = estadoSegunProveedor(documento.estado)
  if (!transicionPermitida(comprobante.estado, estado)) {
    await moverAIntervencion(
      contexto,
      comprobante,
      `transicion_no_permitida_${comprobante.estado}_a_${estado}`,
      ahora,
    )
    return 'intervencion'
  }

  await contexto.almacen.actualizarComprobante(comprobante.id, {
    estado,
    proveedor: {
      nombre: contexto.proveedor.nombre,
      referenciaExterna: comprobante.proveedor?.referenciaExterna ?? null,
      estadoInformado: documento.estado,
      pdf: documento.archivos.pdf ?? null,
      xml: documento.archivos.xml ?? null,
      cdr: documento.archivos.cdr ?? null,
    },
    nuevoIntento: {
      momento: ahora,
      resultado: 'exito',
      razon: `reconciliado_a_${estado}`,
      rastro: documento.rastro,
    },
  })

  if (ventaEstaCerrada(estado) && comprobante.serie !== '') {
    await contexto.almacen.confirmarCorrelativo(
      idDeSerie(comprobante.vendedorId, comprobante.tipoDocumento),
      comprobante.numero,
    )
  }

  return 'resuelto'
}

/**
 * Si el documento que el proveedor tiene en ese número es el de esta venta.
 *
 * Se compara el total, que es lo único que distingue de forma barata dos ventas
 * con el mismo número. Ante la duda se responde que no, porque adoptar un
 * documento ajeno sería peor que mandar la venta a revisión.
 */
function pareceElNuestro(
  comprobante: Comprobante,
  totalDelProveedor: number | undefined,
): boolean {
  if (totalDelProveedor === undefined) return true
  return totalDelProveedor === comprobante.total
}

async function moverAIntervencion(
  contexto: ContextoDeReconciliacion,
  comprobante: Comprobante,
  razon: string,
  ahora: Date,
): Promise<void> {
  const puede = transicionPermitida(comprobante.estado, 'requiere_intervencion')
  await contexto.almacen.actualizarComprobante(comprobante.id, {
    ...(puede ? { estado: 'requiere_intervencion' as const } : {}),
    nuevoIntento: {
      momento: ahora,
      resultado: 'indeterminado',
      razon,
      rastro: null,
    },
  })
}
