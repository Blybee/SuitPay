import type { QueryClient } from '@tanstack/react-query'
import { fusionarLineaDeRequerimiento } from '../../domain/lista/lineas.ts'
import type {
  LineaDeRequerimiento,
  UrgenciaDeRequerimiento,
} from '../../domain/lista/tipos.ts'
import { CLAVES_DE_CONSULTA } from '../../infra/consultas/cliente.ts'
import {
  mutarLineasDeLista,
  type ResultadoLista,
} from './persistir.ts'

const altasPendientes = new Map<string, number>()

function clavePendiente(uid: string, fecha: string): string {
  return `${uid}/${fecha}`
}

export function hayAltaPendiente(uid: string, fecha: string): boolean {
  return (altasPendientes.get(clavePendiente(uid, fecha)) ?? 0) > 0
}

function marcarAltaPendiente(uid: string, fecha: string): () => void {
  const clave = clavePendiente(uid, fecha)
  altasPendientes.set(clave, (altasPendientes.get(clave) ?? 0) + 1)
  return () => {
    const restantes = (altasPendientes.get(clave) ?? 1) - 1
    if (restantes <= 0) altasPendientes.delete(clave)
    else altasPendientes.set(clave, restantes)
  }
}

export function aplicarProductosALista(
  lineas: readonly LineaDeRequerimiento[],
  altas: readonly {
    readonly id: string
    readonly codigo: string
    readonly descripcion: string
    readonly cantidad?: number
    readonly urgencia?: UrgenciaDeRequerimiento
  }[],
): readonly LineaDeRequerimiento[] {
  let siguientes = lineas
  for (const alta of altas) {
    siguientes = fusionarLineaDeRequerimiento(siguientes, alta)
  }
  return siguientes
}

export function parcharLineasDeListaEnCache(
  queryClient: QueryClient,
  uid: string,
  fecha: string,
  lineas: readonly LineaDeRequerimiento[],
): void {
  queryClient.setQueryData<readonly LineaDeRequerimiento[]>(
    CLAVES_DE_CONSULTA.listaRequerimiento(uid, fecha),
    [...lineas],
  )
}

/**
 * Agrega productos a la lista de requerimiento. Pinta la caché al instante
 * y confirma con la transacción (mismo patrón que Vecinos).
 */
export async function agregarProductosALista(datos: {
  readonly queryClient: QueryClient
  readonly uid: string
  readonly fecha: string
  readonly productos: readonly {
    readonly codigo: string
    readonly descripcion: string
    readonly cantidad?: number
    readonly urgencia?: UrgenciaDeRequerimiento
  }[]
}): Promise<ResultadoLista> {
  if (datos.productos.length === 0) return { ok: true }

  const altas = datos.productos.map((producto) => ({
    id: crypto.randomUUID(),
    codigo: producto.codigo,
    descripcion: producto.descripcion,
    cantidad: producto.cantidad,
    urgencia: producto.urgencia,
  }))
  const clave = CLAVES_DE_CONSULTA.listaRequerimiento(datos.uid, datos.fecha)
  const soltar = marcarAltaPendiente(datos.uid, datos.fecha)

  await datos.queryClient.cancelQueries({ queryKey: clave })
  const actuales =
    datos.queryClient.getQueryData<readonly LineaDeRequerimiento[]>(clave) ?? []
  parcharLineasDeListaEnCache(
    datos.queryClient,
    datos.uid,
    datos.fecha,
    aplicarProductosALista(actuales, altas),
  )

  try {
    const resultado = await mutarLineasDeLista(
      datos.uid,
      datos.fecha,
      (lineasActuales) => aplicarProductosALista(lineasActuales, altas),
    )
    soltar()

    if (!resultado.ok) {
      void datos.queryClient.invalidateQueries({ queryKey: clave })
      return resultado
    }

    if (resultado.lineas !== undefined && !hayAltaPendiente(datos.uid, datos.fecha)) {
      parcharLineasDeListaEnCache(
        datos.queryClient,
        datos.uid,
        datos.fecha,
        resultado.lineas,
      )
    }
    return resultado
  } catch (error) {
    soltar()
    void datos.queryClient.invalidateQueries({ queryKey: clave })
    throw error
  }
}
