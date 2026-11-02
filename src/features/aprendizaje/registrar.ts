import { registrarRevisionFn } from './aprendizaje.funciones.ts'
import type { LineaCapturaAprobada } from '../captura/aprobar.ts'
import type { LineaDePedido } from '../../domain/totales/calculo.ts'

export function registrarParesEnSegundoPlano(entrada: {
  readonly medio: string
  readonly pares: readonly {
    readonly textoOriginal: string
    readonly codigoAprobado: string
    readonly descripcionAprobada: string
  }[]
}): void {
  if (entrada.pares.length === 0) return
  void registrarRevisionFn({
    data: {
      medio: entrada.medio,
      pares: [...entrada.pares],
    },
  })
}

export function paresDesdeCaptura(
  lineas: readonly LineaCapturaAprobada[],
): {
  readonly textoOriginal: string
  readonly codigoAprobado: string
  readonly descripcionAprobada: string
}[] {
  return lineas.map((l) => ({
    textoOriginal: l.textoOriginal,
    codigoAprobado: l.codigo,
    descripcionAprobada: l.descripcion,
  }))
}

export function paresDesdePedido(
  lineas: readonly LineaDePedido[],
): {
  readonly textoOriginal: string
  readonly codigoAprobado: string
  readonly descripcionAprobada: string
}[] {
  return lineas.map((linea) => ({
    textoOriginal: linea.textoOriginal?.trim() || linea.descripcion,
    codigoAprobado: linea.codigo,
    descripcionAprobada: linea.descripcion,
  }))
}
