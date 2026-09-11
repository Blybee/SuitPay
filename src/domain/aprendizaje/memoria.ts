import type { EntradaDeMemoria } from './compacto.ts'

export type EstadoDeAlineacion =
  | 'emparejado'
  | 'omitido'
  | 'no_en_catalogo'

export interface AlineacionDeEntrenamiento {
  readonly textoPedido: string
  readonly codigo: string
  readonly marca: string
  readonly estado: EstadoDeAlineacion
  readonly aliases: readonly string[]
  readonly etiquetas: readonly string[]
}

export interface CoberturaDeEntrenamiento {
  readonly pedidos: number
  readonly cotizados: number
  readonly omitidos: number
}

export interface DiffDeProducto {
  readonly codigo: string
  readonly aliases: readonly string[]
  readonly etiquetas: readonly string[]
  readonly agregados: readonly string[]
  readonly quitados: readonly string[]
}

export type MapaDeMemoria = Record<string, EntradaDeMemoria>

function unicos(valores: readonly string[]): string[] {
  const vistos = new Set<string>()
  const salida: string[] = []
  for (const valor of valores) {
    const clave = valor.trim().toLowerCase()
    if (clave === '' || vistos.has(clave)) continue
    vistos.add(clave)
    salida.push(valor.trim())
  }
  return salida
}

/**
 * Aplica el diff del lote. Listas canónicas del modelo ganan;
 * si vienen vacías y hay quitados, se respetan los recortes.
 */
export function aplicarDiffDeMemoria(
  actual: MapaDeMemoria,
  diffs: readonly DiffDeProducto[],
): MapaDeMemoria {
  const siguiente: MapaDeMemoria = { ...actual }
  for (const diff of diffs) {
    const previa = siguiente[diff.codigo] ?? { aliases: [], etiquetas: [] }
    const aliases =
      diff.aliases.length > 0
        ? unicos(diff.aliases)
        : unicos(previa.aliases.filter((a) => !diff.quitados.includes(a)))
    const etiquetas =
      diff.etiquetas.length > 0
        ? unicos(diff.etiquetas)
        : unicos(previa.etiquetas.filter((e) => !diff.quitados.includes(e)))
    siguiente[diff.codigo] = { aliases, etiquetas }
  }
  return siguiente
}

export const VIDA_LOTE_MS = 3 * 24 * 60 * 60 * 1000

/**
 * Consolidación simulada: alias nuevos que aún no están en memoria.
 */
export function diffsDesdePares(
  pares: readonly { textoOriginal: string; codigoAprobado: string }[],
  memoria: MapaDeMemoria,
): DiffDeProducto[] {
  const porCodigo = new Map<string, Set<string>>()
  for (const par of pares) {
    const set = porCodigo.get(par.codigoAprobado) ?? new Set()
    set.add(par.textoOriginal.trim())
    porCodigo.set(par.codigoAprobado, set)
  }
  const diffs: DiffDeProducto[] = []
  for (const [codigo, textos] of porCodigo) {
    const previa = memoria[codigo]?.aliases ?? []
    const existentes = new Set(previa.map((a) => a.toLowerCase()))
    const agregados = [...textos].filter((t) => !existentes.has(t.toLowerCase()))
    if (agregados.length === 0) continue
    diffs.push({
      codigo,
      aliases: [...previa, ...agregados],
      etiquetas: memoria[codigo]?.etiquetas ?? [],
      agregados,
      quitados: [],
    })
  }
  return diffs
}

/**
 * Solo `emparejado` genera alias. omitido / no_en_catalogo no envenenan memoria.
 */
export function diffsDesdeAlineaciones(
  alineaciones: readonly AlineacionDeEntrenamiento[],
  memoria: MapaDeMemoria,
): DiffDeProducto[] {
  const pares = alineaciones
    .filter(
      (fila) =>
        fila.estado === 'emparejado' && fila.codigo.trim() !== '',
    )
    .flatMap((fila) => {
      const textos = [fila.textoPedido, ...fila.aliases]
        .map((t) => t.trim())
        .filter((t) => t !== '')
      return textos.map((textoOriginal) => ({
        textoOriginal,
        codigoAprobado: fila.codigo.trim(),
      }))
    })
  const diffs = diffsDesdePares(pares, memoria)
  const etiquetasPorCodigo = new Map<string, string[]>()
  for (const fila of alineaciones) {
    if (fila.estado !== 'emparejado' || fila.codigo.trim() === '') continue
    if (fila.etiquetas.length === 0) continue
    const codigo = fila.codigo.trim()
    const previas = etiquetasPorCodigo.get(codigo) ?? []
    etiquetasPorCodigo.set(codigo, [...previas, ...fila.etiquetas])
  }
  return diffs.map((diff) => {
    const extra = etiquetasPorCodigo.get(diff.codigo) ?? []
    if (extra.length === 0) return diff
    const etiquetas = unicos([...diff.etiquetas, ...extra])
    return { ...diff, etiquetas }
  })
}

export function coberturaDeAlineaciones(
  alineaciones: readonly AlineacionDeEntrenamiento[],
): CoberturaDeEntrenamiento {
  const pedidos = alineaciones.length
  const cotizados = alineaciones.filter((a) => a.estado === 'emparejado').length
  const omitidos = alineaciones.filter(
    (a) => a.estado === 'omitido' || a.estado === 'no_en_catalogo',
  ).length
  return { pedidos, cotizados, omitidos }
}
