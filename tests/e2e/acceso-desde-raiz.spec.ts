import { expect, test } from '@playwright/test'

test('sin sesión, abrir / termina en el formulario de acceso', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/acceso$/, { timeout: 5_000 })
  await expect(page.getByLabel('Correo')).toBeVisible()
  await expect(page.getByLabel('Contraseña')).toBeVisible()
  await page.screenshot({
    path: '/opt/cursor/artifacts/acceso-desde-raiz.png',
    fullPage: true,
  })
})

test('un jefe que abre / termina en fichaje sin repetir el salto', async ({
  page,
}) => {
  await page.addInitScript(() => {
    sessionStorage.setItem(
      'suitpay:e2e-sesion',
      JSON.stringify({
        uid: 'jefe-e2e',
        nombre: 'Jefe',
        correo: 'jefe@ejemplo.pe',
        rol: 'jefe',
        activo: true,
      }),
    )
  })
  await page.goto('/')
  await expect(page).toHaveURL(/\/fichaje$/, { timeout: 5_000 })
  await expect(page.getByLabel('Correo')).toHaveCount(0)
})
