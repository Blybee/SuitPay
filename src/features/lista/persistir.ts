import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
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
import { VIDA_LISTA_MS } from '../../domain/lista/tipos.ts'
import { obtenerBaseDeDatos } from '../../infra/firebase/cliente.ts'

export interface ResultadoLista {
  readonly ok: boolean
  readonly mensaje?: string
}

function referencia(uid: string) {
  return doc(obtenerBaseDeDatos(), 'listasRequerimiento', uid)
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

/**
 * Una lectura: el documento entero del vendedor. Carga bajo demanda (tab Lista).
 */
export async function leerListaDeRequerimiento(
  uid: string,
): Promise<readonly LineaDeRequerimiento[]> {
  const instantanea = await getDoc(referencia(uid))
  if (!instantanea.exists()) return []
  const datos = instantanea.data()
  if (caducada(datos, new Date())) return []
  return mapearLineas(datos['lineas'])
}

async function persistir(
  uid: string,
  lineas: readonly LineaDeRequerimiento[],
): Promise<ResultadoLista> {
  try {
    await setDoc(referencia(uid), {
      vendedorId: uid,
      lineas: lineas.map((linea) => ({
        id: linea.id,
        codigo: linea.codigo,
        descripcion: linea.descripcion,
        cantidad: linea.cantidad,
        urgencia: linea.urgencia,
      })),
      actualizadoEn: serverTimestamp(),
      caducaEn: Timestamp.fromMillis(Date.now() + VIDA_LISTA_MS),
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
  readonly productos: readonly {
    readonly codigo: string
    readonly descripcion: string
    readonly cantidad?: number
    readonly urgencia?: UrgenciaDeRequerimiento
  }[]
}): Promise<ResultadoLista> {
  try {
    const actuales = await leerListaDeRequerimiento(datos.uid)
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
    return persistir(datos.uid, lineas)
  } catch (error) {
    console.error('[SuitPay] agregarProductosALista', error)
    return {
      ok: false,
      mensaje: 'No se pudo guardar la lista. Comprueba la conexión.',
    }
  }
}

export async function actualizarCantidadDeLista(datos: {
  readonly uid: string
  readonly lineasActuales: readonly LineaDeRequerimiento[]
  readonly id: string
  readonly cantidad: number
}): Promise<ResultadoLista> {
  return persistir(
    datos.uid,
    cambiarCantidadDeRequerimiento(
      datos.lineasActuales,
      datos.id,
      datos.cantidad,
    ),
  )
}

export async function actualizarUrgenciaDeLista(datos: {
  readonly uid: string
  readonly lineasActuales: readonly LineaDeRequerimiento[]
  readonly id: string
  readonly urgencia: UrgenciaDeRequerimiento
}): Promise<ResultadoLista> {
  return persistir(
    datos.uid,
    cambiarUrgenciaDeRequerimiento(
      datos.lineasActuales,
      datos.id,
      datos.urgencia,
    ),
  )
}

export async function quitarDeLista(datos: {
  readonly uid: string
  readonly lineasActuales: readonly LineaDeRequerimiento[]
  readonly id: string
}): Promise<ResultadoLista> {
  return persistir(
    datos.uid,
    quitarLineaDeRequerimiento(datos.lineasActuales, datos.id),
  )
}
