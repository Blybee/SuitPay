import {
  collection,
  doc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { calcularTotal } from '../../domain/totales/calculo.ts'
import type { LineaDePedido } from '../../domain/totales/calculo.ts'
import { obtenerBaseDeDatos } from '../../infra/firebase/cliente.ts'
import type { ClienteDelPedido } from '../pedido/almacen.ts'
import { usarPedido } from '../pedido/almacen.ts'
import { reservarNumeroCotizacionFn } from './cotizaciones.funciones.ts'

export interface ResultadoDeGuardarCotizacion {
  readonly ok: boolean
  readonly cotizacionId?: string
  readonly numero?: number
  readonly mensaje?: string
}

/**
 * Guarda el pedido en curso como cotización (FR-016).
 *
 * 1. Reserva un número en el servidor.
 * 2. Escribe el documento con el SDK del cliente (reglas).
 * 3. Engancha el pedido a esa cotización para la conversión posterior.
 */
export async function guardarCotizacion(datos: {
  readonly uid: string
  readonly lineas: readonly LineaDePedido[]
  readonly cliente: ClienteDelPedido | null
}): Promise<ResultadoDeGuardarCotizacion> {
  if (datos.lineas.length === 0) {
    return { ok: false, mensaje: 'No hay líneas para guardar.' }
  }

  const reserva = await reservarNumeroCotizacionFn()
  if (!reserva.ok || reserva.numero === undefined) {
    return {
      ok: false,
      mensaje: reserva.error?.mensaje ?? 'No se pudo numerar la cotización.',
    }
  }

  const referencia = doc(collection(obtenerBaseDeDatos(), 'cotizaciones'))
  const total = calcularTotal(datos.lineas)

  try {
    await setDoc(referencia, {
      numero: reserva.numero,
      estado: 'pendiente',
      cliente: datos.cliente,
      lineas: datos.lineas.map((linea) => ({
        codigo: linea.codigo,
        descripcion: linea.descripcion,
        unidad: linea.unidad,
        cantidad: linea.cantidad,
        precio: linea.precio,
      })),
      total,
      creadoPor: datos.uid,
      creadoEn: serverTimestamp(),
      comprobanteId: null,
      convertidaEn: null,
    })
  } catch {
    return {
      ok: false,
      mensaje: 'No se pudo guardar la cotización. Comprueba la conexión.',
    }
  }

  usarPedido.getState().fijarOrigen({ cotizacionId: referencia.id })

  return {
    ok: true,
    cotizacionId: referencia.id,
    numero: reserva.numero,
  }
}
