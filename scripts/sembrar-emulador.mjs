/**
 * Siembra la Firebase Emulator Suite (proyecto demo-suitpay) para desarrollo y
 * pruebas manuales de la aplicacion SIN credenciales de nube ni token de
 * proveedor. Crea un vendedor y un administrador con sus claims, publica un
 * catalogo de ejemplo y deja los parametros por omision.
 *
 * A diferencia de `bootstrap-admin.mjs` (que usa Application Default Credentials
 * contra la nube real), este guion habla solo con los emuladores y por eso no
 * necesita `gcloud auth`. Es exclusivamente para desarrollo local.
 *
 * Uso (con los emuladores ya levantados, ver `npm run emuladores`):
 *
 *   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
 *   GOOGLE_CLOUD_PROJECT=demo-suitpay \
 *   node scripts/sembrar-emulador.mjs
 *
 * Credenciales sembradas:
 *   vendedor@suitpay.local / vendedor123   (rol vendedor)
 *   admin@suitpay.local    / admin1234     (rol administrador)
 */
import { initializeApp, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const PROYECTO = process.env.GOOGLE_CLOUD_PROJECT ?? 'demo-suitpay'

if (
  process.env.FIREBASE_AUTH_EMULATOR_HOST === undefined ||
  process.env.FIRESTORE_EMULATOR_HOST === undefined
) {
  console.error(
    'Faltan FIREBASE_AUTH_EMULATOR_HOST y/o FIRESTORE_EMULATOR_HOST. ' +
      'Este guion es solo para los emuladores. Ver el encabezado del archivo.',
  )
  process.exit(1)
}

const app = getApps()[0] ?? initializeApp({ projectId: PROYECTO })
const auth = getAuth(app)
const db = getFirestore(app)

async function crearUsuario(uid, correo, contrasena, nombre, rol) {
  await auth
    .getUser(uid)
    .catch(() =>
      auth.createUser({ uid, email: correo, password: contrasena, displayName: nombre }),
    )
  await auth.updateUser(uid, {
    password: contrasena,
    displayName: nombre,
    disabled: false,
  })
  await auth.setCustomUserClaims(uid, { rol, activo: true })
  await db
    .collection('usuarios')
    .doc(uid)
    .set(
      { nombre, correo, rol, activo: true, seriesAsignadas: [] },
      { merge: true },
    )
  console.log(`usuario ${rol}: ${correo} / ${contrasena}`)
}

await crearUsuario(
  'vendedor-demo',
  'vendedor@suitpay.local',
  'vendedor123',
  'Vendedor Demo',
  'vendedor',
)
await crearUsuario(
  'admin-demo',
  'admin@suitpay.local',
  'admin1234',
  'Admin Demo',
  'administrador',
)

const productos = [
  { codigo: 'TUB-PVC-12', descripcion: 'TUBO PVC 1/2 PULGADA X 3M', unidad: 'UND', precio: 1250, activo: true },
  { codigo: 'COD-90-12', descripcion: 'CODO PVC 90 GRADOS 1/2', unidad: 'UND', precio: 180, activo: true },
  { codigo: 'PEG-250', descripcion: 'PEGAMENTO PVC 250 ML', unidad: 'UND', precio: 850, activo: true },
  { codigo: 'VAL-ESF-34', descripcion: 'VALVULA ESFERICA 3/4 BRONCE', unidad: 'UND', precio: 2200, activo: true },
  { codigo: 'TEE-PVC-1', descripcion: 'TEE PVC 1 PULGADA', unidad: 'UND', precio: 320, activo: true },
  { codigo: 'LLA-PASO-12', descripcion: 'LLAVE DE PASO 1/2 FV', unidad: 'UND', precio: 1800, activo: true },
]

await db.collection('catalogo').doc('actual').set({
  version: 1,
  productos,
  categorias: [],
})
await db.collection('indices').doc('clientes').set({ version: 1, clientes: [] })
await db.collection('indices').doc('transportistas').set({
  version: 1,
  transportistas: [],
})
await db.collection('config').doc('parametros').set({
  umbralIdentificacionBoleta: 70000,
  ventanaAnulacion: 'mismo_dia',
  formatoImpresionPorDefecto: 'a4',
})

console.log(`catalogo publicado: ${productos.length} productos (version 1)`)
console.log('listo')
process.exit(0)
