import { mensajeDe } from '../../server/errores.ts'
import type {
  DatosDeContribuyenteParaRevision,
  RespuestaDeConsultaContribuyente,
} from './clientes.funciones.ts'

/**
 * Decisión de UI tras consultar el padrón (FR-023 / FR-026).
 *
 * La consulta nunca crea el cliente: o bien hay datos para confirmar, o bien
 * se abre el alta manual. Un RPC roto (undefined / excepción) no debe dejar
 * el mostrador colgado en el morph «Agregar».
 */

export type DecisionTrasConsulta =
  | {
      readonly tipo: 'confirmar'
      readonly datos: DatosDeContribuyenteParaRevision
    }
  | {
      readonly tipo: 'alta_manual'
      readonly mensaje: string
      readonly tipoDocumento: 'DNI' | 'RUC'
      readonly numeroDocumento: string
    }

export function decidirTrasConsultaContribuyente(
  respuesta: RespuestaDeConsultaContribuyente | null | undefined,
  documento: {
    readonly tipoDocumento: 'DNI' | 'RUC'
    readonly numeroDocumento: string
  },
): DecisionTrasConsulta {
  if (respuesta?.ok === true && respuesta.datos !== undefined) {
    return { tipo: 'confirmar', datos: respuesta.datos }
  }

  return {
    tipo: 'alta_manual',
    mensaje:
      respuesta?.error?.mensaje ?? mensajeDe('servicio_no_disponible'),
    tipoDocumento: documento.tipoDocumento,
    numeroDocumento: documento.numeroDocumento,
  }
}

/** Mensaje por defecto cuando el RPC lanza (p. ej. HTTP 500 / Failed to fetch). */
export function mensajeDeConsultaIndisponible(): string {
  return mensajeDe('servicio_no_disponible')
}
