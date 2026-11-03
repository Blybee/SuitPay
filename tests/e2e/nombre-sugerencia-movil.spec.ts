import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

/**
 * El listbox del buscador, en un teléfono de 390px.
 *
 * El DOM guarda el nombre entero aunque la fila lo pinte con «…». Por eso
 * esta prueba mide cajas y no se fía del textContent.
 */

const NOMBRE = 'FIV- VALVULA CHECK SWING BRC. ROSCADA 1/2 PULGADA HEMBRA'
const CODIGO = '410820'
const UNIDAD = 'NIU'
const PRECIO = '18.50'
const PRODUCTOS = [
  {
    codigo: CODIGO,
    descripcion: NOMBRE,
    unidad: UNIDAD,
    precio: 1_850,
    activo: true,
  },
  {
    codigo: '410900',
    descripcion: 'FIV- TUERCA HEXAGONAL',
    unidad: 'NIU',
    precio: 90,
    activo: true,
  },
]

test.use({ viewport: { width: 390, height: 844 } })

test('el nombre largo de la sugerencia se lee entero y el precio queda arriba', async ({
  page,
}) => {
  await cortarCatalogoRemoto(page)
  await sembrarSesion(page)
  await page.goto('/')
  await expect(
    page.getByRole('combobox', { name: /Buscar producto/i }),
  ).toBeVisible()
  await sembrarCatalogo(page)
  await page.reload()

  const entrada = page.getByRole('combobox', { name: /Buscar producto/i })
  await expect(entrada).toBeVisible()
  await entrada.fill('Fiv check swing 1/2')

  const listbox = page.getByRole('listbox')
  const opcion = listbox.getByRole('option', { name: new RegExp(CODIGO) })
  await expect(opcion).toBeVisible()
  await expect(opcion).toContainText(NOMBRE)
  await expect(opcion).toContainText(`${CODIGO} · ${UNIDAD}`)
  await expect(opcion).toContainText(PRECIO)

  await listbox.screenshot({
    path: 'test-results/nombre-sugerencia-lista.png',
  })

  const nombre = opcion.getByText(NOMBRE, { exact: true })
  const medida = await medirNombre(nombre)
  expect(medida.texto, 'el nodo debe ser el nombre completo').toBe(NOMBRE)
  expect(
    medida.lineas,
    'en 390px el nombre largo ocupa más de una línea',
  ).toBeGreaterThan(1.4)
  expect(medida.recorteHorizontal, 'no cabe en una línea con ellipsis').toBe(
    false,
  )
  expect(medida.recorteVertical, 'la fila no debe recortar el nombre').toBe(
    false,
  )
  expect(medida.ellipsisDeUnaLinea, 'text-overflow ellipsis').toBe(false)
  expect(medida.lineClamp, 'line-clamp').toBe(false)
  expect(medida.ancestroRecorta, 'un ancestro recorta el nombre').toBe(false)

  const cajas = await cajasDeLaFila(
    opcion,
    NOMBRE,
    `${CODIGO} · ${UNIDAD}`,
    PRECIO,
  )
  expect(cajas.precio.left).toBeGreaterThan(cajas.nombre.left)
  expect(cajas.nombre.right).toBeLessThanOrEqual(cajas.precio.left + 1)
  expect(cajas.precio.top).toBeLessThanOrEqual(
    cajas.nombre.top + cajas.altoLinea,
  )
  expect(cajas.codigo.top).toBeGreaterThanOrEqual(cajas.nombre.bottom - 1)

  await entrada.fill('fiv')
  const larga = listbox.getByRole('option', { name: new RegExp(CODIGO) })
  const corta = listbox.getByRole('option', { name: /410900/ })
  await expect(larga).toBeVisible()
  await expect(corta).toBeVisible()
  const solape = await larga.evaluate((fila, codigoVecino) => {
    const otra = Array.from(
      fila.parentElement?.querySelectorAll('[role="option"]') ?? [],
    ).find((candidato) => candidato.textContent?.includes(codigoVecino))
    if (otra === undefined) return true
    const a = fila.getBoundingClientRect()
    const b = otra.getBoundingClientRect()
    const arriba = Math.max(a.top, b.top)
    const abajo = Math.min(a.bottom, b.bottom)
    return abajo - arriba > 1
  }, '410900')
  expect(solape, 'las filas de altura distinta no deben montarse').toBe(false)
})

async function cortarCatalogoRemoto(pagina: Page): Promise<void> {
  await pagina.route('**/*', (ruta) => {
    const url = ruta.request().url()
    if (
      url.includes('127.0.0.1:8080') ||
      url.includes('localhost:8080') ||
      url.includes('firestore.googleapis.com')
    ) {
      return ruta.abort()
    }
    return ruta.continue()
  })
}

