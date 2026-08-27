import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
  type Timestamp,
} from 'firebase/firestore'
import { obtenerBaseDeDatos } from '../../infra/firebase/cliente.ts'
import type {
  CanalDeCotizacion,
  Cotizacion,
  EstadoDeCotizacion,
  LineaDeCotizacion,
} from './tipos.ts'
import type { ClienteDelPedido } from '../pedido/almacen.ts'

function aFecha(valor: unknown): Date {
  if (
    valor !== null &&
    typeof valor === 'object' &&
    'toDate' in valor &&
    typeof (valor as Timestamp).toDate === 'function'
  ) {
    return (valor as Timestamp).toDate()
  }
  if (valor instanceof Date) return valor
  return new Date(0)
}

function mapearCotizacion(
  id: string,
  datos: Record<string, unknown>,
): Cotizacion {
  const lineasRaw = Array.isArray(datos['lineas']) ? datos['lineas'] : []
  const lineas: LineaDeCotizacion[] = lineasRaw.map((cada) => {
    const linea = cada as Record<string, unknown>
    return {
      codigo: String(linea['codigo'] ?? ''),
      descripcion: String(linea['descripcion'] ?? ''),
      unidad: String(linea['unidad'] ?? 'UND'),
      cantidad: Number(linea['cantidad'] ?? 0),
      precio: Number(linea['precio'] ?? 0),
    }
  })

  const clienteRaw = datos['cliente']
  let cliente: ClienteDelPedido | null = null
  if (clienteRaw !== null && typeof clienteRaw === 'object') {
    const c = clienteRaw as Record<string, unknown>
    cliente = {
      tipoDocumento: String(c['tipoDocumento'] ?? ''),
      numeroDocumento: String(c['numeroDocumento'] ?? ''),
      denominacion: String(c['denominacion'] ?? ''),
      ...(typeof c['direccion'] === 'string'
        ? { direccion: c['direccion'] }
        : {}),
    }
  }

  const canalRaw = datos['canal']
  const canal: CanalDeCotizacion =
    canalRaw === 'vecino' ? 'vecino' : 'general'

  const alias =
    typeof datos['aliasVecino'] === 'string' && datos['aliasVecino'].trim() !== ''
      ? datos['aliasVecino'].trim()
      : null

  return {
    id,
    numero: Number(datos['numero'] ?? 0),
    estado: (datos['estado'] as EstadoDeCotizacion) ?? 'pendiente',
    canal,
    aliasVecino: canal === 'vecino' ? alias : null,
    cliente,
    lineas,
    total: Number(datos['total'] ?? 0),
    creadoPor: String(datos['creadoPor'] ?? ''),
    creadoEn: aFecha(datos['creadoEn']),
    actualizadoEn:
      datos['actualizadoEn'] === null || datos['actualizadoEn'] === undefined
        ? null
        : aFecha(datos['actualizadoEn']),
    telefonoVecino:
      canal === 'vecino' && typeof datos['telefonoVecino'] === 'string'
        ? datos['telefonoVecino'].trim() || null
        : null,
  }
}

/**
 * Cotizaciones pendientes del canal indicado.
 *
 * Usa el índice ya desplegado `estado + creadoEn` y filtra `canal` en cliente:
 * - evita depender del índice compuesto `canal+estado+creadoEn` (aún no
 *   desplegado en muchos entornos);
 * - incluye cotizaciones legacy sin campo `canal` como `general`.
 */
export async function listarCotizacionesPendientes(
  canal: CanalDeCotizacion = 'general',
  tope = 40,
): Promise<readonly Cotizacion[]> {
  // Pedimos de más para no quedarnos cortos tras filtrar vecinos/general.
  const consulta = query(
    collection(obtenerBaseDeDatos(), 'cotizaciones'),
    where('estado', '==', 'pendiente'),
    orderBy('creadoEn', 'desc'),
    limit(Math.max(tope * 3, 60)),
  )
  const instantanea = await getDocs(consulta)
  return instantanea.docs
    .map((cada) => mapearCotizacion(cada.id, cada.data()))
    .filter((cada) => cada.canal === canal)
    .slice(0, tope)
}

/** Recuperación por número legible (FR-017). */
export async function buscarCotizacionPorNumero(
  numero: number,
): Promise<Cotizacion | null> {
  if (!Number.isFinite(numero) || numero <= 0) return null

  const consulta = query(
    collection(obtenerBaseDeDatos(), 'cotizaciones'),
    where('numero', '==', numero),
    limit(1),
  )
  const instantanea = await getDocs(consulta)
  const primero = instantanea.docs[0]
  if (primero === undefined) return null
  return mapearCotizacion(primero.id, primero.data())
}
