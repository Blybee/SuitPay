import { CLAVES, guardar, leer } from './almacenes.ts'

/**
 * El espejo local del catálogo, del índice de clientes y de los parámetros.
 *
 * Cada uno se guarda con su versión, y la versión es lo que hace que arrancar
 * cueste poco: en la siguiente sesión se compara la versión en caché con la
 * publicada y **solo se descarga lo que cambió**. Un catálogo que no se ha
 * tocado en tres semanas no se vuelve a bajar tres semanas seguidas.
 */

export interface ProductoEnCatalogo {
  readonly codigo: string
  readonly descripcion: string
  readonly unidad: string
  readonly precio: number
  readonly activo: boolean
}

export interface CatalogoEnCache {
  readonly version: number
  readonly productos: readonly ProductoEnCatalogo[]
  readonly guardadoEn: number
}

export interface ClienteEnIndice {
  readonly numeroDocumento: string
  readonly denominacion: string
}

export interface IndiceDeClientesEnCache {
  readonly version: number
  readonly clientes: readonly ClienteEnIndice[]
  readonly guardadoEn: number
}

export interface ParametrosEnCache {
  readonly umbralIdentificacionBoleta: number
  readonly ventanaAnulacion: 'mismo_dia'
  readonly formatoImpresionPorDefecto: 'a4' | 'rollo'
  readonly guardadoEn: number
}

export function leerCatalogo(): Promise<CatalogoEnCache | undefined> {
  return leer<CatalogoEnCache>('catalogo', CLAVES.catalogo)
}

export function guardarCatalogo(
  version: number,
  productos: readonly ProductoEnCatalogo[],
): Promise<void> {
  return guardar<CatalogoEnCache>('catalogo', CLAVES.catalogo, {
    version,
    productos,
    guardadoEn: Date.now(),
  })
}

export function leerIndiceDeClientes(): Promise<
  IndiceDeClientesEnCache | undefined
> {
  return leer<IndiceDeClientesEnCache>('catalogo', CLAVES.indiceDeClientes)
}

export function guardarIndiceDeClientes(
  version: number,
  clientes: readonly ClienteEnIndice[],
): Promise<void> {
  return guardar<IndiceDeClientesEnCache>(
    'catalogo',
    CLAVES.indiceDeClientes,
    { version, clientes, guardadoEn: Date.now() },
  )
}

export function leerParametros(): Promise<ParametrosEnCache | undefined> {
  return leer<ParametrosEnCache>('catalogo', CLAVES.parametros)
}

export function guardarParametros(
  parametros: Omit<ParametrosEnCache, 'guardadoEn'>,
): Promise<void> {
  return guardar<ParametrosEnCache>('catalogo', CLAVES.parametros, {
    ...parametros,
    guardadoEn: Date.now(),
  })
}
