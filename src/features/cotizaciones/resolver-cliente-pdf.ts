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
 * El vendedor manda sobre el modelo. Si indicó cliente (registrado o nombre
 * libre), esa denominación se conserva. Si no, el modelo no es la fuente de
 * verdad: índice local y `clientes/{id}` ganan a lo detectado en el PDF.
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
  indicado: ClienteDelPedido | null = null,
): EtiquetaDeClientePdf {
  if (indicado !== null && indicado.denominacion.trim() !== '') {
    return {
      etiqueta: indicado.denominacion,
      cliente: indicado,
    }
  }

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
