import { deleteApp, initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

const FIRESTORE_EMULADOR = '127.0.0.1:8080'
const PROYECTO = 'demo-suitpay'
const UID = 'vendedor-de-prueba'

export interface VecinoE2E {
  readonly id: string
  readonly alias: string
}

const PRODUCTOS_E2E = [
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

function abrirAdmin() {
  process.env['FIRESTORE_EMULATOR_HOST'] = FIRESTORE_EMULADOR
  process.env['GOOGLE_CLOUD_PROJECT'] = PROYECTO
  return initializeApp(
    { projectId: PROYECTO },
    `e2e-vecino-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  )
}

/** Publica el catálogo mínimo que usa el combobox en e2e. */
export async function sembrarCatalogoDeVecinoE2E(): Promise<void> {
  const aplicacion = abrirAdmin()
  try {
    const base = getFirestore(aplicacion)
    await base.collection('catalogo').doc('actual').set({
      version: 1,
      productos: PRODUCTOS_E2E,
      categorias: [],
    })
    await base.collection('indices').doc('clientes').set({
      version: 1,
      clientes: [],
    })
    await base.collection('config').doc('parametros').set({
      umbralIdentificacionBoleta: 70_000,
      ventanaAnulacion: 'mismo_dia',
      formatoImpresionPorDefecto: 'a4',
    })
  } finally {
    await deleteApp(aplicacion)
  }
}

/** Siembra un vecino legado (sin diaCivilLineas/totalDeudas) en el emulador. */
export async function sembrarVecinoLegado(alias: string): Promise<VecinoE2E> {
  const aplicacion = abrirAdmin()
  try {
    const base = getFirestore(aplicacion)
    const referencia = base.collection('cotizaciones').doc()
    await referencia.set({
      numero: 8000 + Math.floor(Math.random() * 1000),
      estado: 'pendiente',
      canal: 'vecino',
      aliasVecino: alias,
      cliente: {
        tipoDocumento: 'RUC',
        numeroDocumento: '20123456789',
        denominacion: 'Vecino E2E',
      },
      lineas: [],
      total: 0,
      generacionPedido: 0,
      creadoPor: UID,
      creadoEn: Timestamp.now(),
      actualizadoEn: Timestamp.now(),
    })
    return { id: referencia.id, alias }
  } finally {
    await deleteApp(aplicacion)
  }
}
