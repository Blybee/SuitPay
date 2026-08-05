import { cert, deleteApp, initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import type { App } from 'firebase-admin/app'
import type { Firestore } from 'firebase-admin/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { AlmacenFirestore } from '../../src/server/emision/almacen-firestore.ts'
import { anularComprobante } from '../../src/server/emision/anular.ts'
import { COLECCIONES } from '../../src/server/firebase/admin.ts'
import { ProveedorSimulado } from '../../src/server/proveedor/simulado.ts'

/**
 * T099 — tras anular, el documento sigue existiendo con estado, motivo, autor
 * y momento. Nunca se borra (FR-030).
 */

const EMULADOR = { host: '127.0.0.1', puerto: 8080 }
const PROYECTO = 'demo-suitpay'

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
    '\n  AVISO: anular-no-borra NO se verificó contra Firestore (sin emulador).\n',
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
    'prueba-anular-no-borra',
  )
  base = getFirestore(aplicacion)
  almacen = new AlmacenFirestore(base)
})

afterAll(async () => {
  if (!hayEmulador) return
  await deleteApp(aplicacion)
})

beforeEach(async () => {
  if (!hayEmulador) return
  const docs = await base.collection(COLECCIONES.comprobantes).listDocuments()
  await Promise.all(docs.map((doc) => doc.delete()))
})

describeConEmulador('anular no borra el documento', () => {
  it('deja el comprobante con estado anulado, motivo, autor y momento', async () => {
    const id = 'clave-anulacion-no-borra-001'
    const emitidoEn = new Date('2026-07-28T15:00:00.000Z')

    await base
      .collection(COLECCIONES.comprobantes)
      .doc(id)
      .set({
        estado: 'aceptado',
        tipoDocumento: 'boleta',
        serie: 'B001',
        numero: 42,
        cliente: null,
        lineas: [
          {
            codigo: 'TUB-1',
            descripcion: 'TUBO',
            unidad: 'UND',
            cantidad: 1,
            precio: 1000,
            importe: 1000,
          },
        ],
        total: 1000,
        condicionPago: {
          tipo: 'contado',
          fechaVencimiento: null,
          estadoCobro: 'no_aplica',
        },
        medioPago: { medio: 'efectivo', montoRecibido: 1000 },
        vendedorId: 'vendedor-1',
        emitidoEn: Timestamp.fromDate(emitidoEn),
        proveedor: {
          nombre: 'simulado',
          referenciaExterna: 'sim-1',
          estadoInformado: 'aceptado',
          pdf: null,
          xml: null,
          cdr: null,
        },
        cotizacionId: null,
        capturaId: null,
        contacto: null,
        intentos: [],
        anulacion: null,
      })

    await anularComprobante(
      {
        almacen,
        proveedor: new ProveedorSimulado(),
        ahora: () => new Date('2026-07-28T18:00:00.000Z'),
      },
      {
        comprobanteId: id,
        motivo: 'Error de tipografía en la descripción',
        autorId: 'vendedor-1',
      },
    )

    const instantanea = await base
      .collection(COLECCIONES.comprobantes)
      .doc(id)
      .get()

    expect(instantanea.exists).toBe(true)
    const datos = instantanea.data()
    expect(datos?.['estado']).toBe('anulado')
    expect(datos?.['anulacion']?.['motivo']).toBe(
      'Error de tipografía en la descripción',
    )
    expect(datos?.['anulacion']?.['autor']).toBe('vendedor-1')
    expect(datos?.['anulacion']?.['momento']).toBeDefined()
  })
})
