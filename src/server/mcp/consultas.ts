import { Timestamp } from 'firebase-admin/firestore'
import type { Firestore } from 'firebase-admin/firestore'
import { buscarCoincidenciasDeCliente } from '../../features/clientes/coincidencias.ts'
import { COLECCIONES, bd } from '../firebase/admin.ts'

const PAGINA = 20

export interface IdentidadDeCliente {
  readonly numeroDocumento: string
  readonly denominacion: string
}

export interface FilaDeComprobante {
  readonly id: string
  readonly tipoDocumento: string
  readonly estado: string
  readonly total: number
  readonly emitidoEn: string | null
  readonly cliente: IdentidadDeCliente | null
}

export async function buscarClientes(opciones: {
  readonly termino: string
  readonly limite: number
  readonly base?: Firestore
}): Promise<{ clientes: IdentidadDeCliente[]; lecturas: number }> {
  const base = opciones.base ?? bd()
  const instantanea = await base.collection(COLECCIONES.indices).doc('clientes').get()
  const lista = listaDeClientes(instantanea.data()?.['clientes'])
  return {
    lecturas: 1,
    clientes: buscarCoincidenciasDeCliente(opciones.termino, lista, opciones.limite).map(
      (cliente) => ({
        numeroDocumento: cliente.numeroDocumento,
        denominacion: cliente.denominacion,
      }),
    ),
  }
}

export async function obtenerComprobante(opciones: {
  readonly id: string
  readonly base?: Firestore
}): Promise<{ comprobante: FilaDeComprobante | null; lecturas: number }> {
  const base = opciones.base ?? bd()
  const instantanea = await base.collection(COLECCIONES.comprobantes).doc(opciones.id).get()
  if (!instantanea.exists) return { comprobante: null, lecturas: 1 }
  return { comprobante: filaDe(instantanea.id, instantanea.data() ?? {}), lecturas: 1 }
}

export async function listarComprobantes(opciones: {
  readonly cursor?: string
  readonly base?: Firestore
}): Promise<{ filas: FilaDeComprobante[]; siguiente: string | null; lecturas: number }> {
  const base = opciones.base ?? bd()
  let lecturas = 0
  let consulta = base
    .collection(COLECCIONES.comprobantes)
    .orderBy('emitidoEn', 'asc')
    .limit(PAGINA)
  if (opciones.cursor !== undefined && opciones.cursor !== '') {
    const ancla = await base.collection(COLECCIONES.comprobantes).doc(opciones.cursor).get()
    lecturas += 1
    if (!ancla.exists) return { filas: [], siguiente: null, lecturas }
    consulta = consulta.startAfter(ancla)
  }
  const pagina = await consulta.get()
  lecturas += 1
  const ultimo = pagina.docs.at(-1)
  return {
    filas: pagina.docs.map((documento) => filaDe(documento.id, documento.data())),
    siguiente: pagina.size === PAGINA && ultimo !== undefined ? ultimo.id : null,
    lecturas,
  }
}

export async function comprobantesPorResolver(opciones: {
  readonly base?: Firestore
}): Promise<{ filas: FilaDeComprobante[]; lecturas: number }> {
  const base = opciones.base ?? bd()
  const pagina = await base
    .collection(COLECCIONES.comprobantes)
    .where('estado', 'in', ['indeterminado', 'requiere_intervencion'])
    .limit(PAGINA)
    .get()
  return {
    lecturas: 1,
    filas: pagina.docs.map((documento) => filaDe(documento.id, documento.data())),
  }
}

export interface CotizacionPendiente {
  readonly id: string
  readonly numero: number
  readonly total: number
  readonly cliente: IdentidadDeCliente | null
}

export async function cotizacionesPendientes(opciones: {
  readonly base?: Firestore
}): Promise<{ cotizaciones: CotizacionPendiente[]; lecturas: number }> {
  const base = opciones.base ?? bd()
  const pagina = await base
    .collection(COLECCIONES.cotizaciones)
    .where('estado', '==', 'pendiente')
    .limit(PAGINA)
    .get()
  return {
    lecturas: 1,
    cotizaciones: pagina.docs.map((documento) => ({
      id: documento.id,
      numero: numero(documento.data()['numero']),
      total: numero(documento.data()['total']),
      cliente: identidadDe(documento.data()['cliente']),
    })),
  }
}

function listaDeClientes(bruto: unknown): { numeroDocumento: string; denominacion: string }[] {
  if (!Array.isArray(bruto)) return []
  return bruto.flatMap((entrada) => {
    const identidad = identidadDe(entrada)
    return identidad === null ? [] : [identidad]
  })
}

function filaDe(
  id: string,
  datos: FirebaseFirestore.DocumentData,
): FilaDeComprobante {
  const emitidoEn = datos['emitidoEn']
  return {
    id,
    tipoDocumento: texto(datos['tipoDocumento']),
    estado: texto(datos['estado']),
    total: numero(datos['total']),
    emitidoEn: emitidoEn instanceof Timestamp ? emitidoEn.toDate().toISOString() : null,
    cliente: identidadDe(datos['cliente']),
  }
}

function identidadDe(valor: unknown): IdentidadDeCliente | null {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) return null
  const fila = valor as Record<string, unknown>
  const numeroDocumento = texto(fila['numeroDocumento'])
  const denominacion = texto(fila['denominacion'])
  if (numeroDocumento === '' && denominacion === '') return null
  return { numeroDocumento, denominacion }
}

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor : ''
}

function numero(valor: unknown): number {
  return typeof valor === 'number' ? valor : 0
}
