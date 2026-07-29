/**
 * Los colores del sistema con sus papeles nombrados.
 *
 * `src/ui/tokens/tema.css` es la fuente de verdad y esto la refleja para el
 * puñado de sitios donde el color hace falta en JavaScript y no en una clase:
 * la etiqueta `theme-color` del documento y la salida impresa.
 */

export const COLORES = {
  /** Dice qué hay. Todo el contenido. */
  tinta: '#1a1714',
  /** Dice qué no es definitivo o qué está mal. Nunca lo que está bien. */
  aviso: '#c2321c',
  /** Dice qué quedó validado. Solo sobre documentos ya emitidos. */
  sello: '#4c3f91',
  /** Superficie blanca de paneles (Soft-Pill). */
  papel: '#ffffff',
  /** Lienzo de la aplicación (gray-50). */
  mesa: '#f9fafb',
  /** Borde sutil (gray-200). */
  borde: '#e5e7eb',
  /** Texto secundario (gray-500). */
  desvaida: '#6b7280',
} as const

export type PapelDeColor = keyof typeof COLORES
