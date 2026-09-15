import { diaEnLima } from '../anulacion/ventana.ts'
import {
  calcularTotal,
  normalizarCantidad,
} from '../totales/calculo.ts'
import type { LineaDePedido } from '../totales/calculo.ts'

/** Subcolección bajo `cotizaciones/{id}`. Id propio para no chocar con TTL. */
export const SUBCOLECCION_DEUDAS_POR_DIA = 'deudasPorDia'

export const RE_DIA_CIVIL = /^\d{4}-\d{2}-\d{2}$/

export interface GrupoDeLineasPorFecha {
  readonly fecha: string
  readonly lineas: readonly LineaDePedido[]
}

export interface PedidoDeDeuda {
  readonly fecha: string
  readonly lineas: readonly LineaDePedido[]
  readonly total: number
  readonly generacion: number
}

export interface FechaDeDeudaOrigen {
  readonly fecha: string
  readonly generacion: number
}

/**
 * Una línea por código: suma cantidades; descripción, unidad y precio del
 * grupo de fecha más reciente (orden lexicográfico AAAA-MM-DD).
 */
export function fusionarLineasPorCodigo(
  grupos: readonly GrupoDeLineasPorFecha[],
): LineaDePedido[] {
  const ordenados = [...grupos].sort((a, b) => a.fecha.localeCompare(b.fecha))
  const porCodigo = new Map<string, LineaDePedido>()
  const orden: string[] = []
  for (const grupo of ordenados) {
    for (const linea of grupo.lineas) {
      const previa = porCodigo.get(linea.codigo)
      if (previa === undefined) {
        orden.push(linea.codigo)
        porCodigo.set(linea.codigo, {
          ...linea,
          cantidad: normalizarCantidad(linea.cantidad),
        })
        continue
      }
      porCodigo.set(linea.codigo, {
        ...linea,
        cantidad: normalizarCantidad(previa.cantidad + linea.cantidad),
      })
    }
  }
  return orden.flatMap((codigo) => {
    const linea = porCodigo.get(codigo)
    return linea === undefined ? [] : [linea]
  })
}

export function totalDeGrupos(
  grupos: readonly GrupoDeLineasPorFecha[],
): number {
  return grupos.reduce((suma, cada) => suma + calcularTotal(cada.lineas), 0)
}

export function diaCivilDeLineasVivas(
  diaCivilLineas: string | null | undefined,
  actualizadoEn: Date | null,
  ahora: Date,
): string {
  if (
    typeof diaCivilLineas === 'string' &&
    RE_DIA_CIVIL.test(diaCivilLineas)
  ) {
    return diaCivilLineas
  }
  if (actualizadoEn !== null && actualizadoEn.getTime() > 0) {
    return diaEnLima(actualizadoEn)
  }
  return diaEnLima(ahora)
}

export function hayQueArchivarPedidoVivo(
  diaCivil: string,
  hoy: string,
  cantidadDeLineas: number,
): boolean {
  return cantidadDeLineas > 0 && diaCivil < hoy
}

export function formatearDiaDeDeuda(fecha: string): string {
  const partes = fecha.split('-')
  const anio = Number(partes[0])
  const mes = Number(partes[1])
  const dia = Number(partes[2])
  if (!Number.isFinite(anio) || !Number.isFinite(mes) || !Number.isFinite(dia)) {
    return fecha
  }
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(Date.UTC(anio, mes - 1, dia)))
}

export function mapearLineasDePedido(raw: unknown): LineaDePedido[] {
  if (!Array.isArray(raw)) return []
  const out: LineaDePedido[] = []
  for (const cada of raw) {
    if (cada === null || typeof cada !== 'object') continue
    const fila = cada as Record<string, unknown>
    const codigo = String(fila['codigo'] ?? '')
    const descripcion = String(fila['descripcion'] ?? '')
    if (codigo === '' || descripcion === '') continue
    out.push({
      codigo,
      descripcion,
      unidad: String(fila['unidad'] ?? 'UND'),
      cantidad: Number(fila['cantidad'] ?? 0),
      precio: Number(fila['precio'] ?? 0),
    })
  }
  return out
}
