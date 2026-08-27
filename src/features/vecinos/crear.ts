import {
  collection,
  doc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { obtenerBaseDeDatos } from '../../infra/firebase/cliente.ts'
import { reservarNumeroCotizacionFn } from '../cotizaciones/cotizaciones.funciones.ts'
import type { ClienteDelPedido } from '../pedido/almacen.ts'

export interface ResultadoCrearVecino {
  readonly ok: boolean
  readonly cotizacionId?: string
  readonly numero?: number
  readonly mensaje?: string
}

/**
 * Crea la cotización viva del vecino tras confirmación explícita (FR-034b).
 */
export async function crearCotizacionVecino(datos: {
  readonly uid: string
  readonly alias: string
  readonly cliente: ClienteDelPedido
  readonly telefono?: string
}): Promise<ResultadoCrearVecino> {
  const alias = datos.alias.trim()
  if (alias === '') {
    return { ok: false, mensaje: 'El alias del vecino no puede estar vacío.' }
  }

  const reserva = await reservarNumeroCotizacionFn()
  if (!reserva.ok || reserva.numero === undefined) {
    return {
      ok: false,
      mensaje: reserva.error?.mensaje ?? 'No se pudo numerar la cotización.',
    }
  }

  const referencia = doc(collection(obtenerBaseDeDatos(), 'cotizaciones'))
  const cliente = {
    tipoDocumento: datos.cliente.tipoDocumento,
    numeroDocumento: datos.cliente.numeroDocumento,
    denominacion: datos.cliente.denominacion,
    ...(datos.cliente.direccion !== undefined &&
    datos.cliente.direccion.trim() !== ''
      ? { direccion: datos.cliente.direccion }
      : {}),
  }

  try {
    const telefono = datos.telefono?.trim() ?? ''
    await setDoc(referencia, {
      numero: reserva.numero,
      estado: 'pendiente',
      canal: 'vecino',
      aliasVecino: alias,
      ...(telefono !== '' ? { telefonoVecino: telefono } : {}),
      cliente,
      lineas: [],
      total: 0,
      creadoPor: datos.uid,
      creadoEn: serverTimestamp(),
      actualizadoEn: serverTimestamp(),
    })
  } catch (error) {
    console.error('[SuitPay] crearCotizacionVecino: fallo', error)
    return {
      ok: false,
      mensaje: 'No se pudo crear el vecino. Comprueba la conexión.',
    }
  }

  return {
    ok: true,
    cotizacionId: referencia.id,
    numero: reserva.numero,
  }
}
