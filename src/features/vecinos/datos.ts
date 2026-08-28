import {
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
  type UpdateData,
} from 'firebase/firestore'
import { obtenerBaseDeDatos } from '../../infra/firebase/cliente.ts'
import type { ClienteDelPedido } from '../pedido/almacen.ts'

export interface ResultadoDatosVecino {
  readonly ok: boolean
  readonly mensaje?: string
}

function clienteParaFirestore(cliente: ClienteDelPedido) {
  return {
    tipoDocumento: cliente.tipoDocumento,
    numeroDocumento: cliente.numeroDocumento,
    denominacion: cliente.denominacion,
    ...(cliente.direccion !== undefined && cliente.direccion.trim() !== ''
      ? { direccion: cliente.direccion }
      : {}),
  }
}

export async function persistirDatosDeVecino(datos: {
  readonly cotizacionId: string
  readonly alias: string
  readonly telefono: string
  readonly cliente?: ClienteDelPedido
}): Promise<ResultadoDatosVecino> {
  const alias = datos.alias.trim()
  if (alias === '') {
    return { ok: false, mensaje: 'El alias no puede estar vacío.' }
  }
  const referencia = doc(
    obtenerBaseDeDatos(),
    'cotizaciones',
    datos.cotizacionId,
  )
  try {
    const instantanea = await getDoc(referencia)
    if (!instantanea.exists()) {
      return { ok: false, mensaje: 'Ese vecino ya no existe.' }
    }
    const actuales = instantanea.data()
    if (
      actuales['estado'] !== 'pendiente' ||
      actuales['canal'] !== 'vecino'
    ) {
      return { ok: false, mensaje: 'Esa cotización de vecino no se puede editar.' }
    }
    const telefono = datos.telefono.trim()
    const parche: UpdateData<Record<string, unknown>> = {
      aliasVecino: alias,
      actualizadoEn: serverTimestamp(),
      telefonoVecino: telefono === '' ? deleteField() : telefono,
    }
    if (datos.cliente !== undefined) {
      parche['cliente'] = clienteParaFirestore(datos.cliente)
    }
    await updateDoc(referencia, parche)
    return { ok: true }
  } catch (error) {
    console.error('[SuitPay] persistirDatosDeVecino', error)
    return { ok: false, mensaje: 'No se pudieron guardar los datos del vecino.' }
  }
}

export async function eliminarCotizacionVecino(
  cotizacionId: string,
): Promise<ResultadoDatosVecino> {
  try {
    await deleteDoc(doc(obtenerBaseDeDatos(), 'cotizaciones', cotizacionId))
    return { ok: true }
  } catch (error) {
    console.error('[SuitPay] eliminarCotizacionVecino', error)
    return { ok: false, mensaje: 'No se pudo eliminar el vecino.' }
  }
}
