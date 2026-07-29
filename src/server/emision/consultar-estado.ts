import { fallar } from '../errores.ts'
import type { ProveedorDeEmision } from '../proveedor/interfaz.ts'
import type { AlmacenDeEmision, Comprobante } from './almacen.ts'
import { idDeSerie } from './almacen.ts'
import {
  estadoSegunProveedor,
  sePuedeInvocarEmision,
  transicionPermitida,
  ventaEstaCerrada,
} from './estados.ts'

/**
 * Consulta bajo demanda el estado de un comprobante ante el proveedor
 * (decisión 10). Sustituye la reconciliación programada.
 *
 * **Nunca emite.** Solo pregunta y adopta lo que encuentra.
 * Si el documento no existe, deja el comprobante en `pendiente` para que el
 * vendedor pueda reintentar la emisión a mano con la misma clave.
 */

export type DesenlaceDeConsulta =
  | 'resuelto'
  | 'sin_documento'
  | 'intervencion'
  | 'no_consultable'
  | 'ya_cerrado'
  | 'no_aplica'

export interface ResultadoDeConsultaDeEstado {
  readonly desenlace: DesenlaceDeConsulta
  readonly comprobante: Comprobante
}

export interface ContextoDeConsulta {
  readonly almacen: AlmacenDeEmision
  readonly proveedor: ProveedorDeEmision
  readonly ahora?: () => Date
}

export async function consultarEstadoEmision(
  contexto: ContextoDeConsulta,
  comprobanteId: string,
): Promise<ResultadoDeConsultaDeEstado> {
  const leido = await contexto.almacen.leerComprobante(comprobanteId)
  if (leido === undefined) {
    fallar('comprobante_no_encontrado')
  }

  if (ventaEstaCerrada(leido.estado) || leido.estado === 'rechazado') {
    return { desenlace: 'ya_cerrado', comprobante: leido }
  }

  if (sePuedeInvocarEmision(leido.estado) && leido.estado === 'pendiente') {
    // Ya consta que no hay documento: no hace falta consultar; el vendedor puede
    // reintentar emitir.
    return { desenlace: 'sin_documento', comprobante: leido }
  }

  if (
    leido.estado !== 'indeterminado' &&
    leido.estado !== 'reclamado' &&
    leido.estado !== 'requiere_intervencion'
  ) {
    return { desenlace: 'no_aplica', comprobante: leido }
  }

  const desenlace = await consultarUno(contexto, leido)
  const actualizado =
    (await contexto.almacen.leerComprobante(comprobanteId)) ?? leido
  return { desenlace, comprobante: actualizado }
}

async function consultarUno(
  contexto: ContextoDeConsulta,
  comprobante: Comprobante,
): Promise<DesenlaceDeConsulta> {
  const ahora = (contexto.ahora ?? (() => new Date()))()

  if (comprobante.numero === null || comprobante.serie === '') {
    await moverAIntervencion(contexto, comprobante, 'sin_serie_ni_numero', ahora)
    return 'intervencion'
  }

  const consulta = await contexto.proveedor.consultarDocumento({
    tipoDocumento: comprobante.tipoDocumento,
    serie: comprobante.serie,
    numero: comprobante.numero,
  })

  if (!consulta.ok) {
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
    if (transicionPermitida(comprobante.estado, 'pendiente')) {
      await contexto.almacen.actualizarComprobante(comprobante.id, {
        estado: 'pendiente',
        nuevoIntento: {
          momento: ahora,
          resultado: 'exito',
          razon: 'consulta_documento_inexistente',
          rastro: documento.rastro,
        },
      })
    }
    return 'sin_documento'
  }

  if (documento.estado === undefined) {
    await moverAIntervencion(
      contexto,
      comprobante,
      'estado_no_reconocible',
      ahora,
    )
    return 'intervencion'
  }

  if (
    documento.total !== undefined &&
    documento.total !== comprobante.total
  ) {
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
      razon: `consulta_adopto_${estado}`,
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

async function moverAIntervencion(
  contexto: ContextoDeConsulta,
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
