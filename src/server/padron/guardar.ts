import { FieldValue } from 'firebase-admin/firestore'
import type { DocumentReference, WriteBatch } from 'firebase-admin/firestore'
import { bytesDeIndice, TECHO_INDICE_BYTES } from '../../domain/padron/indice.ts'
import type { EntradaDeIndice } from '../../domain/padron/tipos.ts'
import type {
  AltaDeCliente,
  AltaDeTransportista,
  CambioDeCliente,
  CambioDeTransportista,
  FichaDeCliente,
  FichaDeTransportista,
} from '../../domain/padron/edicion.ts'
import { fallar } from '../errores.ts'
import { COLECCIONES, DOCUMENTOS, bd } from '../firebase/admin.ts'
import {
  anotarEscrituraDeIndice,
  esperarTurnoDelIndice,
} from './persistir.ts'

/**
 * Aplica altas y cambios del borrador.
 * El índice se escribe una sola vez, y solo si cambió algún nombre.
 * Por debajo de 400 filas, documentos e índice van en la misma transacción.
 */

const TOPE_ATOMICO = 400
const TOPE_LOTE = 450

export type EdicionDePadron =
  | {
      readonly tipo: 'clientes'
      readonly altas: readonly AltaDeCliente[]
      readonly cambios: readonly CambioDeCliente[]
    }
  | {
      readonly tipo: 'transportistas'
      readonly altas: readonly AltaDeTransportista[]
      readonly cambios: readonly CambioDeTransportista[]
    }

interface ParcheDeNombre {
  readonly numeroDocumento: string
  readonly denominacion: string
}

export async function aplicarEdicionDePadron(
  edicion: EdicionDePadron,
  creadoPor: string,
): Promise<number> {
  const total = edicion.altas.length + edicion.cambios.length
  if (total === 0) return 0

  const campo = edicion.tipo
  const coleccion =
    edicion.tipo === 'clientes'
      ? COLECCIONES.clientes
      : COLECCIONES.transportistas
  const ruta =
    edicion.tipo === 'clientes'
      ? DOCUMENTOS.indiceDeClientes
      : DOCUMENTOS.indiceDeTransportistas
  const referenciaIndice = referenciaDeRuta(ruta, campo)
  const parches = parchesDeNombre(edicion)

  const previo = await referenciaIndice.get()
  const proyectado = aplicarNombres(listaDe(previo.data(), campo), parches)
  if (
    proyectado.cambio &&
    bytesDeIndice(campo, proyectado.lista) > TECHO_INDICE_BYTES
  ) {
    fallar('peticion_invalida', {
      motivo: 'indice_demasiado_grande',
      bytes: bytesDeIndice(campo, proyectado.lista),
    })
  }

  if (total <= TOPE_ATOMICO) {
    if (proyectado.cambio) await esperarTurnoDelIndice()
    const escribioIndice = await bd().runTransaction(async (tx) => {
      const indiceSnap = await tx.get(referenciaIndice)
      for (const alta of edicion.altas) {
        const snap = await tx.get(docDe(coleccion, alta.numeroDocumento))
        if (snap.exists) {
          fallar('peticion_invalida', {
            motivo: 'ya_existia',
            numeroDocumento: alta.numeroDocumento,
          })
        }
      }
      for (const cambio of edicion.cambios) {
        const snap = await tx.get(docDe(coleccion, cambio.numeroDocumento))
        if (!snap.exists) {
          fallar('no_encontrado', { numeroDocumento: cambio.numeroDocumento })
        }
      }

      for (const alta of edicion.altas) {
        tx.create(
          docDe(coleccion, alta.numeroDocumento),
          documentoDeAlta(edicion.tipo, alta, creadoPor),
        )
      }
      for (const cambio of edicion.cambios) {
        tx.update(
          docDe(coleccion, cambio.numeroDocumento),
          parcheDeCambio(cambio),
        )
      }

      const fusion = aplicarNombres(
        listaDe(indiceSnap.data(), campo),
        parches,
      )
      if (!fusion.cambio) return false
      if (bytesDeIndice(campo, fusion.lista) > TECHO_INDICE_BYTES) {
        fallar('peticion_invalida', {
          motivo: 'indice_demasiado_grande',
          bytes: bytesDeIndice(campo, fusion.lista),
        })
      }
      tx.set(
        referenciaIndice,
        {
          version: versionDe(indiceSnap.data()) + 1,
          [campo]: fusion.lista,
        },
        { merge: true },
      )
      return true
    })
    if (escribioIndice) anotarEscrituraDeIndice()
    return total
  }

  await escribirPorLotes(edicion, coleccion, creadoPor)
  if (!proyectado.cambio) return total

  await esperarTurnoDelIndice()
  const escribioIndice = await bd().runTransaction(async (tx) => {
    const indiceSnap = await tx.get(referenciaIndice)
    const fusion = aplicarNombres(listaDe(indiceSnap.data(), campo), parches)
    if (!fusion.cambio) return false
    if (bytesDeIndice(campo, fusion.lista) > TECHO_INDICE_BYTES) {
      fallar('peticion_invalida', {
        motivo: 'indice_demasiado_grande',
        bytes: bytesDeIndice(campo, fusion.lista),
      })
    }
    tx.set(
      referenciaIndice,
      {
        version: versionDe(indiceSnap.data()) + 1,
        [campo]: fusion.lista,
      },
      { merge: true },
    )
    return true
  })
  if (escribioIndice) anotarEscrituraDeIndice()
  return total
}

