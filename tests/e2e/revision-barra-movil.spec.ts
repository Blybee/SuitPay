import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { sembrarSesionE2ECaptura } from './ayudas-captura.ts'

const INSTRUCCION =
  'Compara con el original. Nada se emite hasta que apruebes.'

const MINIATURA =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

const CATALOGO = [
  {
    codigo: 'TUB-PVC-12',
    descripcion: 'TUBO PVC 1/2 PULGADA X 3M',
    unidad: 'UND',
    precio: 1_250,
    activo: true,
  },
]

interface Caja {
  readonly x: number
  readonly y: number
  readonly right: number
  readonly bottom: number
}

function cajaDe(rect: {
  x: number
  y: number
  width: number
  height: number
}): Caja {
  return {
    x: rect.x,
    y: rect.y,
    right: rect.x + rect.width,
    bottom: rect.y + rect.height,
  }
}

function seSolapan(a: Caja, b: Caja): boolean {
  return a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y
}

async function abrirRevision(
  pagina: Page,
  lineas: readonly Record<string, unknown>[],
): Promise<void> {
  await pagina.setViewportSize({ width: 390, height: 844 })
  await sembrarSesionE2ECaptura(pagina)
  await pagina.goto('/')
  await pagina.waitForFunction(
    () => typeof window.__suitpayInyectarPropuestaCaptura === 'function',
  )
  await pagina.evaluate(
    ({ src, lineasInyectadas }) => {
      window.__suitpayInyectarPropuestaCaptura?.({
        tipo: 'imagen',
        medioObjectUrl: src,
        lineas: lineasInyectadas,
      })
    },
    { src: MINIATURA, lineasInyectadas: lineas },
  )
  await expect(pagina.getByTestId('revision-captura')).toBeVisible()
}

const LINEA_RESUELTA = {
  textoOriginal: 'un tubo pvc de media',
  candidatos: [
    {
      codigo: 'TUB-PVC-12',
      descripcion: 'TUBO PVC 1/2 PULGADA X 3M',
      unidad: 'UND',
      cantidad: 1,
      grado: 'exacta',
    },
  ],
  seleccion: 'TUB-PVC-12',
  estadoLinea: 'resuelta',
  cantidad: 1,
}

test('en 390px la instrucción se lee y Aprobar queda sobre Descartar', async ({
  page,
}) => {
  await abrirRevision(page, [LINEA_RESUELTA])

  const instruccion = page.getByText(INSTRUCCION)
  await expect(instruccion).toBeVisible()
  await expect(page.getByText('Revisar propuesta')).toBeVisible()
  await expect(page.getByTestId('miniatura-captura')).toBeVisible()

  const texto = cajaDe(await instruccion.boundingBox().then((caja) => caja!))
  const titulo = cajaDe(
    await page.getByText('Revisar propuesta').boundingBox().then((caja) => caja!),
  )
  const miniatura = cajaDe(
    await page.getByTestId('miniatura-captura').boundingBox().then((caja) => caja!),
  )
  const aprobar = cajaDe(
    await page.getByTestId('aprobar-captura').boundingBox().then((caja) => caja!),
  )
  const descartar = cajaDe(
    await page.getByTestId('descartar-captura').boundingBox().then((caja) => caja!),
  )

  expect(seSolapan(texto, aprobar)).toBe(false)
  expect(seSolapan(texto, descartar)).toBe(false)
  expect(seSolapan(titulo, aprobar)).toBe(false)
  expect(seSolapan(titulo, descartar)).toBe(false)
  expect(miniatura.right).toBeLessThanOrEqual(titulo.x + 1)
  expect(aprobar.bottom).toBeLessThanOrEqual(descartar.y + 1)
  expect(aprobar.x).toBeLessThan(descartar.right)
  expect(descartar.x).toBeLessThan(aprobar.right)
})

test('Descartar cierra la revisión en el móvil', async ({ page }) => {
  await abrirRevision(page, [LINEA_RESUELTA])
  await page.getByTestId('descartar-captura').click()
  await expect(page.getByTestId('revision-captura')).toHaveCount(0)
  await expect(page.getByText(INSTRUCCION)).toHaveCount(0)
})

test('Aprobar incorpora la línea al pedido en el móvil', async ({ page }) => {
  await page.addInitScript((productos) => {
    const peticion = indexedDB.open('suitpay', 1)
    peticion.onupgradeneeded = () => {
      const bd = peticion.result
      if (!bd.objectStoreNames.contains('pedido')) bd.createObjectStore('pedido')
      if (!bd.objectStoreNames.contains('catalogo'))
        bd.createObjectStore('catalogo')
    }
    peticion.onsuccess = () => {
      const bd = peticion.result
      const tx = bd.transaction('catalogo', 'readwrite')
      const almacen = tx.objectStore('catalogo')
      almacen.put({ version: 1, productos, guardadoEn: Date.now() }, 'catalogo')
    }
  }, CATALOGO)

  await abrirRevision(page, [LINEA_RESUELTA])
  await expect(page.getByTestId('aprobar-captura')).toBeEnabled()
  await page.getByTestId('aprobar-captura').click()
  await expect(page.getByTestId('revision-captura')).toHaveCount(0)
  await expect(page.getByText('TUBO PVC 1/2 PULGADA X 3M')).toBeVisible()
})
