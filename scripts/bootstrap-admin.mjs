/**
 * Crea o actualiza el primer administrador en Firebase Auth + Firestore.
 *
 * Uso (PowerShell), con ADC o GOOGLE_APPLICATION_CREDENTIALS:
 *
 *   $env:BOOTSTRAP_CORREO="admin@ejemplo.pe"
 *   $env:BOOTSTRAP_CONTRASENA="cambia-esto-ya"
 *   $env:BOOTSTRAP_NOMBRE="Administrador"
 *   $env:GOOGLE_CLOUD_PROJECT="blayblocklabs-antrax"
 *   node scripts/bootstrap-admin.mjs
 *
 * Necesario una sola vez: sin un admin con claims, T084 no puede abrirse.
 */

import { initializeApp, getApps, applicationDefault } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const correo = process.env.BOOTSTRAP_CORREO
const contrasena = process.env.BOOTSTRAP_CONTRASENA
const nombre = process.env.BOOTSTRAP_NOMBRE ?? 'Administrador'
const projectId =
  process.env.GOOGLE_CLOUD_PROJECT ??
  process.env.GCLOUD_PROJECT ??
  process.env.VITE_FIREBASE_PROJECT_ID ??
  'blayblocklabs-antrax'

if (!correo || !contrasena) {
  console.error(
    'Faltan BOOTSTRAP_CORREO y BOOTSTRAP_CONTRASENA en el entorno.',
  )
  process.exit(1)
}

if (contrasena.length < 8) {
  console.error('BOOTSTRAP_CONTRASENA debe tener al menos 8 caracteres.')
  process.exit(1)
}

const app =
  getApps()[0] ??
  initializeApp({
    credential: applicationDefault(),
    projectId,
  })

const auth = getAuth(app)
const db = getFirestore(app)

let user
try {
  user = await auth.getUserByEmail(correo)
  await auth.updateUser(user.uid, {
    password: contrasena,
    displayName: nombre,
    disabled: false,
  })
  console.log(`Usuario existente actualizado: ${user.uid}`)
} catch {
  user = await auth.createUser({
    email: correo,
    password: contrasena,
    displayName: nombre,
  })
  console.log(`Usuario creado: ${user.uid}`)
}

await auth.setCustomUserClaims(user.uid, {
  rol: 'administrador',
  activo: true,
})

await db.collection('usuarios').doc(user.uid).set(
  {
    nombre,
    correo,
    rol: 'administrador',
    activo: true,
    seriesAsignadas: [],
  },
  { merge: true },
)

console.log(
  'Claims y documento Firestore listos. Cierra sesión y vuelve a entrar para renovar el token.',
)
