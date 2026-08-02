import { cert, deleteApp, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import type { App } from 'firebase-admin/app'
import type { Firestore } from 'firebase-admin/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { AlmacenFirestore } from '../../src/server/emision/almacen-firestore.ts'
import { idDeSerie } from '../../src/server/emision/almacen.ts'
import { reclamarCorrelativo } from '../../src/server/emision/series.ts'
import { COLECCIONES } from '../../src/server/firebase/admin.ts'

/**
 * El comprobante y el correlativo se mueven juntos o no se mueven.
 *
 * ## Por qué esta prueba no puede hacerse en memoria
 *
 * `AlmacenEnMemoria` simula transacciones, y las pruebas que corren sobre él
 * afirman cosas valiosas sobre la lógica de emisión. Pero lo que se verifica aquí
 * no es la lógica: es que **Firestore de verdad** se comporte como la lógica
 * supone. Un simulador que yo escribí y que se ajusta a lo que yo espero no puede
 * demostrar eso; solo demostraría que soy consistente conmigo mismo.
 *
 * Concretamente hay dos supuestos que solo Firestore puede confirmar. El primero
 * es que `tx.create` sobre un documento existente falla en lugar de sobrescribir,
 * que es el mecanismo entero de la idempotencia (FR-028): si sobrescribiera, dos
 * pulsaciones dejarían un solo documento pero con el segundo correlativo, y la
 * numeración quedaría con un hueco. El segundo es que un fallo a mitad de la
 * transacción deja el contador de la serie intacto; si Firestore aplicara las
 * escrituras parciales, cada error de red gastaría un número.
 *
 * ## Por qué se conecta con el Admin SDK y no con las utilidades de reglas
 *
 * `reglas.test.ts` usa `@firebase/rules-unit-testing` porque su asunto son las
 * reglas. Aquí el asunto es lo contrario: el camino privilegiado del servidor, que
 * es el único autorizado a escribir un comprobante. Se conecta como se conectará
 * en producción, con el Admin SDK, y solo cambia el destino.
 */

const EMULADOR = { host: '127.0.0.1', puerto: 8080 }
const PROYECTO = 'demo-suitpay'
const VENDEDOR = 'vendedor-1'
const SERIE = idDeSerie(VENDEDOR, 'boleta')

async function emuladorEscuchando(): Promise<boolean> {
  try {
    await fetch(`http://${EMULADOR.host}:${EMULADOR.puerto}/`)
    return true
  } catch {
    return false
  }
}

const hayEmulador = await emuladorEscuchando()

if (!hayEmulador) {
  console.warn(
    '\n  AVISO: la transacción de emisión NO se verificó contra Firestore.\n' +
      `  No hay emulador en ${EMULADOR.host}:${EMULADOR.puerto}. Requiere Java.\n` +
      '  Arráncalo con: npm run emuladores\n',
  )
}

const describeConEmulador = describe.skipIf(!hayEmulador)

let aplicacion: App
let base: Firestore
let almacen: AlmacenFirestore

beforeAll(() => {
  if (!hayEmulador) return

  // El Admin SDK enruta al emulador con esta variable y no hace falta tocar nada
  // más. La credencial es un relleno: el emulador no la valida, pero el SDK exige
  // que haya una.
  process.env['FIRESTORE_EMULATOR_HOST'] = `${EMULADOR.host}:${EMULADOR.puerto}`

  // El emulador no valida la firma; el SDK sí exige PEM parseable (PKCS#8).
  const claveDeRelleno = `-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDUjQdP2FUPF1h+
0S9Dkbm6UTgeOXXbjmcCXPx/YEjFOd8S3w95LyPcnzAozjAVvm0pklNVmmtukCLz
OjGWP5EopjzCjI7w5WL8ac4lF8CC+bSpzTkh4BisfpY6PBNGm9Jk0l+Ex0r6Zriu
Fa/Mg5rhcRB8pBaPNofVqqA7MGO2hELUuVy6qrfz8bAAmY0gthEtMnBrDuoKk84v
hAK+JgRr57ZbLvZbrKG2XMJ2qkC1tdwFm3Ck5go1fgIK8eA3ADQiUAGTmUzZ/poa
hAP1nVrgrsNFDjSNvA+BOpsFMyKQ/yZGycqa5Pxl8t3tzhvMTQOQcFgPr2Y8cEOc
gl1hnArHAgMBAAECggEAI9yloq2j8FdmiYMe394rAYopl0PnpEM7ExWATrd+n7Q7
dJIpKK+w88zyEbh0OX73KR/0qolS3gU4uGQVsL2J7ttZfhO8HF3/nQn3C6AdzZt3
BX1ISfRnBVeYXjv7npq03Wj3T85WUrhZKZokHrQHwkjS2MzQt5oiQgU3YrUv5b/N
HWY5YFIx1/HYwK9ZvFurk/47C4EDdNP+7b++jyN7r76/USRHALPWKVdaROzlCkfV
1A4ROQ6oNRadK2r8uPK/cH+ZxUsDdHu4sZ2rWEfCr8rRL452P00vYN20S+SbK+i2
M2dPF/aMHVG94RJS6JNMh9qFi1KzSZVbKuEsvLPHqQKBgQD7YNUVEgSND27K3gSk
AFMlvKvgn6mLnvLQvvL+WHgdocfPL5UfTC8iqWPSgbR5DzCro5VtubaT+S1Zs3vU
ZdnM4JzSJ5DXUJDAF0LaQCB1zH/Cci2LTPs+5LqnoXpJ4oTlQH2Kj3JuUgcMyDXi
HL8T6Ch4ACpexJ+INaoxiBAfCQKBgQDYdXJVGOj6xMEcVu/XP6G+Sjm+UvKnLach
fioCErnLQcM5rIrMuUboYBBFjcrSm9axKrRz/R6COPZTQiV2oP7CNshxoHQY5TXA
PK9+SIWcuoFgo9dqpQZYzNDFA7DnZOR+oO2JXxdhu9r7KPJpzB5saxnl98iSXDEq
J29/7ZV/TwKBgBSsnBnFh5ZKZKROqjcKx8vcvo4U047mHbZJXhbJE+fr/FDv6uXO
EDpbkBgqDru+IhSbuZhyo6972Nz9w/tt/QG6n2sxUdpDiAQkZZ0plQHbNc66MUC5
rhg4G5nZ0ALvnFp2eVzB+3lTSb0lYjkcgCKU/28PJGzy4uQC9eJo/FpxAoGAFfr/
LDMGXYijT3xoiIQWqZsh9/i2WVGieh00qNc79K7t4yppQdbCo5A1tspqQS7AA2eh
wXF/qpucL+I0qbI5jIFBo4A2qdyEs8u1ym4U21B5GNYqZtLxLQ1HWepBCY5OQamX
1W5Jkowf9Yc37pRitoG9tIOP44TnHS+5+9SlbLMCgYAjhnKgyOke4WdyNAiCdbhX
Cxc+//3au9CrY8N5tlbMeW/V0ffdespsd+JmQpxAJRDJqBl2QvFXPffuLDK7chmD
GfRv2W74+j60JOzQ3wDmT/Tb0pt+L7gsQUjTupv+dQOUzjAyUdY917oCfgpzgd9M
QLTGBd1yeqphojuTlB37jQ==
-----END PRIVATE KEY-----`

  aplicacion = initializeApp(
    {
      projectId: PROYECTO,
      credential: cert({
        projectId: PROYECTO,
        clientEmail: `prueba@${PROYECTO}.iam.gserviceaccount.com`,
        privateKey: claveDeRelleno,
      }),
    },
    'prueba-transaccion',
  )

  base = getFirestore(aplicacion)
  almacen = new AlmacenFirestore(base)
})

afterAll(async () => {
  if (!hayEmulador) return
  await deleteApp(aplicacion)
})

async function vaciar(coleccion: string): Promise<void> {
  const documentos = await base.collection(coleccion).listDocuments()
  await Promise.all(documentos.map((cada) => cada.delete()))
}

beforeEach(async () => {
  if (!hayEmulador) return
  await vaciar(COLECCIONES.comprobantes)
  await vaciar(COLECCIONES.series)

  await base.collection(COLECCIONES.series).doc(SERIE).set({
    serie: 'B001',
    tipoDocumento: 'boleta',
    vendedorId: VENDEDOR,
    numeroInicial: 1,
    ultimoNumero: 0,
    ultimoNumeroConfirmado: 0,
    activa: true,
  })
})

function comprobanteDe(numero: number, clave: string) {
  return {
    id: clave,
    estado: 'reclamado' as const,
    tipoDocumento: 'boleta' as const,
    serie: 'B001',
    numero,
    cliente: null,
    lineas: [
      {
        codigo: 'TUB-1-2',
        descripcion: 'TUBO PVC 1/2 PULGADA',
        unidad: 'UND',
        cantidad: 2,
        precio: 1_250,
        importe: 2_500,
      },
    ],
    total: 2_500,
    condicionPago: {
      tipo: 'contado' as const,
      fechaVencimiento: null,
      estadoCobro: 'no_aplica' as const,
    },
    medioPago: { medio: 'efectivo', montoRecibido: 2_500 },
    vendedorId: VENDEDOR,
    emitidoEn: new Date('2026-07-28T15:00:00Z'),
    proveedor: null,
    cotizacionId: null,
    capturaId: null,
    contacto: null,
    intentos: [],
    anulacion: null,
  }
}

async function ultimoNumeroDeLaSerie(): Promise<number> {
  const serie = await almacen.leerSerie(SERIE)
  return serie?.ultimoNumero ?? -1
}

describeConEmulador('la transacción de emisión sobre Firestore', () => {
  it('el comprobante y el correlativo quedan escritos a la vez', async () => {
    await almacen.enTransaccion(async (tx) => {
      const reclamo = await reclamarCorrelativo(tx, VENDEDOR, 'boleta')
      tx.crearComprobante(comprobanteDe(reclamo.numero, 'clave-feliz'))
    })

    const comprobante = await almacen.leerComprobante('clave-feliz')
    expect(comprobante?.numero).toBe(1)
    expect(await ultimoNumeroDeLaSerie()).toBe(1)
  })

  it('un fallo a mitad deja la serie intacta y no crea el comprobante', async () => {
    // Es la propiedad que impide que un error de red gaste un número de la
    // numeración. Sin ella cada fallo dejaría un hueco que hay que justificar.
    await expect(
      almacen.enTransaccion(async (tx) => {
        const reclamo = await reclamarCorrelativo(tx, VENDEDOR, 'boleta')
        tx.crearComprobante(comprobanteDe(reclamo.numero, 'clave-que-falla'))
        throw new Error('se cayó la luz justo aquí')
      }),
    ).rejects.toThrow('se cayó la luz')

    expect(await ultimoNumeroDeLaSerie()).toBe(0)
    expect(await almacen.leerComprobante('clave-que-falla')).toBeUndefined()
  })

  it('crear dos veces la misma clave falla en lugar de sobrescribir', async () => {
    // El mecanismo entero de la idempotencia descansa en esto. Si `create`
    // sobrescribiera, la segunda pulsación reemplazaría el comprobante con otro
    // número y el primero desaparecería del registro.
    await almacen.enTransaccion(async (tx) => {
      const reclamo = await reclamarCorrelativo(tx, VENDEDOR, 'boleta')
      tx.crearComprobante(comprobanteDe(reclamo.numero, 'clave-repetida'))
    })

    await expect(
      almacen.enTransaccion(async (tx) => {
        const reclamo = await reclamarCorrelativo(tx, VENDEDOR, 'boleta')
        tx.crearComprobante(comprobanteDe(reclamo.numero, 'clave-repetida'))
      }),
    ).rejects.toThrow()

    const comprobante = await almacen.leerComprobante('clave-repetida')
    expect(comprobante?.numero).toBe(1)

    // Y el correlativo tampoco avanzó: el rechazo del `create` deshizo también el
    // incremento, así que la segunda pulsación no gastó el número 2.
    expect(await ultimoNumeroDeLaSerie()).toBe(1)
  })

  it('dos emisiones simultáneas obtienen números distintos', async () => {
    // Dos vendedores sobre la misma serie es lo normal en un mostrador con dos
    // puestos. Firestore reintenta la transacción perdedora, y el resultado tiene
    // que ser 1 y 2, nunca 1 y 1.
    await Promise.all([
      almacen.enTransaccion(async (tx) => {
        const reclamo = await reclamarCorrelativo(tx, VENDEDOR, 'boleta')
        tx.crearComprobante(comprobanteDe(reclamo.numero, 'clave-a'))
      }),
      almacen.enTransaccion(async (tx) => {
        const reclamo = await reclamarCorrelativo(tx, VENDEDOR, 'boleta')
        tx.crearComprobante(comprobanteDe(reclamo.numero, 'clave-b'))
      }),
    ])

    const a = await almacen.leerComprobante('clave-a')
    const b = await almacen.leerComprobante('clave-b')
    const numeros = [a?.numero, b?.numero].sort()

    expect(numeros).toEqual([1, 2])
    expect(await ultimoNumeroDeLaSerie()).toBe(2)
  })

  it('la serie desactivada se rechaza sin tocar el contador', async () => {
    await base.collection(COLECCIONES.series).doc(SERIE).update({ activa: false })

    await expect(
      almacen.enTransaccion(async (tx) => {
        await reclamarCorrelativo(tx, VENDEDOR, 'boleta')
      }),
    ).rejects.toMatchObject({ codigo: 'serie_no_configurada' })

    expect(await ultimoNumeroDeLaSerie()).toBe(0)
  })
})
