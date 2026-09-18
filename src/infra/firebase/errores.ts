/**
 * Errores del SDK cliente de Firebase.
 *
 * El código llega como `permission-denied` o `firestore/permission-denied`
 * según la versión. No se muestra al vendedor: solo decide si reintentar.
 */
export function esPermisoDenegado(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return false
  }
  const codigo = String((error as { code: unknown }).code)
  return (
    codigo === 'permission-denied' || codigo.endsWith('/permission-denied')
  )
}
