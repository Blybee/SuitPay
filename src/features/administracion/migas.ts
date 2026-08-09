/**
 * Hermanas del nivel Administración (hub → páginas).
 * Usadas por `MigasDePan` en las rutas bajo `/administracion/*`.
 */

export const HERMANAS_ADMIN = [
  { etiqueta: 'Catálogo', to: '/administracion/catalogo' as const },
  { etiqueta: 'Series', to: '/administracion/series' as const },
  { etiqueta: 'Usuarios', to: '/administracion/usuarios' as const },
  { etiqueta: 'Parámetros', to: '/administracion/parametros' as const },
] as const

export type RutaAdminHermana = (typeof HERMANAS_ADMIN)[number]['to']
