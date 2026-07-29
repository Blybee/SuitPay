import {
  exito,
  propagarFallo,
  fallo
  
  
  
  
} from '../interfaz.ts'
import type {DocumentoEmitido, LineaParaEmitir, PeticionDeEmision, Resultado} from '../interfaz.ts';
import { traducirEstado } from './estados.ts'
import {
  pedirAlProveedor
  
} from './transporte.ts'
import type {ConfiguracionDelProveedor} from './transporte.ts';

/**
 * La emisión contra el proveedor.
 *
 * ## El comodín de numeración y por qué no lo usamos
 *
 * Su documentación pasa `"numero": "#"` como marcador de asignación automática.
 * SuitPay **no lo usa**: envía el número que ya reclamó en su transacción. Que
 * exista un comodín explícito para "asígnalo tú" implica que el campo admite un
 * valor concreto, porque de otro modo el comodín no tendría sentido.
 *
 * La diferencia importa mucho para la reconciliación. Con número explícito, ante
 * una respuesta ausente basta una consulta por serie y número: respuesta binaria,
 * sin heurística. Sin él, habría que sondear los números siguientes al último
 * confirmado comparando cliente, total y fecha, que funciona pero es notablemente
 * peor.
 *
 * **PENDIENTE DE T027**: que el proveedor respete el número explícito está
 * deducido, no comprobado. Si resultara que no lo respeta, `numero` pasaría a `'#'`
 * y la reconciliación tendría que usar su camino de sondeo. El código está escrito
 * para que ese cambio sea de una línea aquí y de una rama allí, no una reescritura.
 */

const RUTA_DE_EMISION = '/api/v3/documentos'

/** El comodín de asignación automática. Solo se usaría si T027 sale mal. */
const COMODIN_DE_NUMERO = '#'

/**
 * Los códigos de tipo de documento del proveedor. Vocabulario ajeno: no sale de
 * este módulo, que es lo que hace real la frontera del principio III.
 */
const CODIGO_DE_TIPO: Record<string, string> = {
  boleta: '03',
  factura: '01',
}

/** Importes al proveedor en unidades de moneda con dos decimales, como texto. */
function aSoles(centimos: number): string {
  return (centimos / 100).toFixed(2)
}

function lineaParaElProveedor(linea: LineaParaEmitir): Record<string, unknown> {
  return {
    codigo: linea.codigo,
    descripcion: linea.descripcion,
    unidad: linea.unidad,
    cantidad: linea.cantidad,
    // El precio ya lleva el impuesto incluido y el proveedor hace el desglose.
    // Calcularlo aquí sería una segunda fuente de verdad para una cifra que se
    // imprime en un documento tributario (FR-032).
    precio_unitario: aSoles(linea.precio),
    total: aSoles(linea.importe),
  }
}

interface RespuestaDeEmision {
  readonly exito?: boolean
  readonly data?: {
    readonly serie?: string
    readonly numero?: string | number
    readonly estado?: string
    readonly external_id?: string
    readonly enlace_pdf?: string
    readonly enlace_xml?: string
    readonly enlace_cdr?: string
  }
}

export async function emitirDocumento(
  configuracion: ConfiguracionDelProveedor,
  peticion: PeticionDeEmision,
): Promise<Resultado<DocumentoEmitido>> {
  const codigoDeTipo = CODIGO_DE_TIPO[peticion.tipoDocumento]
  if (codigoDeTipo === undefined) {
    // Un documento sin valor tributario no debería llegar hasta aquí. Si llega es
    // un error de programación, y se clasifica como rechazo definitivo porque
    // consta que no se emitió nada.
    return fallo('rechazo_definitivo', 'tipo_no_emitible_por_el_proveedor')
  }

  const cuerpo = {
    tipo_documento: codigoDeTipo,
    serie: peticion.serie,
    numero:
      peticion.numero === null ? COMODIN_DE_NUMERO : String(peticion.numero),
    fecha_emision: peticion.emitidoEn.toISOString(),
    moneda: 'PEN',
    forma_pago: peticion.condicionPago.tipo === 'credito' ? 'credito' : 'contado',
    ...(peticion.condicionPago.fechaVencimiento !== undefined
      ? { fecha_vencimiento: peticion.condicionPago.fechaVencimiento }
      : {}),
    cliente:
      peticion.cliente === null
        ? // Cliente eventual: la boleta lo admite. El proveedor espera el
          // documento genérico de consumidor final.
          { tipo_documento: '0', numero_documento: '00000000', nombre: 'CLIENTE VARIOS' }
        : {
            tipo_documento: peticion.cliente.tipoDocumento === 'RUC' ? '6' : '1',
            numero_documento: peticion.cliente.numeroDocumento,
            nombre: peticion.cliente.denominacion,
            ...(peticion.cliente.direccion !== undefined
              ? { direccion: peticion.cliente.direccion }
              : {}),
            ...(peticion.cliente.correo !== undefined
              ? { correo: peticion.cliente.correo }
              : {}),
          },
    items: peticion.lineas.map(lineaParaElProveedor),
    total: aSoles(peticion.total),
    formato: peticion.formatoImpresion === 'rollo' ? 'ticket' : 'a4',
  }

  const respuesta = await pedirAlProveedor(configuracion, RUTA_DE_EMISION, cuerpo)

  if (!respuesta.ok) {
    // La clasificación viene del transporte y **no se reclasifica aquí**. Sería la
    // forma más fácil de degradar un `indeterminado` a `indisponible`, que es
    // exactamente el error que produce comprobantes duplicados.
    return propagarFallo(respuesta.fallo)
  }

  const cuerpoRespuesta = respuesta.valor.json as RespuestaDeEmision
  const datos = cuerpoRespuesta.data

  if (datos === undefined) {
    // Contestó con éxito pero sin documento. No se puede saber qué ocurrió.
    return fallo(
      'indeterminado',
      'exito_sin_documento',
      respuesta.valor.rastro,
    )
  }

  const traducido = traducirEstado(datos.estado)

  if (traducido.estado === undefined) {
    // El documento parece existir pero no entendemos su estado. Se trata como
    // indeterminado para que la reconciliación lo mire, en lugar de suponer.
    return fallo(
      'indeterminado',
      `estado_desconocido_${datos.estado ?? 'ausente'}`,
      respuesta.valor.rastro,
    )
  }

  const numeroAsignado = numeroDe(datos.numero) ?? peticion.numero

  if (numeroAsignado === null) {
    return fallo('indeterminado', 'numero_no_determinado', respuesta.valor.rastro)
  }

  // Si el proveedor devolvió un número distinto del que pedimos, lo dice aquí y
  // no en silencio: significaría que T027 salió mal y que la reconciliación no
  // puede confiar en el par serie-número que SuitPay creía tener.
  if (peticion.numero !== null && numeroAsignado !== peticion.numero) {
    return fallo(
      'indeterminado',
      `numero_no_respetado_pedido_${peticion.numero}_devuelto_${numeroAsignado}`,
      respuesta.valor.rastro,
    )
  }

  return exito({
    serie: datos.serie ?? peticion.serie,
    numero: numeroAsignado,
    estado: traducido.estado,
    archivos: {
      pdf: datos.enlace_pdf,
      xml: datos.enlace_xml,
      cdr: datos.enlace_cdr,
    },
    referenciaExterna: datos.external_id,
    rastro: respuesta.valor.rastro,
  })
}

function numeroDe(valor: string | number | undefined): number | null {
  if (valor === undefined) return null
  const numero = typeof valor === 'number' ? valor : Number.parseInt(valor, 10)
  return Number.isFinite(numero) ? numero : null
}
