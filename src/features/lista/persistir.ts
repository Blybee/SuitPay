import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import {
  cambiarCantidadDeRequerimiento,
  cambiarUrgenciaDeRequerimiento,
  fusionarLineaDeRequerimiento,
  quitarLineaDeRequerimiento,
} from '../../domain/lista/lineas.ts'
import type {
  LineaDeRequerimiento,
  UrgenciaDeRequerimiento,
} from '../../domain/lista/tipos.ts'
import {
  COLECCION_LISTAS_REQUERIMIENTO,
  SUBCOLECCION_DIAS_LISTA,
  VIDA_LISTA_MS,
} from '../../domain/lista/tipos.ts'

import { obtenerBaseDeDatos } from '../../infra/firebase/cliente.ts'

export interface ResultadoLista {
  readonly ok: boolean
  readonly mensaje?: string
}

/**
 * Un documento por vendedor y día civil Lima:
 * `listasRequerimiento/{uid}/diasLista/{AAAA-MM-DD}`. Cada día se lee bajo
 * demanda al pulsar su pill; los días no visitados no cuestan lecturas.
 */
function referencia(uid: string, fecha: string) {
  return doc(
    obtenerBaseDeDatos(),
    COLECCION_LISTAS_REQUERIMIENTO,
    uid,
    SUBCOLECCION_DIAS_LISTA,
    fecha,
  )
}

function mapearLineas(raw: unknown): LineaDeRequerimiento[] {
  if (!Array.isArray(raw)) return []
  const out: LineaDeRequerimiento[] = []
  for (const cada of raw) {
    if (cada === null || typeof cada !== 'object') continue
    const fila = cada as Record<string, unknown>
    const id = String(fila['id'] ?? '')
    const codigo = String(fila['codigo'] ?? '')
    const descripcion = String(fila['descripcion'] ?? '')
    if (id === '' || codigo === '' || descripcion === '') continue
    out.push({
      id,
      codigo,
      descripcion,
      cantidad: Number(fila['cantidad'] ?? 1) || 1,
      urgencia: fila['urgencia'] === 'urgente' ? 'urgente' : 'normal',
    })
  }
  return out
}

function caducada(datos: Record<string, unknown>, ahora: Date): boolean {
  const valor = datos['caducaEn']
  if (
    valor !== null &&
    typeof valor === 'object' &&
    'toDate' in valor &&
    typeof (valor as Timestamp).toDate === 'function'
  ) {
    return (valor as Timestamp).toDate().getTime() <= ahora.getTime()
  }
  return false
}

function lineasDeInstantanea(
  datos: Record<string, unknown> | undefined,
): readonly LineaDeRequerimiento[] {
  if (datos === undefined) return []
  if (caducada(datos, new Date())) return []
  return mapearLineas(datos['lineas'])
}

function payloadDeLista(
  uid: string,
  fecha: string,
  lineas: readonly LineaDeRequerimiento[],
) {
  return {
    vendedorId: uid,
    fecha,
    lineas: lineas.map((linea) => ({
      id: linea.id,
      codigo: linea.codigo,
      descripcion: linea.descripcion,
      cantidad: linea.cantidad,
      urgencia: linea.urgencia,
    })),
    actualizadoEn: serverTimestamp(),
    caducaEn: Timestamp.fromMillis(Date.now() + VIDA_LISTA_MS),
  }
}

/**
 * Una lectura: el documento del día pedido. Carga bajo demanda (pill del día).
 */
export async function leerListaDeRequerimiento(
  uid: string,
  fecha: string,
): Promise<readonly LineaDeRequerimiento[]> {
  const instantanea = await getDoc(referencia(uid, fecha))
  if (!instantanea.exists()) return []
  return lineasDeInstantanea(instantanea.data())
}

/**
 * Lee y escribe el día en una transacción para no perder altas concurrentes
 * (otro dispositivo o dictado + buscador a la vez).
 */
async function mutarLista(
  uid: string,
  fecha: string,
  mutar: (
    lineas: readonly LineaDeRequerimiento[],
  ) => readonly LineaDeRequerimiento[],
): Promise<ResultadoLista> {
  const ref = referencia(uid, fecha)
  try {
    await runTransaction(obtenerBaseDeDatos(), async (tx) => {
      const instantanea = await tx.get(ref)
      const actuales = instantanea.exists()
        ? lineasDeInstantanea(instantanea.data())
        : []
      tx.set(ref, payloadDeLista(uid, fecha, mutar(actuales)))
    })
    return { ok: true }
  } catch (error) {
    console.error('[SuitPay] persistir lista de requerimiento', error)
    return {
      ok: false,
      mensaje: 'No se pudo guardar la lista. Comprueba la conexión.',
    }
  }
}

export async function agregarProductosALista(datos: {
  readonly uid: string
  readonly fecha: string
  readonly productos: readonly {
    readonly codigo: string
    readonly descripcion: string
    readonly cantidad?: number
    readonly urgencia?: UrgenciaDeRequerimiento
  }[]
}): Promise<ResultadoLista> {
  return mutarLista(datos.uid, datos.fecha, (actuales) => {
    let lineas = actuales
    for (const producto of datos.productos) {
      lineas = fusionarLineaDeRequerimiento(lineas, {
        id: crypto.randomUUID(),
        codigo: producto.codigo,
        descripcion: producto.descripcion,
        cantidad: producto.cantidad,
        urgencia: producto.urgencia,
      })
    }
    return lineas
  })
}

export async function actualizarCantidadDeLista(datos: {
  readonly uid: string
  readonly fecha: string
  readonly id: string
  readonly cantidad: number
}): Promise<ResultadoLista> {
  return mutarLista(datos.uid, datos.fecha, (actuales) =>
    cambiarCantidadDeRequerimiento(actuales, datos.id, datos.cantidad),
  )
}

export async function actualizarUrgenciaDeLista(datos: {
  readonly uid: string
  readonly fecha: string
  readonly id: string
  readonly urgencia: UrgenciaDeRequerimiento
}): Promise<ResultadoLista> {
  return mutarLista(datos.uid, datos.fecha, (actuales) =>
    cambiarUrgenciaDeRequerimiento(actuales, datos.id, datos.urgencia),
  )
}

export async function quitarDeLista(datos: {
  readonly uid: string
  readonly fecha: string
  readonly id: string
}): Promise<ResultadoLista> {
  return mutarLista(datos.uid, datos.fecha, (actuales) =>
    quitarLineaDeRequerimiento(actuales, datos.id),
  )
}
