import { FieldValue } from 'firebase-admin/firestore'
import { esquemaDeCliente } from '../../domain/esquemas/comunes.ts'
import type { Cliente } from '../../domain/esquemas/comunes.ts'
import { COLECCIONES, DOCUMENTOS, bd } from '../firebase/admin.ts'
import { fallar } from '../errores.ts'

/**
 * Alta de cliente + entrada en el índice, en una sola operación.
 *
 * El índice (`indices/clientes`) solo lo escribe el backend; las reglas
 * prohíben escritura desde el cliente. Sin esta función, FR-025 no tendría
 * coincidencias nuevas hasta el siguiente arranque mágico.
 */

export interface PeticionDeCrearCliente extends Cliente {
  readonly consultadoEn?: string
}

export interface ClienteCreado {
  readonly numeroDocumento: string
  readonly denominacion: string
  readonly yaExistia: boolean
}

export async function crearCliente(
  peticion: PeticionDeCrearCliente,
  creadoPor: string,
): Promise<ClienteCreado> {
  const parseado = esquemaDeCliente.safeParse(peticion)
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
    if (existente.exists) {
      const datos = existente.data() ?? {}
      return {
        numeroDocumento: cliente.numeroDocumento,
        denominacion: String(datos['denominacion'] ?? cliente.denominacion),
        yaExistia: true,
      }
    }

    const indiceSnap = await tx.get(referenciaIndice)
    const listaActual: Array<{ numeroDocumento: string; denominacion: string }> =
      indiceSnap.exists
        ? ((indiceSnap.data()?.['clientes'] as
            | Array<{ numeroDocumento: string; denominacion: string }>
            | undefined) ?? [])
        : []

    const yaEnIndice = listaActual.some(
      (cada) => cada.numeroDocumento === cliente.numeroDocumento,
    )
    const listaNueva = yaEnIndice
      ? listaActual
      : [
          ...listaActual,
          {
            numeroDocumento: cliente.numeroDocumento,
            denominacion: cliente.denominacion,
          },
        ]

    const documento: Record<string, unknown> = {
      tipoDocumento: cliente.tipoDocumento,
      numeroDocumento: cliente.numeroDocumento,
      denominacion: cliente.denominacion,
      creadoPor,
      creadoEn: FieldValue.serverTimestamp(),
    }
    if (cliente.direccion !== undefined) documento['direccion'] = cliente.direccion
    if (cliente.ubigeo !== undefined) documento['ubigeo'] = cliente.ubigeo
    if (cliente.telefono !== undefined) documento['telefono'] = cliente.telefono
    if (cliente.correo !== undefined) documento['correo'] = cliente.correo
    if (cliente.condicion !== undefined) documento['condicion'] = cliente.condicion
    if (peticion.consultadoEn !== undefined) {
      documento['consultadoEn'] = new Date(peticion.consultadoEn)
    }

    tx.create(referencia, documento)
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
      yaExistia: false,
    }
  })
}
