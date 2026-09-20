import type { ItemCatalogoCompacto } from '../aprendizaje/compacto.ts'

/** Compacto de Compras: id, nombre, marca. Sin precio de venta ni stock. */
export function compactoParaCompras(
  items: readonly ItemCatalogoCompacto[],
): string {
  return JSON.stringify(
    items.map((item) => ({
      id: item.id,
      n: item.n,
      m: item.m,
    })),
  )
}
