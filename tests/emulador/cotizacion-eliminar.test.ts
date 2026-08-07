import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { deleteDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

/**
 * T173a — borrado manual de cotizaciones pendientes (FR-019a).
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
const describeConEmulador = describe.skipIf(!hayEmulador)

let entorno: RulesTestEnvironment

beforeAll(async () => {
  if (!hayEmulador) return
  const reglas = readFileSync(resolve('firestore.rules'), 'utf8')
  entorno = await initializeTestEnvironment({
    projectId: PROYECTO,
    firestore: { host: EMULADOR.host, port: EMULADOR.puerto, rules: reglas },
  })
})

afterAll(async () => {
  if (!hayEmulador) return
  await entorno.cleanup()
})

beforeEach(async () => {
  if (!hayEmulador) return
  await entorno.clearFirestore()
  await entorno.withSecurityRulesDisabled(async (contexto) => {
    const bd = contexto.firestore()
    await setDoc(doc(bd, 'cotizaciones/cot-pendiente'), {
      numero: 77,
      estado: 'pendiente',
      canal: 'general',
      cliente: null,
      lineas: [],
      total: 1000,
      creadoPor: 'vendedor-2',
      creadoEn: serverTimestamp(),
    })
    await setDoc(doc(bd, 'comprobantes/clave-1'), {
      estado: 'aceptado',
      tipoDocumento: 'boleta',
      serie: 'B001',
      numero: 1,
      vendedorId: 'vendedor-1',
    })
  })
})

describeConEmulador('eliminar cotización pendiente', () => {
  it('un vendedor borra la cotización pendiente de otro', async () => {
    const bd = entorno
      .authenticatedContext('vendedor-1', {
        rol: 'vendedor',
        activo: true,
      })
      .firestore()
    await assertSucceeds(deleteDoc(doc(bd, 'cotizaciones/cot-pendiente')))
  })

  it('sigue prohibido borrar un comprobante', async () => {
    const bd = entorno
      .authenticatedContext('vendedor-1', {
        rol: 'vendedor',
        activo: true,
      })
      .firestore()
    await assertFails(deleteDoc(doc(bd, 'comprobantes/clave-1')))
  })
})
