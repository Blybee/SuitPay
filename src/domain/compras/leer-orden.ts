import { normalizarMoneda } from './moneda.ts'
import type { MonedaDeCompra } from './moneda.ts'

export interface ItemDeOrden {
  readonly str: string
  readonly x: number
  readonly y: number
}

export interface LineaDeOrden {
  readonly codigo: string
  readonly descripcion: string
  readonly precioUnitario: string
}

export interface OrdenLeida {
  readonly moneda: MonedaDeCompra
  readonly fecha?: string
  readonly lineas: readonly LineaDeOrden[]
  /** Índice del archivo dentro de la carga. */
  readonly grupo?: number
}

const TOLERANCIA_Y = 3
const PRECIO = /^\d+\.\d{2,4}$/
const FECHA_LATAM = /^(\d{2})\/(\d{2})\/(\d{4})$/

/**
 * Lee moneda, fecha y precio unitario de una orden de compra con texto
 * posicionado. Si no hay moneda o no hay líneas, devuelve null y el modelo
 * sigue siendo el camino.
 */
export function leerOrdenDeItems(
  items: readonly ItemDeOrden[],
): OrdenLeida | null {
  const moneda = monedaDe(items)
  const precioX = xDe(items, 'PRECIO')
  if (moneda === undefined || precioX === undefined) return null

  const umX = xDe(items, 'U.M.') ?? precioX
  const headerY = yDe(items, 'PRECIO')
  if (headerY === undefined) return null

  const lineas: LineaDeOrden[] = []
  for (const fila of agrupar(items)) {
    const ancla = fila[0]
    if (ancla === undefined || ancla.y >= headerY - 4) continue
    const precio = fila.find(
      (item) => PRECIO.test(item.str) && Math.abs(item.x - precioX) <= 50,
    )
    if (precio === undefined) continue
    const codigoItem = [...fila].sort((a, b) => a.x - b.x)[0]
    if (codigoItem === undefined) continue
    const codigo = codigoCanonico(codigoItem.str)
    if (codigo.length === 0) continue
    const descripcion = fila
      .filter((item) => item.x > codigoItem.x + 8 && item.x < umX - 4)
      .map((item) => item.str)
      .join(' ')
      .trim()
    lineas.push({
      codigo,
      descripcion: descripcion.length > 0 ? descripcion : codigo,
      precioUnitario: precio.str,
    })
  }

  if (lineas.length === 0) return null
  const fecha = fechaDeOrden(items)
  return {
    moneda,
    ...(fecha !== undefined ? { fecha } : {}),
    lineas,
  }
}

export function crudoDesdeOrdenes(ordenes: readonly OrdenLeida[]): {
  readonly coincidencias: readonly {
    readonly codigo: string
    readonly etiquetaFactura: string
    readonly precioUnitario: string
    readonly moneda: MonedaDeCompra
    readonly precioCompraEn?: string
    readonly grupo: number
  }[]
} {
  return {
    coincidencias: ordenes.flatMap((orden, indice) =>
      orden.lineas.map((linea) => ({
        codigo: linea.codigo,
        etiquetaFactura: linea.descripcion,
        precioUnitario: linea.precioUnitario,
        moneda: orden.moneda,
        grupo: orden.grupo ?? indice,
        ...(orden.fecha !== undefined ? { precioCompraEn: orden.fecha } : {}),
      })),
    ),
  }
}

function monedaDe(items: readonly ItemDeOrden[]): MonedaDeCompra | undefined {
  const etiqueta = itemExacto(items, 'MONEDA')
  if (etiqueta === undefined) return undefined
  const valor = aLaDerecha(items, etiqueta)
  return valor === undefined ? undefined : normalizarMoneda(valor.str)
}

function fechaDeOrden(items: readonly ItemDeOrden[]): string | undefined {
  const etiqueta = items.find((item) => item.str.trim() === 'FECHA')
  if (etiqueta === undefined) return undefined
  const valor = aLaDerecha(items, etiqueta)
  if (valor === undefined) return undefined
  const partes = FECHA_LATAM.exec(valor.str.trim())
  if (partes === null) return undefined
  return `${partes[3]}-${partes[2]}-${partes[1]}`
}

function aLaDerecha(
  items: readonly ItemDeOrden[],
  etiqueta: ItemDeOrden,
): ItemDeOrden | undefined {
  const candidatos = items
    .filter(
      (item) =>
        item !== etiqueta &&
        item.x > etiqueta.x &&
        Math.abs(item.y - etiqueta.y) <= TOLERANCIA_Y,
    )
    .sort((a, b) => a.x - b.x)
  return candidatos[0]
}

function itemExacto(
  items: readonly ItemDeOrden[],
  texto: string,
): ItemDeOrden | undefined {
  return items.find((item) => item.str.trim().toUpperCase() === texto)
}

function xDe(items: readonly ItemDeOrden[], texto: string): number | undefined {
  return itemExacto(items, texto)?.x
}

function yDe(items: readonly ItemDeOrden[], texto: string): number | undefined {
  return itemExacto(items, texto)?.y
}

/**
 * Forma comparable del SKU: sin espacios sobrantes, en mayúsculas y sin la
 * letra suelta que la orden imprime al final (`JL-27000 R` y `JL-27000`).
 */
export function codigoCanonico(texto: string): string {
  const limpio = texto.trim().toUpperCase()
  const corte = /^(\S+)\s+[A-Z]$/.exec(limpio)
  return corte?.[1] ?? limpio
}

function agrupar(items: readonly ItemDeOrden[]): ItemDeOrden[][] {
  const ordenados = [...items].sort((a, b) => b.y - a.y || a.x - b.x)
  const filas: ItemDeOrden[][] = []
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
  return filas
}
