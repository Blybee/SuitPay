/**
 * Una pasada: pone `caducaEn` en capturas, revisiones y sesiones que no lo
 * tienen, y quita `clienteId` de las revisiones. Firestore solo borra si la
 * política de TTL está habilitada en el proyecto.
 *
 * PowerShell, con ADC o emulador:
 *
 *   $env:GOOGLE_CLOUD_PROJECT="blayblocklabs-antrax"
 *   node scripts/caducar-trazas.mjs
 *
 * Emulador:
 *
 *   $env:FIRESTORE_EMULATOR_HOST="127.0.0.1:8080"
 *   $env:GOOGLE_CLOUD_PROJECT="demo-suitpay"
 *   node scripts/caducar-trazas.mjs
 */

import { initializeApp, getApps, applicationDefault } from 'firebase-admin/app'
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore'

const DIA = 24 * 60 * 60 * 1000
const VIDA_CAPTURA = 7 * DIA
const VIDA_REVISION_PENDIENTE = 14 * DIA
const VIDA_LOTE = 3 * DIA

const projectId =
  process.env.GOOGLE_CLOUD_PROJECT ??
  process.env.GCLOUD_PROJECT ??
  process.env.VITE_FIREBASE_PROJECT_ID ??
  'blayblocklabs-antrax'

if (getApps().length === 0) {
  initializeApp({ credential: applicationDefault(), projectId })
}

const bd = getFirestore()

function millisDe(valor) {
  if (valor == null) return null
  if (typeof valor.toMillis === 'function') return valor.toMillis()
  if (valor instanceof Date) return valor.getTime()
  if (typeof valor === 'string') {
    const ms = Date.parse(valor)
    return Number.isNaN(ms) ? null : ms
  }
  return null
}

async function recorrer(nombre, visitar) {
  let ultimo = null
  for (;;) {
    let consulta = bd.collection(nombre).orderBy('__name__').limit(400)
    if (ultimo !== null) consulta = consulta.startAfter(ultimo)
    const snap = await consulta.get()
    if (snap.empty) break
    await visitar(snap.docs)
    ultimo = snap.docs[snap.docs.length - 1]
    if (snap.size < 400) break
  }
}

async function escribir(ops) {
  for (let i = 0; i < ops.length; i += 400) {
    const lote = bd.batch()
    for (const op of ops.slice(i, i + 400)) {
      lote.update(op.ref, op.datos)
    }
    await lote.commit()
  }
}

const ahora = Date.now()
const resumen = []

const capturas = []
await recorrer('capturas', async (docs) => {
  for (const doc of docs) {
    const datos = doc.data()
    if (datos.caducaEn != null) continue
    const base = millisDe(datos.creadoEn) ?? ahora
    capturas.push({
      ref: doc.ref,
      datos: { caducaEn: Timestamp.fromMillis(base + VIDA_CAPTURA) },
    })
  }
})
await escribir(capturas)
resumen.push(`capturas: ${capturas.length}`)

const revisiones = []
await recorrer('revisionesAprendizaje', async (docs) => {
  for (const doc of docs) {
    const datos = doc.data()
    const parche = {}
    if (datos.caducaEn == null) {
      const base = millisDe(datos.creadoEn) ?? ahora
      const vida = datos.procesada === true ? VIDA_LOTE : VIDA_REVISION_PENDIENTE
      parche.caducaEn = Timestamp.fromMillis(base + vida)
    }
    if (datos.clienteId != null) {
      parche.clienteId = FieldValue.delete()
    }
    if (Object.keys(parche).length === 0) continue
    revisiones.push({ ref: doc.ref, datos: parche })
  }
})
await escribir(revisiones)
resumen.push(`revisionesAprendizaje: ${revisiones.length}`)

const sesiones = []
await recorrer('sesionesEntrenamiento', async (docs) => {
  for (const doc of docs) {
    const datos = doc.data()
    if (datos.caducaEn != null) continue
    const base = millisDe(datos.creadoEn) ?? ahora
    sesiones.push({
      ref: doc.ref,
      datos: { caducaEn: Timestamp.fromMillis(base + VIDA_LOTE) },
    })
  }
})
await escribir(sesiones)
resumen.push(`sesionesEntrenamiento: ${sesiones.length}`)

console.log(resumen.join('\n'))
