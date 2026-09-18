import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { entrarComoVendedorE2E } from './ayudas-sesion.ts'
import { sembrarCatalogoDeVecinoE2E, sembrarVecinoLegado } from './ayudas-vecino.ts'

/**
 * Alta de producto en Vecinos: combobox → Firestore, y conmutador de vista
 * (deudas → pedido de hoy) al agregar.
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

async function hayEmuladorDeAutenticacion(): Promise<boolean> {
  try {
    await fetch('http://127.0.0.1:9099/')
    return true
  } catch {
    return false
  }
}

async function hayEmuladorDeFirestore(): Promise<boolean> {
  try {
    await fetch('http://127.0.0.1:8080/')
    return true
  } catch {
    return false
  }
}

const hayEmulador =
  (await hayEmuladorDeAutenticacion()) && (await hayEmuladorDeFirestore())

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

function entradaDeBusqueda(pagina: Page) {
  return pagina.getByRole('combobox', { name: /Buscar producto/i })
}

async function agregarBuscando(pagina: Page, termino: string): Promise<void> {
  const entrada = entradaDeBusqueda(pagina)
  await entrada.fill(termino)
  const primera = pagina.getByRole('option').first()
  await expect(primera).toBeVisible({ timeout: 10_000 })
  await primera.click()
}

test.beforeEach(async ({ page }) => {
  await sembrarCatalogo(page)
})

test('el combobox agrega al vecino y desde deudas vuelve al pedido de hoy', async ({
  page,
}, info) => {
  test.skip(
    !hayEmulador,
    'Requiere la Emulator Suite (Java, T022). Ver npm run prueba:e2e:completa',
  )
  test.setTimeout(90_000)

  const alias = `e2e-${info.workerIndex}-${Math.random().toString(36).slice(2, 8)}`
  await sembrarCatalogoDeVecinoE2E()
  await sembrarVecinoLegado(alias)
  await entrarComoVendedorE2E(page)

  await page.getByRole('tab', { name: 'Vecinos' }).click()
  await expect(page.getByRole('tab', { name: alias })).toBeVisible({
    timeout: 15_000,
  })
  await page.getByRole('tab', { name: alias }).click()

  await agregarBuscando(page, 'pvc tubo')
  await expect(page.getByText(/TUBO PVC 1\/2 PULGADA/i)).toBeVisible({
    timeout: 10_000,
  })
  await expect(
    page.getByRole('status').filter({ hasText: /No se pudieron guardar/ }),
  ).toHaveCount(0)

  await page.getByRole('button', { name: 'Ver deudas' }).click()
  await expect(page.getByText('No hay deudas.')).toBeVisible()

  await agregarBuscando(page, '90 codo')
  await expect(page.getByRole('button', { name: 'Ver deudas' })).toBeVisible({
    timeout: 10_000,
  })
  await expect(page.getByText(/CODO PVC 90 GRADOS/i)).toBeVisible({
    timeout: 10_000,
  })
  await expect(page.getByText(/TUBO PVC 1\/2 PULGADA/i)).toBeVisible()
})
