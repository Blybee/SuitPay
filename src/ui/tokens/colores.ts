/**
 * Los colores del sistema con sus papeles nombrados.
 *
 * `src/ui/tokens/tema.css` es la fuente de verdad y esto la refleja para el
 * puñado de sitios donde el color hace falta en JavaScript y no en una clase:
 * la etiqueta `theme-color` del documento y la salida impresa. Una prueba
 * comprueba que los dos archivos no se separen.
 */

export const COLORES = {
  /** Dice qué hay. Todo el contenido. */
  tinta: '#1a1714',
  /** Dice qué no es definitivo o qué está mal. Nunca lo que está bien. */
  aviso: '#c2321c',
  /** Dice qué quedó validado. Solo sobre documentos ya emitidos. */
  sello: '#4c3f91',
  /** El fondo de la hoja de trabajo. Blanco cálido, nunca blanco puro. */
  papel: '#f7f4ec',
  /** El kraft del entorno, que hace legible la hoja como región de contenido. */
  mesa: '#ded7c7',
  /** Tinta gastada: etiquetas, reglas y el texto tachado de una corrección. */
  desvaida: '#8a8378',
} as const

export type PapelDeColor = keyof typeof COLORES
