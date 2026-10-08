import type { Centimos } from '../totales/calculo.ts'

export type MonedaDeCompra = 'PEN' | 'USD'

export function normalizarMoneda(valor: unknown): MonedaDeCompra | undefined {
  if (typeof valor !== 'string') return undefined
  const plano = valor
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .trim()
  if (plano.length === 0) return undefined
  if (plano.includes('DOLAR') || plano === 'USD' || plano.includes('US$')) {
    return 'USD'
  }
  if (plano.includes('SOL') || plano === 'PEN' || plano === 'S/') return 'PEN'
  return undefined
}

/** Decimal con punto. Conserva los ceros de la escala (`1.3200` sigue `1.3200`). */
export function normalizarDecimal(texto: string): string | undefined {
  const limpio = texto.trim().replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(limpio)) return undefined
  return limpio
}

/**
 * Céntimos de un precio escrito. `5`, `5.00` y `5,50` son 500, 500 y 550.
 */
export function centimosDesdeTextoDecimal(texto: string): number | undefined {
  const decimal = normalizarDecimal(texto)
  if (decimal === undefined) return undefined
  return centimosDeDecimales(decimal, '1')
}

/**
 * Producto de dos decimales, al céntimo más cercano.
 * El factor es `1` en soles y el tipo de cambio venta en dólares.
 * Enteros, para no redondear el precio antes de multiplicar.
 */
export function centimosDeDecimales(
  precio: string,
  factor: string,
): Centimos | undefined {
  const izquierda = aEntero(precio)
  const derecha = aEntero(factor)
  if (izquierda === undefined || derecha === undefined) return undefined
  const numerador = izquierda.entero * derecha.entero * 100n
  const divisor = 10n ** BigInt(izquierda.escala + derecha.escala)
  const cociente = numerador / divisor
  const resto = numerador % divisor
  const redondeo = resto * 2n >= divisor ? 1n : 0n
  const total = cociente + redondeo
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) return undefined
  return Number(total)
}

/** Tres decimales, que es la escala que publica SUNAT (`3.45` → `3.450`). */
export function textoDeTipoCambio(venta: number): string | undefined {
  if (!Number.isFinite(venta) || venta <= 0) return undefined
  const milesimas = Math.round(venta * 1000)
  const entero = Math.trunc(milesimas / 1000)
  const fraccion = String(milesimas % 1000).padStart(3, '0')
  return `${entero}.${fraccion}`
}

function aEntero(
  texto: string,
): { readonly entero: bigint; readonly escala: number } | undefined {
  const decimal = normalizarDecimal(texto)
  if (decimal === undefined) return undefined
  const [entero, fraccion = ''] = decimal.split('.')
  if (entero === undefined) return undefined
  return { entero: BigInt(entero + fraccion), escala: fraccion.length }
}
