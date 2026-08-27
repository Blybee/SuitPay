import type { LineaDeRequerimiento, UrgenciaDeRequerimiento } from './tipos.ts'

/**
 * Si el código ya está, suma cantidad y conserva la urgencia más alta
 * (urgente gana). Si no, agrega una fila. Cantidad por omisión: 1.
 */
export function fusionarLineaDeRequerimiento(
  lineas: readonly LineaDeRequerimiento[],
  entrada: {
    readonly id: string
    readonly codigo: string
    readonly descripcion: string
    readonly cantidad?: number
    readonly urgencia?: UrgenciaDeRequerimiento
  },
): readonly LineaDeRequerimiento[] {
  const cantidad = entrada.cantidad !== undefined && entrada.cantidad > 0
    ? entrada.cantidad
    : 1
  const urgencia = entrada.urgencia ?? 'normal'
  const indice = lineas.findIndex((cada) => cada.codigo === entrada.codigo)
  if (indice < 0) {
    return [
      ...lineas,
      {
        id: entrada.id,
        codigo: entrada.codigo,
        descripcion: entrada.descripcion,
        cantidad,
        urgencia,
      },
    ]
  }
  const actual = lineas[indice]!
  const siguiente = lineas.slice()
  siguiente[indice] = {
    ...actual,
    cantidad: actual.cantidad + cantidad,
    urgencia:
      actual.urgencia === 'urgente' || urgencia === 'urgente'
        ? 'urgente'
        : 'normal',
  }
  return siguiente
}

export function cambiarCantidadDeRequerimiento(
  lineas: readonly LineaDeRequerimiento[],
  id: string,
  cantidad: number,
): readonly LineaDeRequerimiento[] {
  const normalizada = Number.isFinite(cantidad) && cantidad > 0 ? cantidad : 1
  return lineas.map((cada) =>
    cada.id === id ? { ...cada, cantidad: normalizada } : cada,
  )
}

export function cambiarUrgenciaDeRequerimiento(
  lineas: readonly LineaDeRequerimiento[],
  id: string,
  urgencia: UrgenciaDeRequerimiento,
): readonly LineaDeRequerimiento[] {
  return lineas.map((cada) =>
    cada.id === id ? { ...cada, urgencia } : cada,
  )
}

export function quitarLineaDeRequerimiento(
  lineas: readonly LineaDeRequerimiento[],
  id: string,
): readonly LineaDeRequerimiento[] {
  return lineas.filter((cada) => cada.id !== id)
}
