import { FieldValue } from 'firebase-admin/firestore'
import { esquemaDeCliente } from '../../domain/esquemas/comunes.ts'
import type { Cliente } from '../../domain/esquemas/comunes.ts'
import { COLECCIONES, DOCUMENTOS, bd } from '../firebase/admin.ts'
import { fallar } from '../errores.ts'

/**
 * Actualiza un cliente existente y sincroniza la denominación en el índice.
 * Solo backend (Admin SDK); el cliente no escribe el índice.
 */

export type PeticionDeActualizarCliente = Pick<
  Cliente,
  'tipoDocumento' | 'numeroDocumento' | 'denominacion' | 'direccion' | 'ubigeo' | 'condicion'
>

export interface ClienteActualizado {
  readonly numeroDocumento: string
  readonly denominacion: string
}

export async function actualizarCliente(
  peticion: PeticionDeActualizarCliente,
): Promise<ClienteActualizado> {
  const parseado = esquemaDeCliente
    .pick({
      tipoDocumento: true,
      numeroDocumento: true,
      denominacion: true,
      direccion: true,
      ubigeo: true,
      condicion: true,
    })
    .safeParse(peticion)
  if (!parseado.success) {
    fallar('peticion_invalida', { detalle: parseado.error.message })
  }

  const cliente = parseado.data
  const referencia = bd()
    .collection(COLECCIONES.clientes)
    .doc(cliente.numeroDocumento)

  const [coleccionIndice, idIndice] = DOCUMENTOS.indiceDeClientes.split('/')
  const referenciaIndice = bd()
    .collection(coleccionIndice ?? COLECCIONES.indices)
    .doc(idIndice ?? 'clientes')

  return bd().runTransaction(async (tx) => {
    const existente = await tx.get(referencia)
    if (!existente.exists) {
      fallar('no_encontrado', { detalle: 'Cliente no registrado.' })
    }

    const indiceSnap = await tx.get(referenciaIndice)
    const listaActual: Array<{ numeroDocumento: string; denominacion: string }> =
      indiceSnap.exists
        ? ((indiceSnap.data()?.['clientes'] as
            | Array<{ numeroDocumento: string; denominacion: string }>
            | undefined) ?? [])
        : []

    const listaNueva = listaActual.map((cada) =>
      cada.numeroDocumento === cliente.numeroDocumento
        ? {
            numeroDocumento: cliente.numeroDocumento,
            denominacion: cliente.denominacion,
          }
        : cada,
    )
    const enIndice = listaNueva.some(
      (cada) => cada.numeroDocumento === cliente.numeroDocumento,
    )
    if (!enIndice) {
      listaNueva.push({
        numeroDocumento: cliente.numeroDocumento,
        denominacion: cliente.denominacion,
      })
    }

    const documento: Record<string, unknown> = {
      tipoDocumento: cliente.tipoDocumento,
      denominacion: cliente.denominacion,
      actualizadoEn: FieldValue.serverTimestamp(),
    }
    if (cliente.direccion !== undefined) documento['direccion'] = cliente.direccion
    if (cliente.ubigeo !== undefined) documento['ubigeo'] = cliente.ubigeo
    if (cliente.condicion !== undefined) documento['condicion'] = cliente.condicion

    tx.update(referencia, documento)
    tx.set(
      referenciaIndice,
      {
        version: (indiceSnap.data()?.['version'] ?? 0) + 1,
        clientes: listaNueva,
      },
      { merge: true },
    )

    return {
      numeroDocumento: cliente.numeroDocumento,
      denominacion: cliente.denominacion,
    }
  })
}
