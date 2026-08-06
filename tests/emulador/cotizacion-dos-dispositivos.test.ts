import { cert, deleteApp, initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import type { App } from 'firebase-admin/app'
import type { Firestore } from 'firebase-admin/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { AlmacenFirestore } from '../../src/server/emision/almacen-firestore.ts'
import { idDeSerie } from '../../src/server/emision/almacen.ts'
import { emitirComprobante } from '../../src/server/emision/emitir.ts'
import type { ContextoDeEmision } from '../../src/server/emision/emitir.ts'
import { COLECCIONES } from '../../src/server/firebase/admin.ts'
import { ProveedorSimulado } from '../../src/server/proveedor/simulado.ts'
import { esErrorDeSuitPay } from '../../src/server/errores.ts'

/**
 * T107 — dos claves de idempotencia distintas sobre la misma cotización
 * producen un solo comprobante. La segunda recibe `cotizacion_ya_convertida`.
 *
 * Es el hueco que la clave de idempotencia por sí sola no cubre (FR-019).
 */

const EMULADOR = { host: '127.0.0.1', puerto: 8080 }
const PROYECTO = 'demo-suitpay'
const VENDEDOR = 'vendedor-1'
const SERIE = idDeSerie(VENDEDOR, 'boleta')
const COTIZACION_ID = 'cot-carrera-dispositivos'

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
    '\n  AVISO: cotizacion-dos-dispositivos NO se verificó (sin emulador).\n',
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
    'prueba-cotizacion-dos-dispositivos',
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
    numero: 1001,
    estado: 'pendiente',
    cliente: null,
    lineas: [
      {
        codigo: 'TUB-1-2',
        descripcion: 'TUBO PVC 1/2 PULGADA',
        unidad: 'UND',
        cantidad: 2,
        precio: 1_250,
      },
    ],
    total: 2_500,
    creadoPor: VENDEDOR,
    creadoEn: Timestamp.now(),
    comprobanteId: null,
    convertidaEn: null,
  })
})

function contexto(): ContextoDeEmision {
  return {
    almacen,
    proveedor: new ProveedorSimulado(),
    vendedorId: VENDEDOR,
    umbralIdentificacion: 70_000,
    formatoImpresion: 'a4',
    ahora: () => new Date('2026-07-28T15:00:00Z'),
  }
}

function peticion(clave: string) {
  return {
    claveIdempotencia: clave,
    tipoDocumento: 'boleta' as const,
    cliente: null,
    lineas: [
      {
        codigo: 'TUB-1-2',
        descripcion: 'TUBO PVC 1/2 PULGADA',
        unidad: 'UND',
        cantidad: 2,
        precio: 1_250,
      },
    ],
    condicionPago: { tipo: 'contado' as const },
    medioPago: { medio: 'efectivo', montoRecibido: 2_500 },
    cotizacionId: COTIZACION_ID,
    capturaId: null,
  }
}

describeConEmulador('carrera entre dispositivos sobre una cotización', () => {
  it('dos claves distintas producen un solo comprobante', async () => {
    const primero = await emitirComprobante(contexto(), peticion('clave-escritorio'))
    expect(primero.comprobanteId).toBe('clave-escritorio')
    expect(primero.yaExistia).toBe(false)

    let errorDeLaSegunda: unknown
    try {
      await emitirComprobante(contexto(), peticion('clave-telefono'))
    } catch (error) {
      errorDeLaSegunda = error
    }

    expect(esErrorDeSuitPay(errorDeLaSegunda)).toBe(true)
    if (!esErrorDeSuitPay(errorDeLaSegunda)) return

    expect(errorDeLaSegunda.codigo).toBe('cotizacion_ya_convertida')
    expect(errorDeLaSegunda.detalle?.['comprobanteId']).toBe('clave-escritorio')

    const comprobantes = await base.collection(COLECCIONES.comprobantes).get()
    expect(comprobantes.size).toBe(1)

    const cotizacion = await base
      .collection(COLECCIONES.cotizaciones)
      .doc(COTIZACION_ID)
      .get()
    expect(cotizacion.data()?.['estado']).toBe('convertida')
    expect(cotizacion.data()?.['comprobanteId']).toBe('clave-escritorio')
  })
})
