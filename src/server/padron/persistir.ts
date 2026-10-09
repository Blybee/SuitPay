import { FieldValue } from 'firebase-admin/firestore'
import type { DocumentReference } from 'firebase-admin/firestore'
import {
  bytesDeIndice,
  TECHO_INDICE_BYTES,
} from '../../domain/padron/indice.ts'
import type {
  ClienteDePadron,
  ConteoDeLote,
  EntradaDeIndice,
  TransportistaDePadron,
} from '../../domain/padron/tipos.ts'
import { fallar } from '../errores.ts'
import { COLECCIONES, DOCUMENTOS, bd } from '../firebase/admin.ts'

/**
 * El índice es un solo documento. Una escritura por lote, y al menos un
 * segundo entre escrituras, para no convertirlo en hotspot.
 */
const ESPERA_INDICE_MS = 1000

let ultimoIndiceEn = 0

function textoVacio(valor: unknown): boolean {
  return typeof valor !== 'string' || valor.trim() === ''
}

async function esperarTurnoDelIndice(): Promise<void> {
  if (ultimoIndiceEn === 0) return
  const espera = ESPERA_INDICE_MS - (Date.now() - ultimoIndiceEn)
  if (espera > 0) {
    await new Promise((resolver) => {
      setTimeout(resolver, espera)
    })
  }
}

function listaDe(
  datos: Record<string, unknown> | undefined,
  campo: 'clientes' | 'transportistas',
): EntradaDeIndice[] {
  const cruda = datos?.[campo]
  if (!Array.isArray(cruda)) return []
  const lista: EntradaDeIndice[] = []
  for (const entrada of cruda) {
    if (typeof entrada !== 'object' || entrada === null) continue
    const numero = (entrada as { numeroDocumento?: unknown }).numeroDocumento
    const denominacion = (entrada as { denominacion?: unknown }).denominacion
    if (typeof numero !== 'string' || typeof denominacion !== 'string') continue
    lista.push({ numeroDocumento: numero, denominacion })
  }
  return lista
}

async function fundirIndice(
  ruta: string,
  campo: 'clientes' | 'transportistas',
  entradas: readonly EntradaDeIndice[],
): Promise<void> {
  if (entradas.length === 0) return
  const [coleccion, id] = ruta.split('/')
  const referencia = bd()
    .collection(coleccion ?? COLECCIONES.indices)
    .doc(id ?? campo)

  const previo = await referencia.get()
  const actual = listaDe(previo.data(), campo)
  const ids = new Set(actual.map((entrada) => entrada.numeroDocumento))
  const faltan = entradas.filter((entrada) => !ids.has(entrada.numeroDocumento))
  if (faltan.length === 0) return

  const proyectada = [...actual, ...faltan]
  if (bytesDeIndice(campo, proyectada) > TECHO_INDICE_BYTES) {
    fallar('peticion_invalida', {
      motivo: 'indice_demasiado_grande',
      bytes: bytesDeIndice(campo, proyectada),
    })
  }

  await esperarTurnoDelIndice()

  await bd().runTransaction(async (tx) => {
    const snap = await tx.get(referencia)
    const vigente = listaDe(snap.data(), campo)
    const presentes = new Set(vigente.map((entrada) => entrada.numeroDocumento))
    const extra = entradas.filter(
      (entrada) => !presentes.has(entrada.numeroDocumento),
    )
    if (extra.length === 0) return
    const lista = [...vigente, ...extra]
    if (bytesDeIndice(campo, lista) > TECHO_INDICE_BYTES) {
      fallar('peticion_invalida', {
        motivo: 'indice_demasiado_grande',
        bytes: bytesDeIndice(campo, lista),
      })
    }
    tx.set(
      referencia,
      {
        version: (snap.data()?.['version'] ?? 0) + 1,
        [campo]: lista,
      },
      { merge: true },
    )
  })
  ultimoIndiceEn = Date.now()
}

async function leerTodos(
  referencias: readonly DocumentReference[],
): Promise<Map<string, Record<string, unknown>>> {
  const encontrados = new Map<string, Record<string, unknown>>()
  for (let inicio = 0; inicio < referencias.length; inicio += 100) {
    const grupo = referencias.slice(inicio, inicio + 100)
    const snaps = await bd().getAll(...grupo)
    for (const snap of snaps) {
      if (!snap.exists) continue
      encontrados.set(snap.id, snap.data() ?? {})
    }
  }
  return encontrados
}

