import type { QueryClient } from '@tanstack/react-query'
import { calcularTotal } from '../../domain/totales/calculo.ts'
import type { LineaDePedido } from '../../domain/totales/calculo.ts'
import type { ProductoBuscable } from '../../domain/busqueda/productos.ts'
import { CLAVES_DE_CONSULTA } from '../../infra/consultas/cliente.ts'
import type { Cotizacion } from '../cotizaciones/tipos.ts'
import { mutarLineasDeVecino } from './persistir.ts'
import type { ResultadoPersistirVecino } from './persistir.ts'

const altasPendientes = new Map<string, number>()

export function hayAltaPendiente(cotizacionId: string): boolean {
  return (altasPendientes.get(cotizacionId) ?? 0) > 0
}

function marcarAltaPendiente(cotizacionId: string): () => void {
  altasPendientes.set(
    cotizacionId,
    (altasPendientes.get(cotizacionId) ?? 0) + 1,
  )
  return () => {
    const restantes = (altasPendientes.get(cotizacionId) ?? 1) - 1
    if (restantes <= 0) altasPendientes.delete(cotizacionId)
    else altasPendientes.set(cotizacionId, restantes)
  }
}

export function aplicarProductosALineas(
  lineas: readonly LineaDePedido[],
  altas: readonly {
    readonly producto: ProductoBuscable
    readonly cantidad?: number
  }[],
): LineaDePedido[] {
  const siguientes = [...lineas]
  for (const alta of altas) {
    const incremento =
      alta.cantidad !== undefined && alta.cantidad > 0 ? alta.cantidad : 1
    const indice = siguientes.findIndex(
      (linea) => linea.codigo === alta.producto.codigo,
    )
    if (indice >= 0) {
      const actual = siguientes[indice]!
      siguientes[indice] = {
        ...actual,
        cantidad: actual.cantidad + incremento,
      }
      continue
    }
    siguientes.push({
      codigo: alta.producto.codigo,
      descripcion: alta.producto.descripcion,
      unidad: alta.producto.unidad,
      cantidad: incremento,
      precio: alta.producto.precio,
    })
  }
  return siguientes
}

export function parcharLineasDeVecinoEnCache(
  queryClient: QueryClient,
  cotizacionId: string,
  lineas: readonly LineaDePedido[],
  total: number,
): void {
  queryClient.setQueryData<readonly Cotizacion[]>(
    CLAVES_DE_CONSULTA.cotizacionesVecinos,
    (actual) => {
      if (actual === undefined) return actual
      return actual.map((cada) =>
        cada.id === cotizacionId
          ? { ...cada, lineas: [...lineas], total }
          : cada,
      )
    },
  )
}

/**
 * Agrega (o incrementa) productos en la cotización viva del vecino.
 * Pinta la caché al instante y confirma con la transacción (FR-035g).
 */
export async function agregarProductosAVecino(datos: {
  readonly queryClient: QueryClient
  readonly cotizacionId: string
  readonly productos: readonly {
    readonly producto: ProductoBuscable
    readonly cantidad?: number
  }[]
}): Promise<ResultadoPersistirVecino> {
  if (datos.productos.length === 0) return { ok: true }

  const soltar = marcarAltaPendiente(datos.cotizacionId)
  const actuales =
    datos.queryClient.getQueryData<readonly Cotizacion[]>(
      CLAVES_DE_CONSULTA.cotizacionesVecinos,
    ) ?? []
  const vecino = actuales.find((cada) => cada.id === datos.cotizacionId)
  if (vecino !== undefined) {
    const lineas = aplicarProductosALineas(vecino.lineas, datos.productos)
    parcharLineasDeVecinoEnCache(
      datos.queryClient,
      datos.cotizacionId,
      lineas,
      calcularTotal(lineas),
    )
  }

  try {
    const resultado = await mutarLineasDeVecino({
      cotizacionId: datos.cotizacionId,
      mutar: (lineasActuales) =>
        aplicarProductosALineas(lineasActuales, datos.productos),
    })
    soltar()

    if (!resultado.ok) {
      void datos.queryClient.invalidateQueries({
        queryKey: CLAVES_DE_CONSULTA.cotizacionesVecinos,
      })
      return resultado
    }

    if (resultado.archivo === true) {
      void datos.queryClient.invalidateQueries({
        queryKey: CLAVES_DE_CONSULTA.cotizacionesVecinos,
      })
      void datos.queryClient.invalidateQueries({
        queryKey: CLAVES_DE_CONSULTA.deudasVecino(datos.cotizacionId),
      })
      return resultado
    }

    if (
      resultado.lineas !== undefined &&
      resultado.total !== undefined &&
      !hayAltaPendiente(datos.cotizacionId)
    ) {
      parcharLineasDeVecinoEnCache(
        datos.queryClient,
        datos.cotizacionId,
        resultado.lineas,
        resultado.total,
      )
    }
    return resultado
  } catch (error) {
    soltar()
    void datos.queryClient.invalidateQueries({
      queryKey: CLAVES_DE_CONSULTA.cotizacionesVecinos,
    })
    throw error
  }
}
