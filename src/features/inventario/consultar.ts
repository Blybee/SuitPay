import type { Existencia } from '../../domain/inventario/tipos.ts'
import { textoAvisoInventario } from '../../domain/inventario/reglas.ts'
import { leerInventarioFn } from './inventario.funciones.ts'

/**
 * Caché de sesión para getDoc perezoso. No es un contexto global de listas:
 * solo se llena al agregar/emitir o al abrir el popover de un SKU.
 */
const cache = new Map<string, Existencia | null>()

export function vaciarCacheInventario(): void {
  cache.clear()
}

export async function leerExistenciaPerezosa(
  codigo: string,
): Promise<Existencia | null> {
  const clave = codigo.trim()
  if (clave.length === 0) return null
  if (cache.has(clave)) return cache.get(clave) ?? null
  const respuesta = await leerInventarioFn({ data: { codigo: clave } })
  const existencia = respuesta?.ok ? (respuesta.existencia ?? null) : null
  cache.set(clave, existencia)
  return existencia
}

export async function avisoPerezosoDeCodigo(
  codigo: string,
): Promise<string | null> {
  return textoAvisoInventario(await leerExistenciaPerezosa(codigo))
}
