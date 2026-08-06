import { cert, deleteApp, initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import type { App } from 'firebase-admin/app'
import type { Firestore } from 'firebase-admin/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { AlmacenFirestore } from '../../src/server/emision/almacen-firestore.ts'
import { idDeSerie } from '../../src/server/emision/almacen.ts'
import { reclamarCorrelativo } from '../../src/server/emision/series.ts'
import { COLECCIONES } from '../../src/server/firebase/admin.ts'

/**
 * T108 — la cotización pasa a `convertida` en la misma transacción que crea
 * el comprobante; un fallo deja ambos sin efecto.
 */

const EMULADOR = { host: '127.0.0.1', puerto: 8080 }
const PROYECTO = 'demo-suitpay'
const VENDEDOR = 'vendedor-1'
const SERIE = idDeSerie(VENDEDOR, 'boleta')
const COTIZACION_ID = 'cot-tx-atomica'

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
    '\n  AVISO: cotizacion-transaccion NO se verificó (sin emulador).\n',
  )
}

const describeConEmulador = describe.skipIf(!hayEmulador)

let aplicacion: App
let base: Firestore
let almacen: AlmacenFirestore

beforeAll(() => {
  if (!hayEmulador) return

  process.env['FIRESTORE_EMULATOR_HOST'] = `${EMULADOR.host}:${EMULADOR.puerto}`

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
    'prueba-cotizacion-transaccion',
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
  await vaciar(COLECCIONES.cotizaciones)

  await base.collection(COLECCIONES.series).doc(SERIE).set({
    serie: 'B001',
    tipoDocumento: 'boleta',
    vendedorId: VENDEDOR,
    numeroInicial: 1,
    ultimoNumero: 0,
    ultimoNumeroConfirmado: 0,
    activa: true,
  })

  await base.collection(COLECCIONES.cotizaciones).doc(COTIZACION_ID).set({
    numero: 2002,
    estado: 'pendiente',
    cliente: null,
    lineas: [],
    total: 2_500,
    creadoPor: VENDEDOR,
    creadoEn: Timestamp.now(),
    comprobanteId: null,
    convertidaEn: null,
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
    cotizacionId: COTIZACION_ID,
    capturaId: null,
    contacto: null,
    intentos: [],
    anulacion: null,
  }
}

describeConEmulador('transacción de conversión de cotización', () => {
  it('marca convertida y crea el comprobante en el mismo acto', async () => {
    await almacen.enTransaccion(async (tx) => {
      const reclamo = await reclamarCorrelativo(tx, VENDEDOR, 'boleta')
      tx.crearComprobante(comprobanteDe(reclamo.numero, 'clave-atomica'))
      tx.marcarCotizacionConvertida(COTIZACION_ID, 'clave-atomica')
    })

    const comprobante = await almacen.leerComprobante('clave-atomica')
    expect(comprobante?.id).toBe('clave-atomica')

    const cotizacion = await base
      .collection(COLECCIONES.cotizaciones)
      .doc(COTIZACION_ID)
      .get()
    expect(cotizacion.data()?.['estado']).toBe('convertida')
    expect(cotizacion.data()?.['comprobanteId']).toBe('clave-atomica')
  })

  it('un fallo a mitad deja la cotización pendiente y sin comprobante', async () => {
    await expect(
      almacen.enTransaccion(async (tx) => {
        const reclamo = await reclamarCorrelativo(tx, VENDEDOR, 'boleta')
        tx.crearComprobante(comprobanteDe(reclamo.numero, 'clave-abortada'))
        tx.marcarCotizacionConvertida(COTIZACION_ID, 'clave-abortada')
        throw new Error('corte a mitad de la conversión')
      }),
    ).rejects.toThrow('corte a mitad')

    expect(await almacen.leerComprobante('clave-abortada')).toBeUndefined()

    const cotizacion = await base
      .collection(COLECCIONES.cotizaciones)
      .doc(COTIZACION_ID)
      .get()
    expect(cotizacion.data()?.['estado']).toBe('pendiente')
    expect(cotizacion.data()?.['comprobanteId']).toBeNull()
  })
})
