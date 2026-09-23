import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { entrarComoVendedorE2E } from './ayudas-sesion.ts'
import { sembrarVecinoLegado } from './ayudas-vecino.ts'

const ORDEN_DE_LA_FOTO = [
  'CAJAS AZUL 1/16',
  'REGISTRO 2 GEMELLO',
  'SUMIDERO 2',
  'TAPON 2',
  'SUMIDERO 2 HELVEX',
  'CIENTO CONICO 1/2 NEOPRENE',
  'TRAMPA P GEMELLO',
  'UNION 1/2 BRONCE PESADO',
  'MEDIDOR AYON',
] as const

const FOTO = 'tests/e2e/fixtures/guia-pedido.jpg'
const ARTEFACTOS = '/opt/cursor/artifacts'

const CATALOGO = [...ORDEN_DE_LA_FOTO]
  .map((descripcion, indice) => ({
    codigo: `FOTO-${indice + 1}`,
    descripcion,
    unidad: 'NIU',
    precio: 100,
    activo: true,
  }))
  .sort((a, b) => a.descripcion.localeCompare(b.descripcion, 'es'))

async function hayEmulador(): Promise<boolean> {
  try {
    await fetch('http://127.0.0.1:9099/')
    await fetch('http://127.0.0.1:8080/')
    return true
  } catch {
    return false
  }
}

const emuladorListo = await hayEmulador()

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
      almacen.put(
        { version: 1, productos, categorias: [], guardadoEn: Date.now() },
        'catalogo',
      )
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

function lineasDeLaFoto() {
  return ORDEN_DE_LA_FOTO.map((descripcion, indice) => ({
    textoOriginal: `${indice + 1} ${descripcion}`,
    candidatos: [
      {
        codigo: `FOTO-${indice + 1}`,
        descripcion,
        unidad: 'NIU',
        cantidad: indice + 1,
        grado: 'exacta' as const,
      },
    ],
    seleccion: `FOTO-${indice + 1}`,
    estadoLinea: 'resuelta' as const,
    cantidad: indice + 1,
  }))
}

function nombreDe(texto: string): string {
  const porLargo = [...ORDEN_DE_LA_FOTO].sort((a, b) => b.length - a.length)
  return porLargo.find((nombre) => texto.includes(nombre)) ?? texto
}

async function ordenDe(localizador: ReturnType<Page['locator']>): Promise<string[]> {
  const textos = await localizador.allInnerTexts()
  return textos.map((texto) => nombreDe(texto.replace(/\s+/g, ' ')))
}

async function inyectarPropuesta(pagina: Page): Promise<void> {
  const foto = readFileSync(FOTO).toString('base64')
  await pagina.waitForFunction(
    () => typeof window.__suitpayInyectarPropuestaCaptura === 'function',
  )
  await pagina.evaluate(
    ({ lineas, fotoBase64 }) => {
      window.__suitpayInyectarPropuestaCaptura?.({
        tipo: 'imagen',
        pasoTextoPrimero: true,
        medioObjectUrl: `data:image/jpeg;base64,${fotoBase64}`,
        lineas,
      })
    },
    { lineas: lineasDeLaFoto(), fotoBase64: foto },
  )
}

async function aprobarPropuesta(pagina: Page): Promise<void> {
  await expect(pagina.getByTestId('revision-texto-imagen')).toBeVisible()
  await pagina.getByTestId('continuar-emparejamiento').click()
  await expect(pagina.getByTestId('revision-captura')).toBeVisible()
  const propuesta = await ordenDe(pagina.getByTestId(/^linea-captura-/))
  expect(propuesta).toEqual([...ORDEN_DE_LA_FOTO])
  await pagina.getByTestId('aprobar-captura').click()
  await expect(pagina.getByTestId('revision-captura')).toHaveCount(0)
}

function guardarOrden(nombre: string, orden: readonly string[]): void {
  mkdirSync(ARTEFACTOS, { recursive: true })
  const linea = `${nombre}\t${orden.join(' | ')}\n`
  const previo = (() => {
    try {
      return readFileSync(`${ARTEFACTOS}/orden-captura.log`, 'utf8')
    } catch {
      return ''
    }
  })()
  const resto = previo
    .split('\n')
    .filter((fila) => fila.length > 0 && !fila.startsWith(`${nombre}\t`))
  writeFileSync(
    `${ARTEFACTOS}/orden-captura.log`,
    [...resto, linea.trimEnd()].join('\n') + '\n',
  )
}

test.describe('orden de la foto al aprobar', () => {
  test.describe.configure({ mode: 'serial' })
  test.beforeEach(async ({ page }) => {
    test.skip(!emuladorListo, 'Requiere la Emulator Suite en 9099 y 8080.')
    await sembrarCatalogo(page)
  })

  test('Pedido conserva el orden de la foto', async ({ page }) => {
    test.setTimeout(90_000)
    await entrarComoVendedorE2E(page)
    await inyectarPropuesta(page)
    await aprobarPropuesta(page)
    const lineas = page.getByRole('listitem')
    await expect(lineas).toHaveCount(ORDEN_DE_LA_FOTO.length)
    const orden = await ordenDe(lineas)
    guardarOrden('pedido', orden)
    expect(orden).toEqual([...ORDEN_DE_LA_FOTO])
    mkdirSync(ARTEFACTOS, { recursive: true })
    await page.screenshot({
      path: `${ARTEFACTOS}/orden-pedido.png`,
      fullPage: true,
    })
  })

  test('Lista conserva el orden de la foto', async ({ page }) => {
    test.setTimeout(90_000)
    await entrarComoVendedorE2E(page)
    await page.getByRole('tab', { name: 'Lista' }).click()
    await inyectarPropuesta(page)
    await aprobarPropuesta(page)
    const filas = page.locator('tbody tr')
    await expect(filas).toHaveCount(ORDEN_DE_LA_FOTO.length, { timeout: 15_000 })
    const orden = await ordenDe(filas)
    guardarOrden('lista', orden)
    expect(orden).toEqual([...ORDEN_DE_LA_FOTO])
    mkdirSync(ARTEFACTOS, { recursive: true })
    await page.screenshot({
      path: `${ARTEFACTOS}/orden-lista.png`,
      fullPage: true,
    })
  })

  test('Vecinos conserva el orden de la foto', async ({ page }) => {
    test.setTimeout(90_000)
    const alias = 'obra-foto'
    await sembrarVecinoLegado(alias)
    await entrarComoVendedorE2E(page)
    await page.getByRole('tab', { name: 'Vecinos' }).click()
    await page.getByRole('tab', { name: alias }).click()
    await inyectarPropuesta(page)
    await aprobarPropuesta(page)
    const lineas = page.getByRole('listitem')
    await expect(lineas).toHaveCount(ORDEN_DE_LA_FOTO.length, { timeout: 15_000 })
    const orden = await ordenDe(lineas)
    guardarOrden('vecinos', orden)
    expect(orden).toEqual([...ORDEN_DE_LA_FOTO])
    mkdirSync(ARTEFACTOS, { recursive: true })
    await page.screenshot({
      path: `${ARTEFACTOS}/orden-vecinos.png`,
      fullPage: true,
    })
  })
})