async function sembrarSesion(pagina: Page): Promise<void> {
  await pagina.addInitScript(() => {
    sessionStorage.setItem(
      'suitpay:e2e-sesion',
      JSON.stringify({
        uid: 'vendedor-e2e-nombre',
        nombre: 'Vendedor E2E',
        correo: 'vendedor-e2e@suitpay.local',
        rol: 'vendedor',
        activo: true,
      }),
    )
  })
}

async function sembrarCatalogo(pagina: Page): Promise<void> {
  await pagina.evaluate(async (productos) => {
    await new Promise<void>((resolver, rechazar) => {
      const peticion = indexedDB.open('suitpay', 2)
      peticion.onerror = () => rechazar(peticion.error)
      peticion.onupgradeneeded = () => {
        const bd = peticion.result
        if (!bd.objectStoreNames.contains('pedido')) {
          bd.createObjectStore('pedido')
        }
        if (!bd.objectStoreNames.contains('catalogo')) {
          bd.createObjectStore('catalogo')
        }
        if (!bd.objectStoreNames.contains('audios')) {
          bd.createObjectStore('audios', { keyPath: 'id' })
        }
      }
      peticion.onsuccess = () => {
        const bd = peticion.result
        const tx = bd.transaction('catalogo', 'readwrite')
        const almacen = tx.objectStore('catalogo')
        almacen.put(
          {
            version: 1,
            productos,
            categorias: [],
            guardadoEn: Date.now(),
          },
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
        tx.oncomplete = () => resolver()
        tx.onerror = () => rechazar(tx.error)
      }
    })
  }, PRODUCTOS)
}

interface MedidaDelNombre {
  readonly texto: string
  readonly lineas: number
  readonly recorteHorizontal: boolean
  readonly recorteVertical: boolean
  readonly ellipsisDeUnaLinea: boolean
  readonly lineClamp: boolean
  readonly ancestroRecorta: boolean
}

async function medirNombre(nombre: Locator): Promise<MedidaDelNombre> {
  return nombre.evaluate((el) => {
    const estilo = getComputedStyle(el)
    const altoLinea = Number.parseFloat(estilo.lineHeight)
    const alto = el.getBoundingClientRect().height
    const clamp = estilo.getPropertyValue('-webkit-line-clamp').trim()
    const caja = el.getBoundingClientRect()
    let ancestroRecorta = false
    let nodo = el.parentElement
    while (nodo) {
      const s = getComputedStyle(nodo)
      const oculta =
        s.overflow === 'hidden' ||
        s.overflowX === 'hidden' ||
        s.overflowY === 'hidden'
      if (oculta) {
        const limite = nodo.getBoundingClientRect()
        if (
          caja.bottom > limite.bottom + 1 ||
          caja.right > limite.right + 1 ||
          caja.left < limite.left - 1
        ) {
          ancestroRecorta = true
          break
        }
      }
      if (nodo.getAttribute('role') === 'listbox') break
      nodo = nodo.parentElement
    }
    const unaLinea =
      estilo.whiteSpace === 'nowrap' || estilo.whiteSpace === 'pre'
    return {
      texto: el.textContent ?? '',
      lineas: altoLinea > 0 ? alto / altoLinea : 0,
      recorteHorizontal: el.scrollWidth > el.clientWidth + 1,
      recorteVertical: el.scrollHeight > el.clientHeight + 1,
      ellipsisDeUnaLinea: estilo.textOverflow === 'ellipsis' && unaLinea,
      lineClamp: clamp !== '' && clamp !== 'none' && clamp !== '0',
      ancestroRecorta,
    }
  })
}

interface Caja {
  readonly top: number
  readonly left: number
  readonly right: number
  readonly bottom: number
}

async function cajasDeLaFila(
  opcion: Locator,
  nombre: string,
  codigo: string,
  precio: string,
): Promise<{ nombre: Caja; codigo: Caja; precio: Caja; altoLinea: number }> {
  return opcion.evaluate(
    (raiz, args) => {
      function cajaDe(texto: string): Caja {
        const nodo = Array.from(raiz.querySelectorAll('span')).find(
          (candidato) => candidato.textContent === texto,
        )
        if (nodo === undefined) {
          throw new Error(`No está el texto «${texto}»`)
        }
        const rect = nodo.getBoundingClientRect()
        return {
          top: rect.top,
          left: rect.left,
          right: rect.right,
          bottom: rect.bottom,
        }
      }
      const nodoNombre = Array.from(raiz.querySelectorAll('span')).find(
        (candidato) => candidato.textContent === args.nombre,
      )
      const altoLinea = nodoNombre
        ? Number.parseFloat(getComputedStyle(nodoNombre).lineHeight)
        : 0
      return {
        nombre: cajaDe(args.nombre),
        codigo: cajaDe(args.codigo),
        precio: cajaDe(args.precio),
        altoLinea,
      }
    },
    { nombre, codigo, precio },
  )
}
