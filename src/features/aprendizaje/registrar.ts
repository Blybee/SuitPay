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
  readonly clienteId?: string | null
}): void {
  if (entrada.pares.length === 0) return
  void registrarRevisionFn({
    data: {
      medio: entrada.medio,
      pares: [...entrada.pares],
      clienteId: entrada.clienteId ?? undefined,
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
  originales: readonly string[],
  lineas: readonly LineaDePedido[],
): {
  readonly textoOriginal: string
  readonly codigoAprobado: string
  readonly descripcionAprobada: string
}[] {
  return lineas.map((linea, i) => ({
    textoOriginal: originales[i] ?? linea.descripcion,
    codigoAprobado: linea.codigo,
    descripcionAprobada: linea.descripcion,
  }))
}
