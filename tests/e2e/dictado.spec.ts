import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { sembrarSesionE2ECaptura } from './ayudas-captura.ts'

/**
 * Dictado → revisión → aprobar (T128).
 * Usa inyección de propuesta (asistencia simulada) para no depender del micrófono.
 */

const CATALOGO = [
  {
    codigo: 'TUB-PVC-12',
    descripcion: 'TUBO PVC 1/2 PULGADA X 3M',
    unidad: 'UND',
    precio: 1_250,
    activo: true,
  },
  {
    codigo: 'COD-90-12',
    descripcion: 'CODO PVC 90 GRADOS 1/2',
    unidad: 'UND',
    precio: 180,
    activo: true,
  },
  {
    codigo: 'PEG-250',
    descripcion: 'PEGAMENTO PVC 250 ML',
    unidad: 'UND',
    precio: 850,
    activo: true,
  },
]

async function sembrarCatalogo(pagina: Page): Promise<void> {
  await pagina.addInitScript((productos) => {
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
      almacen.put(
        { version: 1, clientes: [], guardadoEn: Date.now() },
        'indice-de-clientes',
      )
      almacen.put(
        {
          umbralIdentificacionBoleta: 70_000,
          ventanaAnulacion: 'mismo_dia',
          formatoImpresionPorDefecto: 'a4',
          guardadoEn: Date.now(),
        },
        'parametros',
      )
    }
  }, CATALOGO)
}

test.describe('dictado del pedido', () => {
  test('dictar tres productos, corregir una línea ambigua, aprobar', async ({
    page,
  }) => {
    await sembrarCatalogo(page)
    await sembrarSesionE2ECaptura(page)
    await page.goto('/')

    await expect(
      page.getByRole('combobox', { name: /Buscar producto/i }),
    ).toBeVisible()

    await page.waitForFunction(
      () => typeof window.__suitpayInyectarPropuestaCaptura === 'function',
    )

    await page.evaluate(() => {
      window.__suitpayInyectarPropuestaCaptura?.({
        tipo: 'audio',
        lineas: [
          {
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
          },
          {
            textoOriginal: 'codo noventa',
            candidatos: [
              {
                codigo: 'COD-90-12',
                descripcion: 'CODO PVC 90 GRADOS 1/2',
                unidad: 'UND',
                cantidad: 2,
                grado: 'aproximada',
              },
              {
                codigo: 'PEG-250',
                descripcion: 'PEGAMENTO PVC 250 ML',
                unidad: 'UND',
                cantidad: 2,
                grado: 'aproximada',
              },
            ],
            seleccion: null,
            estadoLinea: 'ambigua',
            cantidad: 2,
          },
          {
            textoOriginal: 'pegamento doscientos cincuenta',
            candidatos: [
              {
                codigo: 'PEG-250',
                descripcion: 'PEGAMENTO PVC 250 ML',
                unidad: 'UND',
                cantidad: 1,
                grado: 'exacta',
              },
            ],
            seleccion: 'PEG-250',
            estadoLinea: 'resuelta',
            cantidad: 1,
          },
        ],
      })
    })

    await expect(page.getByTestId('revision-captura')).toBeVisible()
    await expect(page.getByTestId('aprobar-captura')).toBeDisabled()

    await page.getByTestId('opciones-ambiguas').getByRole('button').first().click()
    await expect(page.getByTestId('aprobar-captura')).toBeEnabled()
    await page.getByTestId('aprobar-captura').click()

    await expect(page.getByTestId('revision-captura')).toHaveCount(0)
    await expect(page.getByRole('listitem')).toHaveCount(3)
    await expect(page.getByText('TUBO PVC 1/2 PULGADA X 3M')).toBeVisible()
    await expect(page.getByText('CODO PVC 90 GRADOS 1/2')).toBeVisible()
    await expect(page.getByText('PEGAMENTO PVC 250 ML')).toBeVisible()
  })
})
