import { Timestamp } from 'firebase-admin/firestore'
import type { Firestore, QueryDocumentSnapshot } from 'firebase-admin/firestore'
import {
  limitesDelMesEnLima,
  periodoEstaCerrado,
  periodoEsValido,
} from '../../domain/comprobantes/periodo-lima.ts'
import { resumirPeriodo } from '../../domain/comprobantes/resumen-periodo.ts'
import type {
  FilaDeVenta,
  ResumenDePeriodo,
} from '../../domain/comprobantes/resumen-periodo.ts'
import { bd, COLECCIONES } from '../firebase/admin.ts'

const PAGINA = 300

export interface ResumenGuardado extends ResumenDePeriodo {
  readonly materializadoEn: string | null
}

export async function resumenDeVentas(opciones: {
  readonly periodo: string
  readonly ahora?: Date
  readonly base?: Firestore
}): Promise<ResumenGuardado> {
  if (!periodoEsValido(opciones.periodo)) {
    throw new Error(`Periodo con forma inesperada: ${opciones.periodo}`)
  }
  const ahora = opciones.ahora ?? new Date()
  const base = opciones.base ?? bd()
  const ref = base.collection(COLECCIONES.resumenesVentas).doc(opciones.periodo)

  if (periodoEstaCerrado(opciones.periodo, ahora)) {
    const guardado = await ref.get()
    if (guardado.exists) return leerGuardado(guardado.data(), opciones.periodo)
  }

  const resumen = resumirPeriodo(
    await filasDelMes(base, opciones.periodo),
    opciones.periodo,
  )
  if (!periodoEstaCerrado(opciones.periodo, ahora)) {
    return { ...resumen, materializadoEn: null }
  }

  const materializadoEn = Timestamp.fromDate(ahora)
  try {
    await ref.create({ resumen, materializadoEn })
  } catch (error) {
    if (!yaExiste(error)) throw error
    const guardado = await ref.get()
    return leerGuardado(guardado.data(), opciones.periodo)
  }
  return { ...resumen, materializadoEn: ahora.toISOString() }
}

async function filasDelMes(
  base: Firestore,
  periodo: string,
): Promise<FilaDeVenta[]> {
  const { desde, hastaExclusivo } = limitesDelMesEnLima(periodo)
  const filas: FilaDeVenta[] = []
  let cursor: QueryDocumentSnapshot | undefined
  for (;;) {
    let consulta = base
      .collection(COLECCIONES.comprobantes)
      .where('emitidoEn', '>=', Timestamp.fromDate(desde))
      .where('emitidoEn', '<', Timestamp.fromDate(hastaExclusivo))
      .orderBy('emitidoEn', 'asc')
      .select(
        'tipoDocumento',
        'estado',
        'total',
        'vendedorId',
        'cliente',
        'anulacion',
        'lineas',
      )
      .limit(PAGINA)
    if (cursor !== undefined) consulta = consulta.startAfter(cursor)
    const pagina = await consulta.get()
    for (const documento of pagina.docs) filas.push(filaDe(documento.data()))
    if (pagina.size < PAGINA) return filas
    cursor = pagina.docs.at(-1)
  }
}

function filaDe(datos: FirebaseFirestore.DocumentData): FilaDeVenta {
  const cliente = datos['cliente']
  const lineas = datos['lineas']
  return {
    tipoDocumento: texto(datos['tipoDocumento']),
    estado: texto(datos['estado']),
    total: numero(datos['total']),
    vendedorId: texto(datos['vendedorId']),
    cliente: clienteEsMapa(cliente)
      ? {
          numeroDocumento: texto(cliente['numeroDocumento']),
          denominacion: texto(cliente['denominacion']),
        }
      : null,
    anulacion: datos['anulacion'] ?? null,
    lineas: Array.isArray(lineas)
      ? lineas.filter(lineaEsMapa).map((linea) => ({
          codigo: texto(linea['codigo']),
          descripcion: texto(linea['descripcion']),
          importe: numero(linea['importe']),
        }))
      : [],
  }
}

function leerGuardado(
  datos: FirebaseFirestore.DocumentData | undefined,
  periodo: string,
): ResumenGuardado {
  const resumen = datos?.['resumen']
  const marca = datos?.['materializadoEn']
  if (!esResumen(resumen) || !(marca instanceof Timestamp)) {
    throw new Error(`Resumen guardado ilegible: ${periodo}`)
  }
  return { ...resumen, periodo, materializadoEn: marca.toDate().toISOString() }
}

function esResumen(valor: unknown): valor is ResumenDePeriodo {
  if (typeof valor !== 'object' || valor === null) return false
  const candidato = valor as Partial<ResumenDePeriodo>
  return (
    typeof candidato.totalCentimos === 'number' &&
    typeof candidato.cantidad === 'number' &&
    Array.isArray(candidato.porTipo)
  )
}

function yaExiste(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const codigo = (error as { code?: unknown }).code
  return codigo === 6 || codigo === 'already-exists'
}

function clienteEsMapa(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

function lineaEsMapa(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null
}

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor : ''
}

function numero(valor: unknown): number {
  return typeof valor === 'number' ? valor : 0
}
