import type { Rol } from './almacen.ts'
import { elJefeDebeAbandonarLaRuta } from './destino.ts'

/**
 * Qué pinta la cáscara.
 *
 * `destino` es la ruta en vuelo (`location`). `pantalla` es la que ya
 * resolvió (`resolvedLocation`). Si «pública» se calcula con la pantalla,
 * un `<Navigate>` a `/acceso` deja la pantalla en `/` y vuelve a navegar
 * sin terminar.
 */
export type VistaDeCascaron =
  | 'publica'
  | 'cargando'
  | 'ir-a-acceso'
  | 'ir-a-fichaje'
  | 'esperando-fichaje'
  | 'mostrador'

export function vistaDeCascaron(entrada: {
  readonly pathnameDestino: string
  readonly pathnameEnPantalla: string
  readonly cargandoSesion: boolean
  readonly sinSesion: boolean
  readonly rol: Rol | null
}): VistaDeCascaron {
  const publica =
    entrada.pathnameDestino === '/acceso' || entrada.pathnameDestino === '/fichar'
  if (publica) return 'publica'
  if (entrada.cargandoSesion) return 'cargando'
  if (entrada.sinSesion) return 'ir-a-acceso'

  const jefeFuera = elJefeDebeAbandonarLaRuta(
    entrada.rol,
    entrada.pathnameEnPantalla,
  )
  if (!jefeFuera) return 'mostrador'
  if (entrada.pathnameDestino === '/fichaje') return 'esperando-fichaje'
  return 'ir-a-fichaje'
}
