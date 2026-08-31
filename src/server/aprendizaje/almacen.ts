import { Timestamp } from 'firebase-admin/firestore'
import type { EntradaDeMemoria } from '../../domain/aprendizaje/compacto.ts'
import type { DiffDeProducto, MapaDeMemoria } from '../../domain/aprendizaje/memoria.ts'
import { aplicarDiffDeMemoria, VIDA_LOTE_MS } from '../../domain/aprendizaje/memoria.ts'
import { COLECCIONES, DOCUMENTOS, bd } from '../firebase/admin.ts'

export interface ParDeRevision {
  readonly textoOriginal: string
  readonly codigoAprobado: string
  readonly descripcionAprobada: string
}

export interface RevisionPendiente {
  readonly id: string
  readonly diaLima: string
  readonly medio: string
  readonly pares: readonly ParDeRevision[]
  readonly vendedorId: string
  readonly procesada: boolean
}

function mapaDesdeDocumento(datos: Record<string, unknown> | undefined): MapaDeMemoria {
  const crudo = datos?.['productos']
  if (!crudo || typeof crudo !== 'object' || Array.isArray(crudo)) return {}
  const mapa: MapaDeMemoria = {}
  for (const [codigo, valor] of Object.entries(crudo as Record<string, unknown>)) {
    if (!valor || typeof valor !== 'object') continue
    const fila = valor as Record<string, unknown>
    mapa[codigo] = {
      aliases: Array.isArray(fila['aliases'])
        ? fila['aliases'].filter((a): a is string => typeof a === 'string')
        : [],
      etiquetas: Array.isArray(fila['etiquetas'])
        ? fila['etiquetas'].filter((e): e is string => typeof e === 'string')
        : [],
    }
  }
  return mapa
}

export async function leerMemoriaDeAprendizaje(): Promise<MapaDeMemoria> {
  const [coleccion, id] = DOCUMENTOS.aprendizajeMemoria.split('/')
  const snap = await bd().collection(coleccion ?? 'aprendizaje').doc(id ?? 'memoria').get()
  if (!snap.exists) return {}
  return mapaDesdeDocumento(snap.data())
}

export async function escribirMemoriaDeAprendizaje(
  mapa: MapaDeMemoria,
): Promise<void> {
  const [coleccion, id] = DOCUMENTOS.aprendizajeMemoria.split('/')
  await bd()
    .collection(coleccion ?? 'aprendizaje')
    .doc(id ?? 'memoria')
    .set({ productos: mapa, actualizadoEn: Timestamp.now() }, { merge: true })
}

export async function aplicarYPersistirDiff(
  diffs: readonly DiffDeProducto[],
): Promise<MapaDeMemoria> {
  const actual = await leerMemoriaDeAprendizaje()
  const siguiente = aplicarDiffDeMemoria(actual, diffs)
  await escribirMemoriaDeAprendizaje(siguiente)
  return siguiente
}

export async function registrarRevision(entrada: {
  readonly diaLima: string
  readonly medio: string
  readonly pares: readonly ParDeRevision[]
  readonly vendedorId: string
  readonly clienteId?: string | null
}): Promise<string> {
  const referencia = bd().collection(COLECCIONES.revisionesAprendizaje).doc()
  await referencia.set({
    diaLima: entrada.diaLima,
    medio: entrada.medio,
    pares: entrada.pares,
    vendedorId: entrada.vendedorId,
    ...(entrada.clienteId ? { clienteId: entrada.clienteId } : {}),
    procesada: false,
    creadoEn: Timestamp.now(),
  })
  return referencia.id
}

export async function listarRevisionesPendientes(
  diaLimaHasta: string,
): Promise<readonly RevisionPendiente[]> {
  const snaps = await bd()
    .collection(COLECCIONES.revisionesAprendizaje)
    .where('procesada', '==', false)
    .where('diaLima', '<=', diaLimaHasta)
    .limit(200)
    .get()
  return snaps.docs.map((doc) => {
    const d = doc.data()
    return {
      id: doc.id,
      diaLima: String(d['diaLima'] ?? ''),
      medio: String(d['medio'] ?? ''),
      pares: Array.isArray(d['pares']) ? (d['pares'] as ParDeRevision[]) : [],
      vendedorId: String(d['vendedorId'] ?? ''),
      procesada: false,
    }
  })
}

