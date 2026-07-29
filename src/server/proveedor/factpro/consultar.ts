import {
  exito,
  propagarFallo
  
  
  
  
} from '../interfaz.ts'
import type {DocumentoConsultado, PeticionDeConsulta, RastroDelProveedor, Resultado} from '../interfaz.ts';
import { traducirEstado } from './estados.ts'
import {
  pedirAlProveedor
  
} from './transporte.ts'
import type {ConfiguracionDelProveedor} from './transporte.ts';

/**
 * Consulta de un documento por serie y número.
 *
 * **Es la primitiva de la que depende toda la reconciliación**, y por eso se
 * implementa antes que la emisión y no después. FR-028 y FR-029 se apoyan
 * enteramente en ella: sin poder preguntar "¿existe el B001-47?", un estado
 * indeterminado no tendría salida y la única opción sería reintentar a ciegas,
 * que es exactamente lo que el principio II prohíbe.
 *
 * La documentación del proveedor confirma que su endpoint de consulta acepta
 * exactamente serie y número y devuelve existencia, estado y traza de eventos.
 * Ésa era la asunción más cara de la especificación y quedó cerrada.
 *
 * ## Por qué devuelve total, cliente y fecha
 *
 * No es información de adorno. Cuando el número no era conocido de antemano
 * —porque el proveedor lo asignó y no aceptó uno explícito— la reconciliación
 * tiene que sondear los números siguientes al último confirmado y decidir si el
 * documento que encuentra es el nuestro. Esos tres datos son lo único con lo que
 * puede decidirlo.
 */

const RUTA_DE_CONSULTA = '/api/v3/consulta'

interface RespuestaDeConsulta {
  readonly exito?: boolean
  readonly data?: {
    readonly serie?: string
    readonly numero?: string | number
    readonly estado?: string
    readonly total?: string | number
    readonly cliente?: { readonly numero_documento?: string }
    readonly fecha_emision?: string
  }
}

/** Convierte un importe del proveedor a céntimos. Llega como texto decimal. */
function aCentimos(valor: string | number | undefined): number | undefined {
  if (valor === undefined) return undefined
  const numero = typeof valor === 'number' ? valor : Number.parseFloat(valor)
  if (!Number.isFinite(numero)) return undefined
  return Math.round(numero * 100)
}

function aNumero(valor: string | number | undefined): number | undefined {
  if (valor === undefined) return undefined
  const numero = typeof valor === 'number' ? valor : Number.parseInt(valor, 10)
  return Number.isFinite(numero) ? numero : undefined
}

function aFecha(valor: string | undefined): Date | undefined {
  if (valor === undefined) return undefined
  const fecha = new Date(valor)
  return Number.isNaN(fecha.getTime()) ? undefined : fecha
}

function documentoAusente(
  peticion: PeticionDeConsulta,
  rastro: RastroDelProveedor,
): DocumentoConsultado {
  return {
    existe: false,
    serie: peticion.serie,
    numero: peticion.numero,
    estado: undefined,
    total: undefined,
    numeroDocumentoCliente: undefined,
    emitidoEn: undefined,
    archivos: { pdf: undefined, xml: undefined, cdr: undefined },
    rastro,
  }
}

export async function consultarDocumento(
  configuracion: ConfiguracionDelProveedor,
  peticion: PeticionDeConsulta,
): Promise<Resultado<DocumentoConsultado>> {
  const respuesta = await pedirAlProveedor(configuracion, RUTA_DE_CONSULTA, {
    serie: peticion.serie,
    numero: peticion.numero,
  })

  if (!respuesta.ok) {
    // T027: documento ausente → HTTP 404 + "Documento no encontrado.".
    // Solo ese mensaje afirma ausencia; otros 404 no se interpretan a ciegas.
    const mensaje = (respuesta.fallo.rastro?.mensajeOriginal ?? '').toLowerCase()
    if (
      respuesta.fallo.clase === 'rechazo_definitivo' &&
      mensaje.includes('no encontrado') &&
      respuesta.fallo.rastro
    ) {
      return exito(documentoAusente(peticion, respuesta.fallo.rastro))
    }
    // Cualquier otro fallo (red, 5xx, credenciales): NO afirmar ausencia.
    return propagarFallo(respuesta.fallo)
  }

  const cuerpo = respuesta.valor.json as RespuestaDeConsulta
  const datos = cuerpo.data

  if (datos === undefined) {
    return exito(documentoAusente(peticion, respuesta.valor.rastro))
  }

  const traducido = traducirEstado(datos.estado)

  if (traducido.codigoDesconocido && datos.estado !== undefined) {
    // El documento está ahí pero no entendemos su estado. Se informa como
    // existente sin estado, para que la reconciliación lo mande a intervención
    // manual en lugar de adivinar. Adivinar aquí es lo que produce un
    // comprobante duplicado o una venta dada por buena sin serlo.
    return exito({
      existe: true,
      serie: datos.serie ?? peticion.serie,
      numero: aNumero(datos.numero) ?? peticion.numero,
      estado: undefined,
      total: aCentimos(datos.total),
      numeroDocumentoCliente: datos.cliente?.numero_documento,
      emitidoEn: aFecha(datos.fecha_emision),
      archivos: { pdf: undefined, xml: undefined, cdr: undefined },
      rastro: respuesta.valor.rastro,
    })
  }

  if (traducido.estado === undefined) {
    return exito(documentoAusente(peticion, respuesta.valor.rastro))
  }

  return exito({
    existe: true,
    serie: datos.serie ?? peticion.serie,
    numero: aNumero(datos.numero) ?? peticion.numero,
    estado: traducido.estado,
    total: aCentimos(datos.total),
    numeroDocumentoCliente: datos.cliente?.numero_documento,
    emitidoEn: aFecha(datos.fecha_emision),
    archivos: { pdf: undefined, xml: undefined, cdr: undefined },
    rastro: respuesta.valor.rastro,
  })
}
