import type { EntradaDeMemoria } from './compacto.ts'

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
