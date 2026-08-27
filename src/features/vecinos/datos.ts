import { deleteDoc, doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { obtenerBaseDeDatos } from '../../infra/firebase/cliente.ts'

export interface ResultadoDatosVecino {
  readonly ok: boolean
  readonly mensaje?: string
}

export async function persistirDatosDeVecino(datos: {
  readonly cotizacionId: string
  readonly alias: string
  readonly telefono: string
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
    await updateDoc(referencia, {
      aliasVecino: alias,
      telefonoVecino: datos.telefono.trim(),
      actualizadoEn: serverTimestamp(),
    })
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
