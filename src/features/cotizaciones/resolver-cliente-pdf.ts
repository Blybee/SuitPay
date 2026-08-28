import type { ClienteEnIndice } from '../../infra/local/catalogo.ts'
import type { ClienteDelPedido } from '../pedido/almacen.ts'

export interface ClienteDetectadoEnPdf {
  readonly tipoDocumento: 'DNI' | 'RUC'
  readonly numeroDocumento: string
  readonly denominacion: string
}

export interface EtiquetaDeClientePdf {
  readonly etiqueta: string
  readonly cliente: ClienteDelPedido | null
}

/**
 * El modelo no es la fuente de verdad. Si el documento está en el índice
 * local o en `clientes/{id}`, usamos nuestra denominación.
 */
export function resolverEtiquetaClientePdf(
  detectado: ClienteDetectadoEnPdf | null,
  indice: readonly ClienteEnIndice[],
  registrado: {
    readonly tipoDocumento: string
    readonly numeroDocumento: string
    readonly denominacion: string
    readonly direccion?: string
  } | null,
): EtiquetaDeClientePdf {
  if (detectado === null) {
    return { etiqueta: 'Sin cliente', cliente: null }
  }

  if (registrado !== null && registrado.denominacion.trim() !== '') {
    return {
      etiqueta: registrado.denominacion,
      cliente: {
        tipoDocumento: registrado.tipoDocumento,
        numeroDocumento: registrado.numeroDocumento,
        denominacion: registrado.denominacion,
        direccion: registrado.direccion,
      },
    }
  }

  const local = indice.find(
    (c) => c.numeroDocumento === detectado.numeroDocumento,
  )
  if (local !== undefined) {
    return {
      etiqueta: local.denominacion,
      cliente: {
        tipoDocumento: detectado.tipoDocumento,
        numeroDocumento: local.numeroDocumento,
        denominacion: local.denominacion,
      },
    }
  }

  return {
    etiqueta:
      detectado.denominacion.trim() !== ''
        ? detectado.denominacion
        : `${detectado.tipoDocumento} ${detectado.numeroDocumento}`,
    cliente: {
      tipoDocumento: detectado.tipoDocumento,
      numeroDocumento: detectado.numeroDocumento,
      denominacion:
        detectado.denominacion.trim() !== ''
          ? detectado.denominacion
          : `${detectado.tipoDocumento} ${detectado.numeroDocumento}`,
    },
  }
}
