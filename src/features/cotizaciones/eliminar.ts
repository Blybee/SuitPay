import { deleteDoc, doc, getDoc } from 'firebase/firestore'
import { obtenerBaseDeDatos } from '../../infra/firebase/cliente.ts'

export interface ResultadoDeEliminarCotizacion {
  readonly ok: boolean
  readonly mensaje?: string
}

/**
 * Borrado duro de una cotización pendiente (FR-019a).
 * La UI debe pedir confirmación antes de llamar.
 */
export async function eliminarCotizacion(
  cotizacionId: string,
): Promise<ResultadoDeEliminarCotizacion> {
  const id = cotizacionId.trim()
  if (id === '') {
    return { ok: false, mensaje: 'Cotización no válida.' }
  }

  const referencia = doc(obtenerBaseDeDatos(), 'cotizaciones', id)
  try {
    const instantanea = await getDoc(referencia)
    if (!instantanea.exists()) {
      return { ok: true }
    }
    if (instantanea.data()?.['estado'] !== 'pendiente') {
      return {
        ok: false,
        mensaje: 'Esa cotización ya no se puede eliminar.',
      }
    }
    await deleteDoc(referencia)
    return { ok: true }
  } catch (error) {
    console.error('[SuitPay] eliminarCotizacion: fallo', error)
    return {
      ok: false,
      mensaje: 'No se pudo eliminar la cotización. Comprueba la conexión.',
    }
  }
}
