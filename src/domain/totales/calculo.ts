/**
 * Cálculo de importes y totales.
 *
 * ## Lo que este módulo deliberadamente NO hace
 *
 * **No desglosa el impuesto.** FR-032 lo prohíbe expresamente: los precios del
 * catálogo ya lo llevan incluido y el desglose corresponde al proveedor de
 * emisión. Calcularlo aquí no sería una comodidad, sería una segunda fuente de
 * verdad para una cifra que aparece impresa en un documento tributario. Cuando
 * las dos discrepasen por un céntimo de redondeo, la del comprobante sería la
 * que vale y la nuestra la que confunde.
 *
 * De modo que aquí solo se multiplica y se suma.
 *
 * ## Por qué en céntimos
 *
 * Los importes se manejan en la unidad mínima, como enteros. Un precio de 12,30
 * es 1230. La razón es que el coma flotante no puede representar 0,1 y sumar
 * catorce líneas de un pedido acumula el error: `0.1 + 0.2` no es `0.3` en
 * ningún lenguaje que use IEEE 754. En un sistema donde el total se cobra en
 * efectivo y se imprime en un documento fiscal, ese error no es teórico.
 *
 * La conversión ocurre en los bordes: al leer el catálogo y al mostrar.
 */

/** Un importe en la unidad mínima de la moneda. Entero, siempre. */
export type Centimos = number

export interface LineaDePedido {
  readonly codigo: string
  readonly descripcion: string
  readonly unidad: string
  /**
   * Cantidad. Admite fracciones porque hay productos que se venden por metro,
   * pero se redondea a tres decimales para que no aparezcan cantidades con cola
   * infinita nacidas de una división.
   */
  readonly cantidad: number
  /** Precio unitario con el impuesto ya incluido. */
  readonly precio: Centimos
}

export interface LineaCalculada extends LineaDePedido {
  readonly importe: Centimos
}

const DECIMALES_DE_CANTIDAD = 3

export function normalizarCantidad(cantidad: number): number {
  const factor = 10 ** DECIMALES_DE_CANTIDAD
  return Math.round(cantidad * factor) / factor
}

/**
 * Importe de una línea. Se redondea al céntimo aquí y no al final, porque es lo
 * que hace que el total impreso sea la suma exacta de los importes impresos: si
 * se redondease solo el total, un cliente que sume a mano las líneas del
 * comprobante obtendría otra cifra, y esa conversación en el mostrador cuesta
 * más que el céntimo en discusión.
 */
export function calcularImporte(linea: LineaDePedido): Centimos {
  return Math.round(normalizarCantidad(linea.cantidad) * linea.precio)
}

export function calcularLinea(linea: LineaDePedido): LineaCalculada {
  return { ...linea, importe: calcularImporte(linea) }
}

export function calcularLineas(
  lineas: readonly LineaDePedido[],
): LineaCalculada[] {
  return lineas.map(calcularLinea)
}

/** Total del pedido: la suma de los importes ya redondeados de cada línea. */
export function calcularTotal(lineas: readonly LineaDePedido[]): Centimos {
  return lineas.reduce((suma, linea) => suma + calcularImporte(linea), 0)
}

/**
 * Si una línea puede convertirse en comprobante (FR-013). Un importe no
 * positivo no es un caso raro de laboratorio: sale de teclear una cantidad cero
 * mientras se corrige, o de un precio negociado a cero para regalar un
 * accesorio. Ambas cosas pasan y ninguna puede llegar a un documento fiscal.
 */
export function lineaEsEmitible(linea: LineaDePedido): boolean {
  return (
    Number.isFinite(linea.cantidad) &&
    Number.isFinite(linea.precio) &&
    normalizarCantidad(linea.cantidad) > 0 &&
    linea.precio > 0 &&
    calcularImporte(linea) > 0
  )
}

export function lineasNoEmitibles(
  lineas: readonly LineaDePedido[],
): LineaCalculada[] {
  return lineas.filter((linea) => !lineaEsEmitible(linea)).map(calcularLinea)
}

/**
 * Si el pedido entero puede emitirse. Un pedido vacío no puede: sin esta
 * comprobación el total sería cero y se emitiría un comprobante en blanco.
 */
export function pedidoEsEmitible(lineas: readonly LineaDePedido[]): boolean {
  return lineas.length > 0 && lineas.every(lineaEsEmitible)
}

const FORMATO_DE_MILES = new Intl.NumberFormat('es-PE', {
  useGrouping: true,
  maximumFractionDigits: 0,
})

/**
 * Formato para mostrar y para imprimir: coma para los miles y punto para los
 * decimales, que es como se escribe una cifra de soles en Perú.
 *
 * Se compone a partir del entero de céntimos en lugar de formatear el valor en
 * soles, porque pasar por un número decimal para volver a texto reintroduciría
 * justamente el error de coma flotante que el resto del módulo evita.
 */
export function formatearImporte(centimos: Centimos): string {
  const signo = centimos < 0 ? '-' : ''
  const absoluto = Math.abs(centimos)
  const enteros = Math.trunc(absoluto / 100)
  const resto = absoluto % 100
  return `${signo}${FORMATO_DE_MILES.format(enteros)}.${String(resto).padStart(2, '0')}`
}

export function centimosDesdeSoles(soles: number): Centimos {
  return Math.round(soles * 100)
}

export function solesDesdeCentimos(centimos: Centimos): number {
  return centimos / 100
}