export async function marcarRevisionesProcesadas(
  ids: readonly string[],
  ahora: Date,
): Promise<void> {
  if (ids.length === 0) return
  const caducaEn = Timestamp.fromMillis(ahora.getTime() + VIDA_LOTE_MS)
  const lote = bd().batch()
  for (const id of ids) {
    lote.update(bd().collection(COLECCIONES.revisionesAprendizaje).doc(id), {
      procesada: true,
      caducaEn,
    })
  }
  await lote.commit()
}

export async function reclamarLote(
  diaLima: string,
  ahora: Date,
): Promise<{ yaCerrado: boolean }> {
  const loteRef = bd().collection(COLECCIONES.lotesAprendizaje).doc(diaLima)
  const existente = await loteRef.get()
  if (existente.exists && existente.data()?.['cerradoEn'] != null) {
    return { yaCerrado: true }
  }
  await loteRef.set(
    {
      diaLima,
      caducaEn: Timestamp.fromMillis(ahora.getTime() + VIDA_LOTE_MS),
      iniciadoEn: Timestamp.fromDate(ahora),
    },
    { merge: true },
  )
  return { yaCerrado: false }
}

export async function cerrarLote(
  diaLima: string,
  auditoria: {
    readonly pares: number
    readonly diffs: readonly DiffDeProducto[]
    readonly modelo: string
  },
  ahora: Date,
): Promise<void> {
  await bd()
    .collection(COLECCIONES.lotesAprendizaje)
    .doc(diaLima)
    .set(
      {
        diaLima,
        pares: auditoria.pares,
        diffs: auditoria.diffs,
        modelo: auditoria.modelo,
        cerradoEn: Timestamp.fromDate(ahora),
        caducaEn: Timestamp.fromMillis(ahora.getTime() + VIDA_LOTE_MS),
      },
      { merge: true },
    )
}

export async function leerLotesNoVencidos(
  ahora: Date,
): Promise<
  readonly {
    readonly id: string
    readonly diaLima: string
    readonly pares: number
    readonly modelo: string
    readonly cerradoEn: string | null
  }[]
> {
  const snaps = await bd()
    .collection(COLECCIONES.lotesAprendizaje)
    .orderBy('diaLima', 'desc')
    .limit(14)
    .get()
  return snaps.docs
    .map((doc) => {
      const d = doc.data()
      const caduca = d['caducaEn']
      const caducaMs =
        caduca instanceof Timestamp ? caduca.toMillis() : 0
      if (caducaMs > 0 && caducaMs < ahora.getTime()) return null
      const cerrado = d['cerradoEn']
      return {
        id: doc.id,
        diaLima: String(d['diaLima'] ?? doc.id),
        pares: typeof d['pares'] === 'number' ? d['pares'] : 0,
        modelo: String(d['modelo'] ?? ''),
        cerradoEn:
          cerrado instanceof Timestamp ? cerrado.toDate().toISOString() : null,
      }
    })
    .filter((fila): fila is NonNullable<typeof fila> => fila !== null)
}

export async function leerLotePorDia(
  diaLima: string,
  ahora: Date,
): Promise<{
  readonly id: string
  readonly diaLima: string
  readonly pares: number
  readonly diffs: readonly DiffDeProducto[]
  readonly modelo: string
  readonly cerradoEn: string | null
} | null> {
  const snap = await bd().collection(COLECCIONES.lotesAprendizaje).doc(diaLima).get()
  if (!snap.exists) return null
  const d = snap.data() ?? {}
  const caduca = d['caducaEn']
  const caducaMs = caduca instanceof Timestamp ? caduca.toMillis() : 0
  if (caducaMs > 0 && caducaMs < ahora.getTime()) return null
  const cerrado = d['cerradoEn']
  return {
    id: snap.id,
    diaLima: String(d['diaLima'] ?? snap.id),
    pares: typeof d['pares'] === 'number' ? d['pares'] : 0,
    diffs: Array.isArray(d['diffs']) ? (d['diffs'] as DiffDeProducto[]) : [],
    modelo: String(d['modelo'] ?? ''),
    cerradoEn:
      cerrado instanceof Timestamp ? cerrado.toDate().toISOString() : null,
  }
}

export function memoriaComoEntradas(
  mapa: MapaDeMemoria,
): Readonly<Record<string, EntradaDeMemoria>> {
  return mapa
}
