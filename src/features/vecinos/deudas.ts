import {
  collection,
  doc,
  getDocs,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore'
import { calcularTotal } from '../../domain/totales/calculo.ts'
import {
  SUBCOLECCION_DEUDAS_POR_DIA,
  mapearLineasDePedido,
  type PedidoDeDeuda,
} from '../../domain/vecinos/deudas.ts'
import { obtenerBaseDeDatos } from '../../infra/firebase/cliente.ts'

function coleccionDeudas(cotizacionId: string) {
  return collection(
    obtenerBaseDeDatos(),
    'cotizaciones',
    cotizacionId,
    SUBCOLECCION_DEUDAS_POR_DIA,
  )
}

function mapearDeuda(id: string, datos: Record<string, unknown>): PedidoDeDeuda {
  const lineas = mapearLineasDePedido(datos['lineas'])
  return {
    fecha: typeof datos['fecha'] === 'string' ? datos['fecha'] : id,
    lineas,
    total:
      typeof datos['total'] === 'number' ? datos['total'] : calcularTotal(lineas),
    generacion:
      typeof datos['generacion'] === 'number' ? datos['generacion'] : 0,
  }
}

/** Carga perezosa: solo al abrir el ojito del vecino activo. */
export async function listarDeudasDeVecino(
  cotizacionId: string,
): Promise<readonly PedidoDeDeuda[]> {
  const instantanea = await getDocs(coleccionDeudas(cotizacionId))
  return instantanea.docs
    .map((cada) => mapearDeuda(cada.id, cada.data()))
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
}

export async function eliminarDeudaDeDia(datos: {
  readonly cotizacionId: string
  readonly fecha: string
}): Promise<{ ok: boolean; mensaje?: string }> {
  const padre = doc(
    obtenerBaseDeDatos(),
    'cotizaciones',
    datos.cotizacionId,
  )
  const deuda = doc(coleccionDeudas(datos.cotizacionId), datos.fecha)
  try {
    await runTransaction(obtenerBaseDeDatos(), async (tx) => {
      const padreSnap = await tx.get(padre)
      const deudaSnap = await tx.get(deuda)
      if (!deudaSnap.exists()) return
      const totalDia = Number(deudaSnap.data()?.['total'] ?? 0)
      const totalDeudas = padreSnap.exists()
        ? Number(padreSnap.data()?.['totalDeudas'] ?? 0)
        : 0
      tx.delete(deuda)
      if (padreSnap.exists()) {
        tx.update(padre, {
          totalDeudas: Math.max(0, totalDeudas - totalDia),
          actualizadoEn: serverTimestamp(),
        })
      }
    })
    return { ok: true }
  } catch (error) {
    console.error('[SuitPay] eliminarDeudaDeDia: fallo', error)
    return {
      ok: false,
      mensaje: 'No se pudo eliminar esa deuda.',
    }
  }
}
