import { cert, deleteApp, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import type { App } from 'firebase-admin/app'
import type { Firestore } from 'firebase-admin/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { AlmacenFirestore } from '../../src/server/emision/almacen-firestore.ts'
import { idDeSerie } from '../../src/server/emision/almacen.ts'
import { emitirGuia } from '../../src/server/emision/emitir-guia.ts'
import { COLECCIONES } from '../../src/server/firebase/admin.ts'
import { ProveedorSimulado } from '../../src/server/proveedor/simulado.ts'
import { peticionGuia, trasladoPublico } from '../unit/server/guia-frontera.test.ts'

const EMULADOR = { host: '127.0.0.1', puerto: 8080 }
const PROYECTO = 'demo-suitpay'
const VENDEDOR = 'vendedor-1'
const SERIE = idDeSerie(VENDEDOR, 'guia')

async function emuladorEscuchando(): Promise<boolean> {
  try {
    await fetch(`http://${EMULADOR.host}:${EMULADOR.puerto}/`)
    return true
  } catch {
    return false
  }
}

const hayEmulador = await emuladorEscuchando()
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
    'prueba-guia',
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
  await Promise.all(docs.map((d) => d.delete()))
  const series = await base.collection(COLECCIONES.series).listDocuments()
  await Promise.all(series.map((d) => d.delete()))
  await base.collection(COLECCIONES.series).doc(SERIE).set({
    serie: 'T001',
    tipoDocumento: 'guia',
    vendedorId: VENDEDOR,
    numeroInicial: 1,
    ultimoNumero: 0,
    ultimoNumeroConfirmado: 0,
    activa: true,
  })
})

describeConEmulador('emisión de guía contra Firestore', () => {
  it('emite una guía pública y deja PDF', async () => {
    const proveedor = new ProveedorSimulado()
    const respuesta = await emitirGuia(
      {
        almacen,
        proveedor,
        vendedorId: VENDEDOR,
        formatoImpresion: 'a4',
      },
      peticionGuia(),
    )
    expect(respuesta.estado).toBe('aceptado')
    expect(respuesta.archivos.pdf).toBeTruthy()
    expect(respuesta.serie).toBe('T001')
  })

  it('indeterminado no se presenta como emitido', async () => {
    const proveedor = new ProveedorSimulado()
    proveedor.configurarEmision({ tipo: 'indeterminado' })
    await expect(
      emitirGuia(
        {
          almacen,
          proveedor,
          vendedorId: VENDEDOR,
          formatoImpresion: 'a4',
        },
        peticionGuia({
          traslado: trasladoPublico({
            modoTransporte: 'privado',
            transportista: undefined,
            conductor: {
              tipoDocumento: 'DNI',
              numeroDocumento: '12345678',
              nombres: 'PEREZ',
              licencia: 'Q1',
              placa: 'ABC-123',
            },
          }),
        }),
      ),
    ).rejects.toMatchObject({ codigo: 'emision_indeterminada' })
  })
})
