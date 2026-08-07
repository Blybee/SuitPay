import { usarCatalogo } from '../catalogo/almacen.ts'
import { usarPedido } from '../pedido/almacen.ts'
import { usarCaptura, type LineaDeCapturaEditable } from './estado.ts'

/**
 * Convierte la revisión en líneas normales del pedido (T125).
 * No emite nada por sí sola (principio I).
 */
export function aprobarPropuestaDeCaptura(): {
  ok: true
  lineasAgregadas: number
  textosOriginales: readonly string[]
} | {
  ok: false
  motivo: string
} {
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
  const pedido = usarPedido.getState()
  let agregadas = 0

  for (const linea of captura.lineas) {
    if (linea.seleccion === null) continue
    const producto = catalogo.productoPorCodigo(linea.seleccion)
    const candidato = linea.candidatos.find((c) => c.codigo === linea.seleccion)
    if (producto === undefined && candidato === undefined) continue
    pedido.agregarLinea({
      codigo: producto?.codigo ?? candidato!.codigo,
      descripcion: producto?.descripcion ?? candidato!.descripcion,
      unidad: producto?.unidad ?? candidato!.unidad,
      cantidad: linea.cantidad > 0 ? linea.cantidad : 1,
      precio: producto?.precio ?? 0,
    })
    agregadas += 1
  }

  pedido.fijarOrigen({ capturaId: captura.capturaId })
  captura.cancelar()
  return { ok: true, lineasAgregadas: agregadas, textosOriginales }
}

export function lineasResueltas(
  lineas: readonly LineaDeCapturaEditable[],
): number {
  return lineas.filter((l) => l.estadoLinea === 'resuelta' && l.seleccion).length
}
