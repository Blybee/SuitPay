import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { sembrarSesionDeVendedor } from './ayudas-sesion.ts'

/**
 * La venta escrita, de principio a fin.
 *
 * Es el recorrido del principio IV: tomar el pedido escribiendo, sin apartar las
 * manos del teclado. Lo que se comprueba aquí no lo puede comprobar ninguna prueba
 * de unidad, porque son propiedades del conjunto.
 *
 * ## Las cuatro afirmaciones y por qué cada una está
 *
 * **Los términos desordenados encuentran el producto.** «pvc tubo» tiene que dar el
 * mismo resultado que «tubo pvc». Nadie teclea el nombre del catálogo en el orden
 * en que está escrito, y una búsqueda que exige el orden obliga a mirar la pantalla
 * mientras se escribe, que es exactamente lo que este sistema existe para evitar.
 *
 * **El precio se ajusta en el sitio.** FR-012. Se negocia al alza (o igual al
 * mayorista); si ajustarlo costara abrir un diálogo, el vendedor haría la cuenta a
 * mano y teclearía el total, que es como se pierde el detalle de la venta.
 *
 * **Cambiar de tipo no destruye el pedido.** FR-014. El cliente dice «mejor con
 * factura» cuando el pedido ya tiene diez líneas. Perderlas es inaceptable, y es un
 * fallo fácil de introducir sin notarlo, porque cambiar el tipo parece cambiar de
 * documento.
 *
 * **La doble pulsación produce un solo comprobante.** La más importante. El
 * servidor la resiste por la clave de idempotencia y eso lo prueba T042; lo que se
 * prueba aquí es que el cliente **no llegue a pedir dos veces**, porque el vendedor
 * nervioso con un cliente delante pulsa dos veces y contar con que el servidor lo
 * arregle deja la defensa en una sola capa.
 *
 * ## Por qué son dos pruebas y no una
 *
 * Las tres primeras afirmaciones son del cliente: catálogo en caché, aritmética y
 * estado del pedido. No necesitan sesión, ni Firestore, ni proveedor, y por eso
 * viven en una prueba que corre con solo un `.env` y `npm run prueba:e2e`.
 *
 * La cuarta necesita emitir de verdad, y emitir exige sesión con rol —FR-003— más
 * la transacción sobre Firestore. Eso pide la Emulator Suite, que pide Java (T022).
 * Está aparte para que la falta de Java no se lleve por delante la parte que sí se
 * puede comprobar; partirlas es lo que hace que tres cuartas partes de este
 * recorrido estén verificadas hoy en lugar de ninguna.
 *
 *     npm run prueba:e2e            solo la parte del cliente (proveedor real por omisión)
 *     npm run prueba:e2e:completa   todo, con emuladores
 *     PROVEEDOR_SIMULADO=true       fuerza el doble local en el webServer
 *
 * Lo que falta **se salta y lo dice**. Un fallo por falta de entorno se confunde con
 * un fallo del sistema, y una prueba que siempre está roja deja de leerse.
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

/**
 * Siembra el catálogo en IndexedDB antes de que arranque la aplicación.
 *
 * Se escribe con la API cruda de IndexedDB y no con los ayudantes de `infra/local`
 * porque este guion corre dentro de la página, antes de que exista ningún módulo de
 * la aplicación. El nombre de la base, la versión y las claves tienen que coincidir
 * con `src/infra/local/almacenes.ts`; si allí cambian, esto deja de sembrar y la
 * prueba falla al no encontrar productos, que es la forma correcta de enterarse.
 */
