import type { Rol } from './almacen.ts'

/**
 * A dónde entra cada rol cuando la sesión ya está leída.
 * El jefe no tiene mostrador: su pantalla de trabajo es el fichaje.
 */
export function destinoDeRol(
  rol: Rol | null,
): '/fichaje' | '/administracion' | '/' {
  if (rol === 'jefe') return '/fichaje'
  if (rol === 'administrador') return '/administracion'
  return '/'
}

/**
 * Rutas que el jefe sí puede ver. El resto (mostrador, comprobantes,
 * configuración) no es suyo y no debe pintarse.
 */
export function elJefeDebeAbandonarLaRuta(
  rol: Rol | null,
  pathname: string,
): boolean {
  if (rol !== 'jefe') return false
  if (pathname === '/acceso' || pathname === '/fichar') return false
  if (pathname === '/fichaje') return false
  if (pathname.startsWith('/administracion')) return false
  return true
}
