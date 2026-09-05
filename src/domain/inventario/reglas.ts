/**
 * Reglas puras de inventario orientativo (FR-004, FR-007).
 */

export function umbralEfectivo(
  maximo: number,
  umbral: number | undefined,
): number {
  if (umbral !== undefined && Number.isFinite(umbral)) return umbral
  return 0.1 * maximo
}

export function estaEnAlerta(
  cantidad: number,
  maximo: number,
  umbral?: number,
): boolean {
  return cantidad < umbralEfectivo(maximo, umbral)
}

/** Primera escritura: maximo = cantidad si no viene otro valor. */
export function maximoAlFijar(
  cantidad: number,
  maximoPrevio: number | undefined,
): number {
  if (maximoPrevio !== undefined && Number.isFinite(maximoPrevio)) {
    return maximoPrevio
  }
  return cantidad
}

/**
 * Aviso no bloqueante para el mostrador. Nunca habla de «stock real».
 * `null` si el SKU no está controlado o la cifra no está baja.
 */
export function textoAvisoInventario(
  existencia: { readonly cantidad: number; readonly alerta: boolean } | null,
): string | null {
  if (existencia === null) return null
  if (existencia.cantidad <= 0) {
    return 'Cifra orientativa en 0. Se puede emitir.'
  }
  if (existencia.alerta) {
    return 'Cifra orientativa bajo umbral. Se puede emitir.'
  }
  return null
}

export function deltasDeVenta(
  lineas: readonly { readonly codigo: string; readonly cantidad: number }[],
): ReadonlyMap<string, number> {
  const deltas = new Map<string, number>()
  for (const linea of lineas) {
    const codigo = linea.codigo.trim()
    if (codigo.length === 0) continue
    deltas.set(codigo, (deltas.get(codigo) ?? 0) - linea.cantidad)
  }
  return deltas
}
