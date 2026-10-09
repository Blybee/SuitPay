import type { ItemDeTexto } from './tipos.ts'

const TOLERANCIA_Y = 3

export function agruparPorFila(items: readonly ItemDeTexto[]): ItemDeTexto[][] {
  const ordenados = [...items].sort((a, b) => b.y - a.y || a.x - b.x)
  const filas: ItemDeTexto[][] = []
  for (const item of ordenados) {
    const ultima = filas[filas.length - 1]
    const ancla = ultima?.[0]
    if (
      ultima !== undefined &&
      ancla !== undefined &&
      Math.abs(ancla.y - item.y) <= TOLERANCIA_Y
    ) {
      ultima.push(item)
    } else {
      filas.push([item])
    }
  }
  for (const fila of filas) {
    fila.sort((a, b) => a.x - b.x)
  }
  return filas
}

export function textoDeFila(fila: readonly ItemDeTexto[]): string {
  return fila
    .map((item) => item.str.trim())
    .filter((texto) => texto.length > 0)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function unirDireccion(
  previa: string | undefined,
  siguiente: string,
): string {
  const pedazo = siguiente.trim()
  if (pedazo.length === 0) return previa ?? ''
  if (previa === undefined || previa.length === 0) return pedazo
  return `${previa} ${pedazo}`
}
