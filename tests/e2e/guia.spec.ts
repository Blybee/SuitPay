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

const URL_LISTA_UBIGEOS =
  'https://www.reniec.gob.pe/Adherentes/jsp/ListaUbigeos.jsp'

test('partida y llegada abren la lista de ubigeos en una pestaña nueva', async ({
  page,
}) => {
  test.skip(
    !hayEmulador,
    'Requiere la Emulator Suite. Ver npm run prueba:e2e:completa',
  )

  await sembrarSesionDeVendedor(page)
  await page.goto('/')
  const buscador = entradaDeBusqueda(page)
  await buscador.fill('/guia')
  await buscador.press('Enter')

  const papeleta = page.getByRole('dialog', { name: 'Guía de remisión' })
  await expect(papeleta).toBeVisible({ timeout: 10_000 })

  const enlaces = papeleta.getByRole('link', {
    name: 'Buscar ubigeo en RENIEC',
  })
  await expect(enlaces).toHaveCount(2)
  await expect(enlaces.nth(0)).toHaveAttribute('href', URL_LISTA_UBIGEOS)
  await expect(enlaces.nth(0)).toHaveAttribute('target', '_blank')
  await expect(enlaces.nth(0)).toHaveAttribute('rel', 'noopener noreferrer')
  await expect(enlaces.nth(1)).toHaveAttribute('href', URL_LISTA_UBIGEOS)
  await expect(enlaces.nth(1)).toHaveAttribute('target', '_blank')
  await expect(enlaces.nth(1)).toHaveAttribute('rel', 'noopener noreferrer')

  const popup = page.waitForEvent('popup')
  await enlaces.first().click()
  const lista = await popup
  await expect(lista).toHaveURL(URL_LISTA_UBIGEOS)
})

test('el selector ofrece Bol + Guía R', async ({ page }) => {
  test.skip(
    !hayEmulador,
    'Requiere la Emulator Suite. Ver npm run prueba:e2e:completa',
  )

  await sembrarSesionDeVendedor(page)
  await page.goto('/')

  await page.getByLabel('Tipo de documento').click()
  await expect(page.getByRole('option', { name: /Bol \+ Guía R/ })).toBeVisible({
    timeout: 10_000,
  })
})
