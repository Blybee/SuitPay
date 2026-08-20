import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { sembrarSesionDeVendedor } from './ayudas-sesion.ts'

async function hayEmuladorDeAutenticacion(): Promise<boolean> {
  try {
    await fetch('http://127.0.0.1:9099/')
    return true
  } catch {
    return false
  }
}

const hayEmulador = await hayEmuladorDeAutenticacion()

function entradaDeBusqueda(pagina: Page) {
  return pagina.getByRole('combobox', { name: /Buscar producto/i })
}

/**
 * T020 — e2e mínimo: `/guia` abre la papeleta y no emite por el comando.
 */
test('el comando /guia abre la papeleta sin emitir', async ({ page }) => {
  test.skip(
    !hayEmulador,
    'Requiere la Emulator Suite. Ver npm run prueba:e2e:completa',
  )

  await sembrarSesionDeVendedor(page)
  await page.goto('/')

  const buscador = entradaDeBusqueda(page)
  await buscador.fill('/guia')
  await buscador.press('Enter')

  await expect(
    page.getByRole('heading', { name: 'Guía de remisión' }),
  ).toBeVisible({ timeout: 10_000 })
  await expect(
    page.getByRole('button', { name: 'Emitir', exact: true }),
  ).toBeVisible()
})
