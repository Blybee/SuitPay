import { REGLAS } from '../../domain/documentos/tipos.ts'
import type { TipoElegible } from '../../domain/documentos/tipos.ts'

/**
 * Motivo para deshabilitar Emitir en el pie. `null` = el botón puede pulsar.
 * El servidor sigue siendo la última barrera (`pedidoEsEmitible`).
 */
export function calcularMotivoDeBloqueo(datos: {
  readonly lineas: number
  readonly emitible: boolean
  readonly tipo: TipoElegible
  readonly cliente: unknown
  readonly total: number
  readonly umbral: number
  readonly motivoDeSesion: string | null
  readonly encadenarGuia?: boolean
  readonly serieGuia?: string | null
}): string | null {
  if (datos.motivoDeSesion !== null) return datos.motivoDeSesion

  if (datos.lineas === 0) {
    return 'Agrega al menos un producto para emitir.'
  }

  if (!datos.emitible) {
    return 'Hay una línea con cantidad o precio en cero. Corrígela para poder emitir.'
  }

  if (
    datos.encadenarGuia === true &&
    (datos.serieGuia === null || datos.serieGuia === undefined)
  ) {
    return 'No hay serie de guía asignada. Elige Boleta o Factura, o pide una serie T al administrador.'
  }

  const reglas = REGLAS[datos.tipo]
  if (datos.cliente === null) {
    if (reglas.exigeClienteIdentificado) {
      return 'Una factura necesita el RUC del cliente. Identifícalo para poder emitir.'
    }
    if (reglas.sujetoAUmbralDeIdentificacion && datos.total > datos.umbral) {
      return 'Este importe obliga a identificar al cliente. Ingresa su documento para continuar.'
    }
  }

  return null
}