async function sembrarCatalogo(pagina: Page): Promise<void> {
  await pagina.addInitScript((productos) => {
    const peticion = indexedDB.open('suitpay', 1)

    peticion.onupgradeneeded = () => {
      const bd = peticion.result
      if (!bd.objectStoreNames.contains('pedido')) bd.createObjectStore('pedido')
      if (!bd.objectStoreNames.contains('catalogo')) bd.createObjectStore('catalogo')
    }

    peticion.onsuccess = () => {
      const bd = peticion.result
      const tx = bd.transaction('catalogo', 'readwrite')
      const almacen = tx.objectStore('catalogo')
      almacen.put({ version: 1, productos, guardadoEn: Date.now() }, 'catalogo')
      almacen.put({ version: 1, clientes: [], guardadoEn: Date.now() }, 'indice-de-clientes')
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

/**
 * ¿Está el emulador de autenticación en pie?
 *
 * Es el que decide si se puede emitir: sin sesión con rol el botón queda
 * inhabilitado con su motivo, y la prueba fallaría diciendo que no se puede emitir
 * cuando lo que falta es el emulador.
 */
async function hayEmuladorDeAutenticacion(): Promise<boolean> {
  try {
    await fetch('http://127.0.0.1:9099/')
    return true
  } catch {
    return false
  }
}

const hayEmulador = await hayEmuladorDeAutenticacion()

/**
 * La entrada de búsqueda.
 *
 * Se nombra en lugar de pedir el único `combobox`, porque el selector de medio de
 * pago del pie también lo es. Sin el nombre, esta prueba se rompería el día que
 * alguien añada cualquier desplegable a la pantalla.
 */
function entradaDeBusqueda(pagina: Page) {
  return pagina.getByRole('combobox', { name: /Buscar producto/i })
}

/** Añade un producto buscándolo y eligiendo la primera sugerencia. */
async function agregarBuscando(pagina: Page, termino: string): Promise<void> {
  const entrada = entradaDeBusqueda(pagina)
  await entrada.fill(termino)
  const primera = pagina.getByRole('option').first()
  await expect(primera).toBeVisible()
  await primera.click()
}

/** Deja el pedido de tres líneas con el precio ya ajustado. */
async function armarPedido(pagina: Page): Promise<void> {
  await pagina.goto('/')

  // La entrada tiene el foco al abrir: se puede teclear sin tocar nada.
  await expect(entradaDeBusqueda(pagina)).toBeFocused()

  // Los términos van en el orden que salga, que es como se teclea de verdad.
  await agregarBuscando(pagina, 'pvc tubo')
  await agregarBuscando(pagina, '90 codo')
  await agregarBuscando(pagina, '250 pegamento')

  await expect(pagina.getByRole('listitem')).toHaveCount(3)

  // 12,50 + 1,80 + 8,50 son 22,80.
  await expect(pagina.getByLabel('Total del pedido')).toHaveText('22.80')

  // Negociación al alza: el piso es el mayorista (12,50); 13,00 es válido.
  const precio = pagina.getByLabel('Precio de TUBO PVC 1/2 PULGADA X 3M')
  await precio.fill('13.00')
  await precio.blur()

  await expect(pagina.getByLabel('Total del pedido')).toHaveText('23.30')
}

test.beforeEach(async ({ page }) => {
  await sembrarCatalogo(page)
})

test('el pedido se toma escribiendo y sobrevive al cambio de tipo', async ({
  page,
}) => {
  await armarPedido(page)

  const lineas = page.getByRole('listitem')
  const total = page.getByLabel('Total del pedido')

  // Negociación al alza: el aviso de catálogo tachado solo sale bajo el piso.
  await expect(lineas.first().getByText(/catálogo/i)).toHaveCount(0)

  // --- Cambiar de boleta a factura conserva el pedido (FR-014) --------------
  await page.getByRole('radio', { name: 'Factura' }).click()
  await expect(lineas).toHaveCount(3)
  await expect(total).toHaveText('23.30')

  // Y ahora pide RUC, que es la otra mitad de FR-014: el pedido sobrevive y la
  // exigencia del tipo nuevo se aplica de inmediato.
  await expect(page.getByText(/necesita el RUC del cliente/i)).toBeVisible()

  // El viaje de vuelta tampoco destruye nada.
  await page.getByRole('radio', { name: 'Boleta de venta' }).click()
  await expect(lineas).toHaveCount(3)
  await expect(total).toHaveText('23.30')
})

test('la doble pulsación produce un solo comprobante', async ({ page }) => {
  test.skip(
    !hayEmulador,
    'Requiere la Emulator Suite (Java, T022). Ver npm run prueba:e2e:completa',
  )

  await sembrarSesionDeVendedor(page)
  await armarPedido(page)

  // Se escuchan las peticiones en lugar de interceptarlas: interceptar cambia el
  // momento en que se resuelven y podría enmascarar justamente la carrera que se
  // quiere observar. Aquí no se altera nada, solo se cuenta.
  let peticionesDeEmision = 0
  page.on('request', (peticion) => {
    if (peticion.method() === 'POST' && peticion.url().includes('_serverFn')) {
      peticionesDeEmision++
    }
  })

  const emitir = page.getByRole('button', { name: 'Emitir', exact: true })
  await emitir.click()

  // La segunda pulsación va con `force` a propósito: sin ella Playwright esperaría
  // a que el botón volviera a ser pulsable y no reproduciría el doble clic, que es
  // justo el gesto que se quiere reproducir. Se ignora su fallo porque encontrar
  // el botón ya inerte es el resultado correcto.
  await emitir.click({ force: true, timeout: 1_000 }).catch(() => undefined)

  await expect(page.getByText('Comprobante emitido')).toBeVisible({
    timeout: 15_000,
  })

  // La afirmación central: el cliente no llegó a pedir dos veces.
  expect(peticionesDeEmision).toBe(1)
})
