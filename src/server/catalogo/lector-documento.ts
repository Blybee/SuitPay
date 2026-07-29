import { fallar } from '../errores.ts'
import type { ProductoDeCatalogo } from './tipos.ts'

/**
 * Interpretación de catálogos en PDF (T078).
 *
 * Aún no implementada: la migración operativa de esta entrega usa el JSON de la
 * tienda virtual (`lector-json.ts`). Se deja el punto de extensión para no
 * inventar un parser de PDF sin datos reales de prueba.
 */
export function interpretarDocumentoDeCatalogo(
  _bytes: Uint8Array,
): readonly ProductoDeCatalogo[] {
  fallar('archivo_no_interpretable', { motivo: 'importacion_pdf_pendiente' })
}
