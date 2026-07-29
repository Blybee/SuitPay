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
 * ## Numeración (T027, 2026-07-29)
 *
 * SuitPay envía el número reclamado en su transacción. Comprobado en demo: al
 * enviar `900001` en serie `F001`, la respuesta devolvió `data.numero` =
 * `"F001-900001"`. Reenviar el mismo par responde HTTP 404 con
 * `"El documento ya está registrado."` → rechazo definitivo.
 *
 * El comodín `#` existe en la documentación pero SuitPay no lo usa: sin número
 * explícito la reconciliación dejaría de ser una consulta binaria.
 */

const RUTA_DE_EMISION = '/api/v3/documentos'

/** El comodín de asignación automática. Reservado; no se usa tras T027. */
const COMODIN_DE_NUMERO = '#'

/**
 * Códigos de identidad del cliente en la API v3 del proveedor (catálogo propio).
 * Vocabulario ajeno: no sale de este módulo.
 */
function codigoTipoDocumentoCliente(tipo: string): string {
  switch (tipo) {
    case 'RUC':
      return '4'
    case 'DNI':
      return '2'
    case 'CE':
      return '3'
    case 'PASAPORTE':
      return '5'
    default:
      return '1'
  }
}

/** Importes al proveedor en unidades de moneda con dos decimales. */
function aSoles(centimos: number): number {
  return Number((centimos / 100).toFixed(2))
}

function lineaParaElProveedor(linea: LineaParaEmitir): Record<string, unknown> {
  return {
    unidad: linea.unidad || 'NIU',
    codigo: linea.codigo,
    descripcion: linea.descripcion,
    cantidad: linea.cantidad,
    // Precio con impuesto incluido; el proveedor desglosa (FR-032).
    precio: aSoles(linea.precio),
    tipo_tax: '1',
    incluye_tax: true,
    descuento: 0,
  }
}

interface RespuestaDeEmision {
  readonly exito?: boolean
  readonly data?: {
    readonly numero?: string | number
    readonly number?: string
    readonly archivo?: string
    readonly filename?: string
    readonly external_id?: string
    readonly estado?: string
  }
  readonly archivos?: {
    readonly pdf?: string
    readonly xml?: string
    readonly cdr?: string
  }
  readonly links?: {
    readonly pdf?: string
    readonly xml?: string
    readonly cdr?: string
  }
}

/**
 * Extrae el correlativo de formas como `"F001-900001"` o un entero.
 */
function numeroDe(valor: string | number | undefined): number | null {
  if (valor === undefined) return null
  if (typeof valor === 'number') {
    return Number.isFinite(valor) ? valor : null
  }
  const parte = valor.includes('-') ? valor.slice(valor.lastIndexOf('-') + 1) : valor
  const numero = Number.parseInt(parte, 10)
  return Number.isFinite(numero) ? numero : null
}

export async function emitirDocumento(
  configuracion: ConfiguracionDelProveedor,
  peticion: PeticionDeEmision,
): Promise<Resultado<DocumentoEmitido>> {
  if (peticion.tipoDocumento !== 'boleta' && peticion.tipoDocumento !== 'factura') {
    return fallo('rechazo_definitivo', 'tipo_no_emitible_por_el_proveedor')
  }

  const cuerpo = {
    serie: peticion.serie,
    numero:
      peticion.numero === null ? COMODIN_DE_NUMERO : String(peticion.numero),
    tipo_operacion: '1',
    cliente:
      peticion.cliente === null
        ? {
            cliente_tipo_documento: '1',
            cliente_numero_documento: '00000000',
            cliente_denominacion: 'CLIENTE VARIOS',
            cliente_direccion: '',
            cliente_email: '',
            cliente_telefono: '',
          }
        : {
            cliente_tipo_documento: codigoTipoDocumentoCliente(
              peticion.cliente.tipoDocumento,
            ),
            cliente_numero_documento: peticion.cliente.numeroDocumento,
            cliente_denominacion: peticion.cliente.denominacion,
            cliente_direccion: peticion.cliente.direccion ?? '',
            cliente_email: peticion.cliente.correo ?? '',
            cliente_telefono: '',
          },
    items: peticion.lineas.map(lineaParaElProveedor),
    condicion_de_pago: [
      peticion.condicionPago.tipo === 'credito'
        ? {
            tipo_de_condicion: '1',
            fecha_de_pago: peticion.condicionPago.fechaVencimiento,
            monto: aSoles(peticion.total),
          }
        : {
            tipo_de_condicion: '0',
            forma_de_pago: '0',
            monto: 0,
          },
    ],
    formato_pdf: peticion.formatoImpresion === 'rollo' ? 'ticket' : 'a4',
    observaciones: '',
  }

  const respuesta = await pedirAlProveedor(configuracion, RUTA_DE_EMISION, cuerpo)

  if (!respuesta.ok) {
    return propagarFallo(respuesta.fallo)
  }

  const cuerpoRespuesta = respuesta.valor.json as RespuestaDeEmision
  const datos = cuerpoRespuesta.data

  if (datos === undefined) {
    return fallo(
      'indeterminado',
      'exito_sin_documento',
      respuesta.valor.rastro,
    )
  }

  const numeroAsignado =
    numeroDe(datos.numero) ?? numeroDe(datos.number) ?? peticion.numero

  if (numeroAsignado === null) {
    return fallo('indeterminado', 'numero_no_determinado', respuesta.valor.rastro)
  }

  if (peticion.numero !== null && numeroAsignado !== peticion.numero) {
    return fallo(
      'indeterminado',
      `numero_no_respetado_pedido_${peticion.numero}_devuelto_${numeroAsignado}`,
      respuesta.valor.rastro,
    )
  }

  const traducido = traducirEstado(datos.estado)
  const estado =
    traducido.estado ??
    // T027: la respuesta de éxito no siempre trae estado; el documento ya está
    // en el servidor del proveedor → equivalente a registrado.
    ('registrado' as const)

  const archivos = cuerpoRespuesta.archivos ?? cuerpoRespuesta.links

  return exito({
    serie: peticion.serie,
    numero: numeroAsignado,
    estado,
    archivos: {
      pdf: archivos?.pdf,
      xml: archivos?.xml,
      cdr: archivos?.cdr,
    },
    referenciaExterna: datos.external_id ?? datos.archivo ?? datos.filename,
    rastro: respuesta.valor.rastro,
  })
}
