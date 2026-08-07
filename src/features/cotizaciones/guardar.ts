import {
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
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
  readonly actualizada?: boolean
  readonly mensaje?: string
}

function clienteParaFirestore(cliente: ClienteDelPedido | null) {
  if (cliente === null) return null
  return {
    tipoDocumento: cliente.tipoDocumento,
    numeroDocumento: cliente.numeroDocumento,
    denominacion: cliente.denominacion,
    ...(cliente.direccion !== undefined && cliente.direccion.trim() !== ''
      ? { direccion: cliente.direccion }
      : {}),
  }
}

function lineasParaFirestore(lineas: readonly LineaDePedido[]) {
  return lineas.map((linea) => ({
    codigo: linea.codigo,
    descripcion: linea.descripcion,
    unidad: linea.unidad,
    cantidad: linea.cantidad,
    precio: linea.precio,
  }))
}

/**
 * Guarda o actualiza cotización (FR-016).
 *
 * - Sin `cotizacionId`: reserva número y crea documento nuevo.
 * - Con `cotizacionId` (pedido abierto desde una cotización): actualiza
 *   líneas/cliente/total sin crear otra ni consumir un número nuevo.
 */
export async function guardarCotizacion(datos: {
  readonly uid: string
  readonly lineas: readonly LineaDePedido[]
  readonly cliente: ClienteDelPedido | null
  readonly cotizacionId?: string | null
}): Promise<ResultadoDeGuardarCotizacion> {
  if (datos.lineas.length === 0) {
    return { ok: false, mensaje: 'No hay líneas para guardar.' }
  }

  const total = calcularTotal(datos.lineas)
  const cliente = clienteParaFirestore(datos.cliente)
  const lineas = lineasParaFirestore(datos.lineas)
  const idExistente = datos.cotizacionId?.trim() || null

  if (idExistente !== null) {
    const referencia = doc(obtenerBaseDeDatos(), 'cotizaciones', idExistente)
    try {
      const instantanea = await getDoc(referencia)
      if (!instantanea.exists()) {
        return {
          ok: false,
          mensaje: 'La cotización ya no existe. Guarda una nueva.',
        }
      }
      const datosActuales = instantanea.data()
      if (datosActuales['estado'] !== 'pendiente') {
        return {
          ok: false,
          mensaje: 'Esa cotización ya no existe o no se puede editar.',
        }
      }
      await updateDoc(referencia, {
        cliente,
        lineas,
        total,
        actualizadoEn: serverTimestamp(),
      })
      usarPedido.getState().fijarOrigen({ cotizacionId: idExistente })
      const numero = Number(datosActuales['numero'])
      return {
        ok: true,
        cotizacionId: idExistente,
        numero: Number.isFinite(numero) ? numero : undefined,
        actualizada: true,
      }
    } catch (error) {
      console.error('[SuitPay] guardarCotizacion: fallo al actualizar', error)
      return {
        ok: false,
        mensaje: 'No se pudo actualizar la cotización. Comprueba la conexión.',
      }
    }
  }

  const reserva = await reservarNumeroCotizacionFn()
  if (!reserva.ok || reserva.numero === undefined) {
    return {
      ok: false,
      mensaje: reserva.error?.mensaje ?? 'No se pudo numerar la cotización.',
    }
  }

  const referencia = doc(collection(obtenerBaseDeDatos(), 'cotizaciones'))

  try {
    await setDoc(referencia, {
      numero: reserva.numero,
      estado: 'pendiente',
      canal: 'general',
      cliente,
      lineas,
      total,
      creadoPor: datos.uid,
      creadoEn: serverTimestamp(),
      actualizadoEn: serverTimestamp(),
    })
  } catch (error) {
    console.error('[SuitPay] guardarCotizacion: fallo al escribir', error)
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
    actualizada: false,
  }
}
