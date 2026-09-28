/**
 * Crea o actualiza el usuario jefe en Firebase Auth + Firestore.
 *
 * Uso (PowerShell), con ADC o GOOGLE_APPLICATION_CREDENTIALS:
 *
 *   $env:JEFE_CONTRASENA="cambia-esto-ya"
 *   $env:GOOGLE_CLOUD_PROJECT="blayblocklabs-antrax"
 *   node scripts/crear-jefe.mjs
 *
 * El correo por omisión es jefe@suitpay.pe. La contraseña no se guarda en el
 * repositorio: llega solo por el entorno.
 */

import { initializeApp, getApps, applicationDefault } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const correo = process.env.JEFE_CORREO ?? 'jefe@suitpay.pe'
const contrasena = process.env.JEFE_CONTRASENA
const nombre = process.env.JEFE_NOMBRE ?? 'Jefe'
const projectId =
  process.env.GOOGLE_CLOUD_PROJECT ??
  process.env.GCLOUD_PROJECT ??
  process.env.VITE_FIREBASE_PROJECT_ID ??
  'blayblocklabs-antrax'

if (!contrasena) {
  console.error('Falta JEFE_CONTRASENA en el entorno.')
  process.exit(1)
}

if (contrasena.length < 12) {
  console.error('JEFE_CONTRASENA debe tener al menos 12 caracteres.')
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
  rol: 'jefe',
  activo: true,
})

await db.collection('usuarios').doc(user.uid).set(
  {
    nombre,
    correo,
    rol: 'jefe',
    activo: true,
    seriesAsignadas: [],
  },
  { merge: true },
)

console.log(
  `Jefe listo: ${correo}. Cierra sesión y vuelve a entrar para renovar el token.`,
)
