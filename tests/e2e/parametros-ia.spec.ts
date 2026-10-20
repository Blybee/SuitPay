import { expect, test } from '@playwright/test'
import { entrarComoAdministradorE2E } from './ayudas-sesion.ts'

test('parámetros muestra la inteligencia artificial y recuerda el interruptor', async ({
  page,
}) => {
  await entrarComoAdministradorE2E(page)
  await page.goto('/administracion/parametros')
  await expect(page.getByRole('heading', { name: 'Parámetros' })).toBeVisible()
  await expect(page.getByText('Inteligencia artificial')).toBeVisible()

  const texto = page.getByRole('switch', { name: 'Tareas de solo texto' })
  const imagen = page.getByRole('switch', { name: 'Tareas con imagen' })
  await expect(texto).toHaveAttribute('aria-checked', 'true')
  await expect(imagen).toHaveAttribute('aria-checked', 'false')
  await expect(page.getByText('OpenRouter', { exact: true }).first()).toBeVisible()
  await expect(
    page.getByText('dots-studio/dots-3-note-preview:free').first(),
  ).toBeVisible()
  await expect(page.getByText('gemini-3.8-flash')).toBeVisible()
  await expect(page.getByText('gemini-3.5-flash')).toBeVisible()

  await texto.click()
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText(/Guardado/)).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole('switch', { name: 'Tareas de solo texto' }),
  ).toHaveAttribute('aria-checked', 'false')
  await page.screenshot({
    path: '/opt/cursor/artifacts/parametros-ia.png',
    fullPage: true,
  })

  await page.getByRole('switch', { name: 'Tareas de solo texto' }).click()
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText(/Guardado/)).toBeVisible()
})
