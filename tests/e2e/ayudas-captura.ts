import type { Page } from '@playwright/test'

/** Sesión falsa para e2e de captura (requiere VITE_USAR_EMULADORES=true). */
export async function sembrarSesionE2ECaptura(pagina: Page): Promise<void> {
  await pagina.addInitScript(() => {
    sessionStorage.setItem(
      'suitpay:e2e-sesion',
      JSON.stringify({
        uid: 'vendedor-e2e-captura',
        nombre: 'Vendedor E2E',
        correo: 'vendedor-e2e@suitpay.local',
        rol: 'vendedor',
        activo: true,
      }),
    )
  })
}
