import { buscarCotizacionPorNumero } from '../cotizaciones/leer.ts'
import type { Cotizacion } from '../cotizaciones/tipos.ts'

/**
 * Consulta de cotización por número (FR-047). No convierte ni emite.
 */
export async function consultarCotizacionPorNumero(
  bruto: string,
): Promise<{ readonly cotizacion: Cotizacion | null; readonly error?: string }> {
  const numero = Number.parseInt(bruto.trim(), 10)
  if (!Number.isFinite(numero) || numero <= 0) {
    return { cotizacion: null, error: 'Indica el número de cotización.' }
  }
  try {
    const cotizacion = await buscarCotizacionPorNumero(numero)
    return { cotizacion }
  } catch {
    return {
      cotizacion: null,
      error: 'No se pudo leer la cotización.',
    }
  }
}
