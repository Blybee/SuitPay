import { deleteApp, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { expect, test } from '@playwright/test'
import { entrarComoAdministradorE2E } from './ayudas-sesion.ts'

/** Documento anterior a los interruptores: no trae iaTexto ni iaImagen. */
async function sembrarParametrosSinInterruptores(): Promise<void> {
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'
  const aplicacion = initializeApp(
    { projectId: 'demo-suitpay' },
    `parametros-legacy-${Date.now()}`,
  )
  try {
    await getFirestore(aplicacion).doc('config/parametros').set({
      umbralIdentificacionBoleta: 70_000,
      ventanaAnulacion: 'mismo_dia',
      formatoImpresionPorDefecto: 'a4',
    })
  } finally {
    await deleteApp(aplicacion)
  }
}

test('parámetros muestra la inteligencia artificial y recuerda el interruptor', async ({
  page,
}) => {
  await sembrarParametrosSinInterruptores()
  await entrarComoAdministradorE2E(page)
  await page.goto('/administracion/parametros')
  await expect(page.getByRole('heading', { name: 'Parámetros' })).toBeVisible()
  await expect(page.getByText('Inteligencia artificial')).toBeVisible()

  const texto = page.getByRole('switch', { name: 'Tareas de solo texto' })
  const imagen = page.getByRole('switch', { name: 'Tareas con imagen' })
  await expect(texto).toHaveAttribute('aria-checked', 'true')
  await expect(imagen).toHaveAttribute('aria-checked', 'false')
  await expect(
    page.locator('div.justify-between').filter({ has: page.locator('#ia-texto') }).getByText('OpenRouter', { exact: true }),
  ).toBeVisible()
  await expect(
    page.locator('div.justify-between').filter({ has: page.locator('#ia-imagen') }).getByText('Gemini', { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByText('nvidia/nemotron-3-super-120b-a12b:free'),
  ).toBeVisible()
  await expect(
    page.getByText('nvidia/nemotron-3.5-super-vl:free'),
  ).toBeVisible()
  await expect(page.getByText('gemini-3.8-flash')).toBeVisible()
  await expect(page.getByText('gemini-3.5-flash')).toBeVisible()
  await page.screenshot({
    path: '/opt/cursor/artifacts/parametros-ia-defecto.png',
    fullPage: true,
  })

  await texto.click()
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText(/Guardado/)).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole('switch', { name: 'Tareas de solo texto' }),
  ).toHaveAttribute('aria-checked', 'false')
  await expect(
    page.locator('div.justify-between').filter({ has: page.locator('#ia-texto') }).getByText('Gemini', { exact: true }),
  ).toBeVisible()
  await page.screenshot({
    path: '/opt/cursor/artifacts/parametros-ia-cambiado.png',
    fullPage: true,
  })

  await page.getByRole('switch', { name: 'Tareas de solo texto' }).click()
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText(/Guardado/)).toBeVisible()
})