async function escribirPorLotes(
  edicion: EdicionDePadron,
  coleccion: string,
  creadoPor: string,
): Promise<void> {
  const referencias = edicion.altas.map((alta) =>
    docDe(coleccion, alta.numeroDocumento),
  )
  for (let inicio = 0; inicio < referencias.length; inicio += 100) {
    const grupo = referencias.slice(inicio, inicio + 100)
    if (grupo.length === 0) continue
    const snaps = await bd().getAll(...grupo)
    for (const snap of snaps) {
      if (!snap.exists) continue
      fallar('peticion_invalida', {
        motivo: 'ya_existia',
        numeroDocumento: snap.id,
      })
    }
  }

  const operaciones: Array<(lote: WriteBatch) => void> = [
    ...edicion.altas.map(
      (alta) => (lote: WriteBatch) => {
        lote.create(
          docDe(coleccion, alta.numeroDocumento),
          documentoDeAlta(edicion.tipo, alta, creadoPor),
        )
      },
    ),
    ...edicion.cambios.map(
      (cambio) => (lote: WriteBatch) => {
        lote.update(docDe(coleccion, cambio.numeroDocumento), parcheDeCambio(cambio))
      },
    ),
  ]

  for (let inicio = 0; inicio < operaciones.length; inicio += TOPE_LOTE) {
    const lote = bd().batch()
    for (const operacion of operaciones.slice(inicio, inicio + TOPE_LOTE)) {
      operacion(lote)
    }
    await lote.commit()
  }
}

function parchesDeNombre(edicion: EdicionDePadron): readonly ParcheDeNombre[] {
  return [
    ...edicion.altas.map((alta) => ({
      numeroDocumento: alta.numeroDocumento,
      denominacion: alta.denominacion,
    })),
    ...edicion.cambios.map((cambio) => ({
      numeroDocumento: cambio.numeroDocumento,
      denominacion: cambio.denominacion,
    })),
  ]
}

function aplicarNombres(
  lista: readonly EntradaDeIndice[],
  parches: readonly ParcheDeNombre[],
): { readonly lista: EntradaDeIndice[]; readonly cambio: boolean } {
  const porNumero = new Map(
    lista.map((entrada) => [entrada.numeroDocumento, entrada.denominacion]),
  )
  const siguiente = lista.map((entrada) => ({ ...entrada }))
  let cambio = false
  for (const parche of parches) {
    const actual = porNumero.get(parche.numeroDocumento)
    if (actual === undefined) {
      siguiente.push({
        numeroDocumento: parche.numeroDocumento,
        denominacion: parche.denominacion,
      })
      porNumero.set(parche.numeroDocumento, parche.denominacion)
      cambio = true
      continue
    }
    if (actual === parche.denominacion) continue
    const indice = siguiente.findIndex(
      (entrada) => entrada.numeroDocumento === parche.numeroDocumento,
    )
    if (indice < 0) continue
    siguiente[indice] = {
      numeroDocumento: parche.numeroDocumento,
      denominacion: parche.denominacion,
    }
    porNumero.set(parche.numeroDocumento, parche.denominacion)
    cambio = true
  }
  return { lista: siguiente, cambio }
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

function referenciaDeRuta(
  ruta: string,
  campo: 'clientes' | 'transportistas',
): DocumentReference {
  const [coleccion, id] = ruta.split('/')
  return bd()
    .collection(coleccion ?? COLECCIONES.indices)
    .doc(id ?? campo)
}

function docDe(coleccion: string, numero: string): DocumentReference {
  return bd().collection(coleccion).doc(numero)
}

function documentoDeAlta(
  tipo: 'clientes' | 'transportistas',
  alta: AltaDeCliente | AltaDeTransportista,
  creadoPor: string,
): Record<string, unknown> {
  const documento: Record<string, unknown> = {
    tipoDocumento: tipo === 'clientes' ? (alta as AltaDeCliente).tipoDocumento : 'RUC',
    numeroDocumento: alta.numeroDocumento,
    denominacion: alta.denominacion,
    creadoPor,
    creadoEn: FieldValue.serverTimestamp(),
  }
  copiarSiHay(documento, 'direccion', alta.direccion)
  if (tipo === 'clientes') {
    const cliente = alta as AltaDeCliente
    copiarSiHay(documento, 'telefono', cliente.telefono)
    copiarSiHay(documento, 'correo', cliente.correo)
    copiarSiHay(documento, 'ubigeo', cliente.ubigeo)
    copiarSiHay(documento, 'condicion', cliente.condicion)
  } else {
    copiarSiHay(
      documento,
      'numeroRegistroMtc',
      (alta as AltaDeTransportista).numeroRegistroMtc,
    )
  }
  return documento
}

function parcheDeCambio(
  cambio: CambioDeCliente | CambioDeTransportista,
): Record<string, unknown> {
  const parche: Record<string, unknown> = {
    denominacion: cambio.denominacion,
    actualizadoEn: FieldValue.serverTimestamp(),
  }
  if (cambio.ficha !== undefined) volcarFicha(parche, cambio.ficha)
  return parche
}

function versionDe(datos: Record<string, unknown> | undefined): number {
  const version = datos?.['version']
  return typeof version === 'number' ? version : 0
}

function volcarFicha(
  parche: Record<string, unknown>,
  ficha: FichaDeCliente | FichaDeTransportista,
): void {
  for (const [campo, valor] of Object.entries(ficha)) {
    parche[campo] = valor.trim() === '' ? FieldValue.delete() : valor.trim()
  }
}

function copiarSiHay(
  documento: Record<string, unknown>,
  campo: string,
  valor: string | undefined,
): void {
  if (valor !== undefined && valor.trim() !== '') documento[campo] = valor.trim()
}
