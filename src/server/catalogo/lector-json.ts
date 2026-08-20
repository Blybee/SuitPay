import { fallar } from '../errores.ts'
import type { ProductoDeCatalogo } from './tipos.ts'

/**
 * Interpreta el JSON exportado de la tienda virtual.
 *
 * ## Qué se toma y qué se deja
 *
 * Solo interesa lo vendible en mostrador: marca, nombre, variantes y precio
 * **mayorista** (`wholesale`). Cada variante se convierte en un producto
 * propio. Si hay variantes, el `unitConfig` del padre se ignora.
 *
 * Descripción: `{marca} {producto} [{variante}]`. El precio va en el campo
 * `precio` (céntimos), nunca embebido en el texto.
 *
 * Código: `id` de la tienda, o `{id}__{variantId}` si hay variante. El SKU
 * casi siempre viene vacío.
 *
 * Unidad: `NIU` (pieza). Paquetes y cajas de la tienda se ignoran.
 *
 * Sin wholesale → precio 0 (el vendedor lo corrige al vender).
 */

const UNIDAD_POR_DEFECTO = 'NIU'

interface PreciosDeTienda {
  readonly physical?: number
  readonly virtual?: number
  readonly wholesale?: number
}

interface VarianteDeTienda {
  readonly id?: string
  readonly name?: string
  readonly unitPrices?: PreciosDeTienda
  readonly stock?: boolean
}

interface ProductoDeTienda {
  readonly id?: string
  readonly name?: string
  readonly brand?: string
  readonly stock?: boolean
  readonly variants?: readonly VarianteDeTienda[]
  readonly unitConfig?: {
    readonly baseUnit?: string
    readonly unitPrices?: PreciosDeTienda
  }
}

export function interpretarJsonDeTienda(texto: string): readonly ProductoDeCatalogo[] {
  let bruto: unknown
  try {
    bruto = JSON.parse(texto) as unknown
  } catch {
    fallar('archivo_no_interpretable', { motivo: 'json_invalido' })
  }

  if (!Array.isArray(bruto)) {
    fallar('archivo_no_interpretable', { motivo: 'se_esperaba_arreglo' })
  }

  const productos: ProductoDeCatalogo[] = []

  for (const entrada of bruto) {
    if (entrada === null || typeof entrada !== 'object') continue
    const origen = entrada as ProductoDeTienda
    productos.push(...expandirProducto(origen))
  }

  return productos
}

function expandirProducto(origen: ProductoDeTienda): readonly ProductoDeCatalogo[] {
  const id = (origen.id ?? '').trim()
  const nombre = limpiarTexto(origen.name ?? '')
  const marca = limpiarTexto(origen.brand ?? '')
  if (id.length === 0 || nombre.length === 0) return []

  const variantes = Array.isArray(origen.variants) ? origen.variants : []

  if (variantes.length > 0) {
    const items: ProductoDeCatalogo[] = []
    for (const variante of variantes) {
      const variantId = (variante.id ?? '').trim()
      if (variantId.length === 0) continue

      const detalle = limpiarTexto(variante.name ?? '')
      items.push({
        codigo: `${id}__${variantId}`,
        descripcion: componerDescripcion(marca, nombre, detalle),
        unidad: UNIDAD_POR_DEFECTO,
        precio: aCentimos(variante.unitPrices?.wholesale),
        activo: variante.stock ?? origen.stock ?? true,
        marca,
      })
    }
    return items
  }

  return [
    {
      codigo: id,
      descripcion: componerDescripcion(marca, nombre),
      unidad: UNIDAD_POR_DEFECTO,
      precio: aCentimos(origen.unitConfig?.unitPrices?.wholesale),
      activo: origen.stock ?? true,
      marca,
    },
  ]
}

function componerDescripcion(
  marca: string,
  producto: string,
  variante = '',
): string {
  return [marca, producto, variante].filter((parte) => parte.length > 0).join(' ')
}

function limpiarTexto(valor: string): string {
  return valor.replace(/\s+/g, ' ').trim()
}

/** Soles de la tienda → céntimos enteros. Ausente o no numérico → 0. */
export function aCentimos(soles: number | undefined): number {
  if (typeof soles !== 'number' || !Number.isFinite(soles) || soles < 0) {
    return 0
  }
  return Math.round(soles * 100)
}
