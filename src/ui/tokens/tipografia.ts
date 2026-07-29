/**
 * Tipografía del sistema.
 *
 * ## Qué se usa y por qué
 *
 * **Atkinson Hyperlegible Next** para todo el texto. No se elige por gusto: la
 * diseñó el Braille Institute para baja visión, diferenciando expresamente los
 * caracteres que se confunden entre sí. Una verdad de producto confirmada es
 * que parte de los vendedores tiene la vista cansada y lee a distancia.
 *
 * **Atkinson Hyperlegible Mono** para números y códigos de producto, que se
 * leen carácter a carácter, y para la columna de importes.
 *
 * ## El compañero monoespaciado: verificado, existe
 *
 * DESIGN.md dejó abierta la pregunta de si Atkinson tenía compañero
 * monoespaciado, con Martian Mono como plan de reserva. **Se comprobó al
 * andamiar y existe**: `@fontsource-variable/atkinson-hyperlegible-mono` en la
 * versión 5.3.0. De modo que **no se usa Martian Mono** y la pareja del sistema
 * es la familia completa del propio Braille Institute, diseñada como conjunto.
 *
 * Se usa la variante "Next" de la familia de texto, que es la revisión de 2025
 * publicada junto a la monoespaciada, en lugar del Atkinson Hyperlegible
 * original de 2019. Los dos archivos son variables, así que todos los pesos
 * llegan en una descarga en vez de una por peso.
 *
 * Ambas se autoalojan desde `node_modules` a través de Fontsource, importadas
 * en `src/styles.css`. Ninguna petición sale hacia un servicio de tipografías
 * de terceros: el mostrador tiene que arrancar sin depender de una red ajena.
 */

/** Familia de todo el texto. */
export const FAMILIA_TEXTO = 'Atkinson Hyperlegible Next Variable'

/** Familia de números, importes y códigos de producto. */
export const FAMILIA_MONO = 'Atkinson Hyperlegible Mono Variable'

/**
 * Los papeles tipográficos del sistema, con la clase de Tailwind que los
 * realiza. Un tamaño que no aparezca aquí es un tamaño que alguien eligió al
 * azar; la escala de `tema.css` no ofrece ningún otro.
 */
export const PAPELES = {
  /** El importe a cobrar. El único elemento legible desde otro puesto. */
  total: 'font-mono text-total font-bold tabular-nums',
  /** Descripción, cantidad, precio e importe. Lo que más se lee del sistema. */
  renglon: 'text-renglon',
  /** Los números de un renglón: tabulares y alineados a la derecha siempre. */
  renglonNumerico: 'font-mono text-renglon tabular-nums text-right',
  /** Tipo de documento, serie y cliente. Fija, nunca se desplaza. */
  cabecera: 'text-cabecera font-bold',
  /** Nombres de campo y de columna. */
  etiqueta: 'font-mono text-etiqueta uppercase text-desvaida',
  /** Degradación y marcas de estado. Siempre en rojo de aviso. */
  aviso: 'text-aviso font-bold text-aviso',
} as const

export type PapelTipografico = keyof typeof PAPELES