export async function persistirLoteDeClientes(
  filas: readonly ClienteDePadron[],
  creadoPor: string,
): Promise<ConteoDeLote> {
  if (filas.length === 0) return { nuevos: 0, yaExistian: 0 }

  const referencias = filas.map((fila) =>
    bd().collection(COLECCIONES.clientes).doc(fila.numeroDocumento),
  )
  const existentes = await leerTodos(referencias)
  const lote = bd().batch()
  const paraIndice: EntradaDeIndice[] = []
  let nuevos = 0
  let yaExistian = 0
  let escrituras = 0

  for (const fila of filas) {
    const referencia = bd()
      .collection(COLECCIONES.clientes)
      .doc(fila.numeroDocumento)
    const actual = existentes.get(fila.numeroDocumento)
    if (actual === undefined) {
      const documento: Record<string, unknown> = {
        tipoDocumento: fila.tipoDocumento,
        numeroDocumento: fila.numeroDocumento,
        denominacion: fila.denominacion,
        creadoPor,
        creadoEn: FieldValue.serverTimestamp(),
      }
      if (fila.direccion !== undefined) documento['direccion'] = fila.direccion
      if (fila.telefono !== undefined) documento['telefono'] = fila.telefono
      lote.set(referencia, documento)
      escrituras += 1
      nuevos += 1
      paraIndice.push({
        numeroDocumento: fila.numeroDocumento,
        denominacion: fila.denominacion,
      })
      continue
    }

    yaExistian += 1
    const parche: Record<string, unknown> = {}
    if (textoVacio(actual['direccion']) && fila.direccion !== undefined) {
      parche['direccion'] = fila.direccion
    }
    if (textoVacio(actual['telefono']) && fila.telefono !== undefined) {
      parche['telefono'] = fila.telefono
    }
    if (Object.keys(parche).length > 0) {
      lote.update(referencia, parche)
      escrituras += 1
    }
    paraIndice.push({
      numeroDocumento: fila.numeroDocumento,
      denominacion:
        typeof actual['denominacion'] === 'string' &&
        actual['denominacion'].trim() !== ''
          ? actual['denominacion']
          : fila.denominacion,
    })
  }

  if (escrituras > 0) await lote.commit()
  await fundirIndice(DOCUMENTOS.indiceDeClientes, 'clientes', paraIndice)
  return { nuevos, yaExistian }
}

export async function persistirLoteDeTransportistas(
  filas: readonly TransportistaDePadron[],
  creadoPor: string,
): Promise<ConteoDeLote> {
  if (filas.length === 0) return { nuevos: 0, yaExistian: 0 }

  const referencias = filas.map((fila) =>
    bd().collection(COLECCIONES.transportistas).doc(fila.numeroDocumento),
  )
  const existentes = await leerTodos(referencias)
  const lote = bd().batch()
  const paraIndice: EntradaDeIndice[] = []
  let nuevos = 0
  let yaExistian = 0
  let escrituras = 0

  for (const fila of filas) {
    const referencia = bd()
      .collection(COLECCIONES.transportistas)
      .doc(fila.numeroDocumento)
    const actual = existentes.get(fila.numeroDocumento)
    if (actual === undefined) {
      const documento: Record<string, unknown> = {
        tipoDocumento: 'RUC',
        numeroDocumento: fila.numeroDocumento,
        denominacion: fila.denominacion,
        creadoPor,
        creadoEn: FieldValue.serverTimestamp(),
      }
      if (fila.direccion !== undefined) documento['direccion'] = fila.direccion
      lote.set(referencia, documento)
      escrituras += 1
      nuevos += 1
      paraIndice.push({
        numeroDocumento: fila.numeroDocumento,
        denominacion: fila.denominacion,
      })
      continue
    }

    yaExistian += 1
    if (textoVacio(actual['direccion']) && fila.direccion !== undefined) {
      lote.update(referencia, { direccion: fila.direccion })
      escrituras += 1
    }
    paraIndice.push({
      numeroDocumento: fila.numeroDocumento,
      denominacion:
        typeof actual['denominacion'] === 'string' &&
        actual['denominacion'].trim() !== ''
          ? actual['denominacion']
          : fila.denominacion,
    })
  }

  if (escrituras > 0) await lote.commit()
  await fundirIndice(
    DOCUMENTOS.indiceDeTransportistas,
    'transportistas',
    paraIndice,
  )
  return { nuevos, yaExistian }
}
