import { usarCatalogo } from '../catalogo/almacen.ts'
import { usarPedido } from '../pedido/almacen.ts'
import { usarCaptura, type LineaDeCapturaEditable } from './estado.ts'

export interface LineaCapturaAprobada {
  readonly codigo: string
  readonly descripcion: string
  readonly unidad: string
  readonly cantidad: number
  readonly textoOriginal: string
}

/**
 * Extrae las líneas resueltas de la revisión. No escribe en el pedido:
 * el destino (Pedido, Lista, Vecinos) lo decide el mostrador.
 */
export function extraerLineasAprobadasDeCaptura():
  | {
      ok: true
      lineas: readonly LineaCapturaAprobada[]
      textosOriginales: readonly string[]
    }
  | { ok: false; motivo: string } {
  const captura = usarCaptura.getState()
  if (captura.capturaId === null) {
    return { ok: false, motivo: 'No hay propuesta que aprobar.' }
  }
  if (captura.hayPendientesOAmbiguas()) {
    return {
      ok: false,
      motivo: 'Resuelve las líneas pendientes o ambiguas antes de aprobar.',
    }
  }

  const textosOriginales = captura.lineas.map((l) => l.textoOriginal)
  const catalogo = usarCatalogo.getState()
  const lineas: LineaCapturaAprobada[] = []

  for (const linea of captura.lineas) {
    if (linea.seleccion === null) continue
    const producto = catalogo.productoPorCodigo(linea.seleccion)
    const candidato = linea.candidatos.find((c) => c.codigo === linea.seleccion)
    if (producto === undefined && candidato === undefined) continue
    lineas.push({
      codigo: producto?.codigo ?? candidato!.codigo,
      descripcion: producto?.descripcion ?? candidato!.descripcion,
      unidad: producto?.unidad ?? candidato!.unidad,
      cantidad: linea.cantidad > 0 ? linea.cantidad : 1,
      textoOriginal: linea.textoOriginal,
    })
  }

  return { ok: true, lineas, textosOriginales }
}

/**
 * Convierte la revisión en líneas del pedido (T125).
 * No emite nada por sí sola (principio I).
 * Omite códigos que ya están en el pedido (no duplica).
 */
export function aprobarPropuestaDeCaptura():
  | {
      ok: true
      lineasAgregadas: number
      lineasOmitidas: number
      textosOriginales: readonly string[]
    }
  | { ok: false; motivo: string } {
  const extraidas = extraerLineasAprobadasDeCaptura()
  if (!extraidas.ok) return extraidas

  const pedido = usarPedido.getState()
  const catalogo = usarCatalogo.getState()
  const captura = usarCaptura.getState()
  let agregadas = 0
  let omitidas = 0

  for (const linea of extraidas.lineas) {
    const producto = catalogo.productoPorCodigo(linea.codigo)
    const agregada = pedido.agregarLinea({
      codigo: linea.codigo,
      descripcion: linea.descripcion,
      unidad: linea.unidad,
      cantidad: linea.cantidad,
      precio: producto?.precio ?? 0,
    })
    if (agregada) agregadas += 1
    else omitidas += 1
  }

  pedido.fijarOrigen({ capturaId: captura.capturaId })
  captura.cancelar()
  return {
    ok: true,
    lineasAgregadas: agregadas,
    lineasOmitidas: omitidas,
    textosOriginales: extraidas.textosOriginales,
  }
}

export function aplicarLineasAprobadasAlPedido(
  lineas: readonly LineaCapturaAprobada[],
  capturaId: string | null,
): { agregadas: number; omitidas: number } {
  const pedido = usarPedido.getState()
  const catalogo = usarCatalogo.getState()
  let agregadas = 0
  let omitidas = 0
  for (const linea of lineas) {
    const producto = catalogo.productoPorCodigo(linea.codigo)
    const agregada = pedido.agregarLinea({
      codigo: linea.codigo,
      descripcion: linea.descripcion,
      unidad: linea.unidad,
      cantidad: linea.cantidad,
      precio: producto?.precio ?? 0,
    })
    if (agregada) agregadas += 1
    else omitidas += 1
  }
  if (capturaId !== null) {
    pedido.fijarOrigen({ capturaId })
  }
  return { agregadas, omitidas }
}

export function lineasResueltas(
  lineas: readonly LineaDeCapturaEditable[],
): number {
  return lineas.filter((l) => l.estadoLinea === 'resuelta' && l.seleccion).length
}
