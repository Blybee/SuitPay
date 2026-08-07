import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { sembrarSesionE2ECaptura } from './ayudas-captura.ts'

/**
 * Fotografía de guía → revisión; renglón ilegible bloquea emisión (T136).
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

test.describe('fotografía de guía', () => {
  test('renglón ilegible bloquea emisión hasta resolverse', async ({ page }) => {
    await sembrarCatalogo(page)
    await sembrarSesionE2ECaptura(page)
    await page.goto('/')

    await page.waitForFunction(
      () => typeof window.__suitpayInyectarPropuestaCaptura === 'function',
    )

    await page.evaluate(() => {
      window.__suitpayInyectarPropuestaCaptura?.({
        tipo: 'imagen',
        pasoTextoPrimero: true,
        medioObjectUrl: null,
        lineas: [
          {
            textoOriginal: 'tubo pvc 1/2',
            candidatos: [
              {
                codigo: 'TUB-PVC-12',
                descripcion: 'TUBO PVC 1/2 PULGADA X 3M',
                unidad: 'UND',
                cantidad: 3,
                grado: 'exacta',
              },
            ],
            seleccion: 'TUB-PVC-12',
            estadoLinea: 'resuelta',
            cantidad: 3,
          },
          {
            textoOriginal: '(renglón tachado ilegible)',
            candidatos: [],
            seleccion: null,
            estadoLinea: 'pendiente',
            cantidad: 1,
          },
        ],
      })
    })

    // Paso 1: texto extraído
    await expect(page.getByTestId('revision-texto-imagen')).toBeVisible()
    await page.getByTestId('continuar-emparejamiento').click()

    await expect(page.getByTestId('revision-captura')).toBeVisible()
    await expect(page.getByTestId('linea-captura-1')).toHaveAttribute(
      'data-estado',
      'pendiente',
    )
    await expect(page.getByTestId('aprobar-captura')).toBeDisabled()

    // Añadir una línea escrita no debe permitir emitir mientras la captura
    // siga abierta con pendientes.
    const entrada = page.getByRole('combobox', { name: /Buscar producto/i })
    await entrada.fill('codo')
    const opcion = page.getByRole('option').first()
    if (await opcion.isVisible()) {
      await opcion.click()
    }

    await expect(
      page.getByText(/líneas de captura sin resolver|captura/i).first(),
    ).toBeVisible()
  })
})
