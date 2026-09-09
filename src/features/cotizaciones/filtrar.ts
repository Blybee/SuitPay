import Fuse from 'fuse.js'
import type { IFuseOptions } from 'fuse.js'
import { normalizar } from '../../domain/busqueda/productos.ts'
import { formatearImporte } from '../../domain/totales/calculo.ts'
import type { Cotizacion } from './tipos.ts'

interface PendienteBuscable {
  readonly cotizacion: Cotizacion
  readonly haystack: string
}

const OPCIONES: IFuseOptions<PendienteBuscable> = {
  keys: [{ name: 'haystack', weight: 1 }],
  includeScore: true,
  ignoreLocation: true,
  ignoreDiacritics: true,
  threshold: 0.45,
  minMatchCharLength: 1,
}

function haystackDe(cotizacion: Cotizacion): string {
  const nombre = cotizacion.cliente?.denominacion ?? ''
  return normalizar(
    `${cotizacion.numero} ${nombre} ${formatearImporte(cotizacion.total)} ${cotizacion.total}`,
  )
}

/**
 * Filtro en memoria de pendientes recientes: número, nombre de cliente o monto.
 * Término vacío devuelve la lista intacta.
 */
export function filtrarPendientes(
  lista: readonly Cotizacion[],
  termino: string,
): readonly Cotizacion[] {
  const recortado = termino.trim()
  if (recortado.length === 0) return lista

  const porId = new Map<string, Cotizacion>()
  const numero = Number.parseInt(recortado, 10)
  if (Number.isFinite(numero) && numero > 0 && String(numero) === recortado) {
    for (const cada of lista) {
      if (cada.numero === numero) porId.set(cada.id, cada)
    }
  }

  const limpio = normalizar(recortado)
  if (limpio.length === 0) return [...porId.values()]

  const fuse = new Fuse(
    lista.map((cotizacion) => ({
      cotizacion,
      haystack: haystackDe(cotizacion),
    })),
    OPCIONES,
  )
  for (const resultado of fuse.search(limpio)) {
    porId.set(resultado.item.cotizacion.id, resultado.item.cotizacion)
  }

  if (porId.size === 0) return []

  return lista.filter((cada) => porId.has(cada.id))
}
