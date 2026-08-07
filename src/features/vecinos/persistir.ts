import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { calcularTotal } from '../../domain/totales/calculo.ts'
import type { LineaDePedido } from '../../domain/totales/calculo.ts'
import { obtenerBaseDeDatos } from '../../infra/firebase/cliente.ts'

export interface ResultadoPersistirVecino {
  readonly ok: boolean
  readonly mensaje?: string
}

/**
 * Reescribe líneas/total de la cotización viva del vecino (FR-035).
 */
export async function persistirLineasDeVecino(datos: {
  readonly cotizacionId: string
  readonly lineas: readonly LineaDePedido[]
}): Promise<ResultadoPersistirVecino> {
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

    const lineas = datos.lineas.map((linea) => ({
      codigo: linea.codigo,
      descripcion: linea.descripcion,
      unidad: linea.unidad,
      cantidad: linea.cantidad,
      precio: linea.precio,
    }))
    const total = calcularTotal(datos.lineas)

    await updateDoc(referencia, {
      lineas,
      total,
      actualizadoEn: serverTimestamp(),
    })
    return { ok: true }
  } catch (error) {
    console.error('[SuitPay] persistirLineasDeVecino: fallo', error)
    return {
      ok: false,
      mensaje: 'No se pudieron guardar las líneas del vecino.',
    }
  }
}
