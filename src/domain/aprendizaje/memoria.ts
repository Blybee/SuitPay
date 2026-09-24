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
  /** Nombre del compacto. Solo para revisar el par; no se persiste. */
  readonly nombreCatalogo?: string
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

/** ~11 % de la ventana de entrada de Gemini 3.8 Flash (1 048 576). */
export const PRESUPUESTO_BLOQUE_TOKENS = 120_000
export const CARACTERES_POR_TOKEN = 4
export const TOPE_DOCUMENTO_BYTES = 900 * 1024
export const TAMANO_PAGINA_MEMORIA = 10
/** Una tanda de revisión deja sitio a la respuesta del modelo. */
export const TOPE_TANDA_REVISION_CARACTERES = 300_000

export interface PresupuestoDeMemoria {
  readonly caracteres: number
  readonly tokens: number
  readonly superaPresupuesto: boolean
  readonly bytesDocumento: number
  readonly documentoLleno: boolean
}

export interface PaginaDeMemoria {
  readonly entradas: readonly (readonly [string, EntradaDeMemoria])[]
  readonly hayMas: boolean
  readonly cursorSiguiente: string | null
}

export interface CambioDeRevision {
  readonly codigo: string
  readonly aliases: readonly string[]
  readonly etiquetas: readonly string[]
  readonly quitados: readonly string[]
  readonly motivo: string
}

export function caracteresDelBloque(mapa: MapaDeMemoria): number {
  let total = 0
  for (const entrada of Object.values(mapa)) {
    for (const alias of entrada.aliases) total += alias.length
    for (const etiqueta of entrada.etiquetas) total += etiqueta.length
  }
  return total
}

export function medirMemoria(
  mapa: MapaDeMemoria,
  marcas: unknown = {},
): PresupuestoDeMemoria {
  const caracteres = caracteresDelBloque(mapa)
  const tokens = Math.ceil(caracteres / CARACTERES_POR_TOKEN)
  const bytesDocumento = new TextEncoder().encode(
    JSON.stringify({ productos: mapa, marcas }),
  ).length
  return {
    caracteres,
    tokens,
    superaPresupuesto: tokens > PRESUPUESTO_BLOQUE_TOKENS,
    bytesDocumento,
    documentoLleno: bytesDocumento > TOPE_DOCUMENTO_BYTES,
  }
}

/**
 * El prompt recibe la memoria entera. Cruzar el presupuesto no recorta alias.
 */
export function memoriaParaPrompt(mapa: MapaDeMemoria): MapaDeMemoria {
  return mapa
}

export function paginarMemoria(
  mapa: MapaDeMemoria,
  opciones: { readonly limite?: number; readonly cursor?: string } = {},
): PaginaDeMemoria {
  const limite = opciones.limite ?? TAMANO_PAGINA_MEMORIA
  const ordenadas = Object.entries(mapa).sort(([a], [b]) => a.localeCompare(b))
  let desde = 0
  if (opciones.cursor !== undefined && opciones.cursor !== '') {
    const cursor = opciones.cursor
    const indice = ordenadas.findIndex(
      ([codigo]) => codigo.localeCompare(cursor) > 0,
    )
    desde = indice === -1 ? ordenadas.length : indice
  }
  const entradas = ordenadas.slice(desde, desde + limite)
  const hayMas = desde + limite < ordenadas.length
  const ultimo = entradas[entradas.length - 1]
  return {
    entradas,
    hayMas,
    cursorSiguiente: hayMas && ultimo !== undefined ? ultimo[0] : null,
  }
}

function repetidos(valores: readonly string[]): string[] {
  const vistos = new Set<string>()
  const quitados: string[] = []
  for (const valor of valores) {
    const clave = valor.trim().toLowerCase()
    if (clave === '' || vistos.has(clave)) quitados.push(valor)
    else vistos.add(clave)
  }
  return quitados
}

/** Deduplicación exacta (mayúsculas y espacios). No fusiona coloquiales distintos. */
export function propuestaDeDeduplicacion(
  mapa: MapaDeMemoria,
): CambioDeRevision[] {
  const cambios: CambioDeRevision[] = []
  for (const [codigo, entrada] of Object.entries(mapa)) {
    const quitadosAlias = repetidos(entrada.aliases)
    const quitadosEtiqueta = repetidos(entrada.etiquetas)
    const quitados = [...quitadosAlias, ...quitadosEtiqueta]
    if (quitados.length === 0) continue
    cambios.push({
      codigo,
      aliases: unicos(entrada.aliases),
      etiquetas: unicos(entrada.etiquetas),
      quitados,
      motivo: 'Mismo texto salvo mayúsculas o espacios.',
    })
  }
  return cambios.sort((a, b) => a.codigo.localeCompare(b.codigo))
}

/**
 * Solo los códigos con una repetición visible. El resto no se manda al modelo.
 */
export function memoriaConIndicio(mapa: MapaDeMemoria): MapaDeMemoria {
  const salida: MapaDeMemoria = {}
  for (const [codigo, entrada] of Object.entries(mapa)) {
    if (repetidos(entrada.aliases).length > 0 || repetidos(entrada.etiquetas).length > 0) {
      salida[codigo] = entrada
      continue
    }
    const aliases = entrada.aliases.map((alias) => alias.trim().toLowerCase()).filter((alias) => alias.length >= 8)
    const hayContenido = aliases.some((corto, indice) =>
      aliases.some(
        (largo, otro) =>
          otro !== indice && largo !== corto && largo.includes(corto),
      ),
    )
    if (hayContenido) salida[codigo] = entrada
  }
  return salida
}

function cabeEnAlguno(texto: string, originales: readonly string[]): boolean {
  const clave = texto.trim().toLowerCase()
  if (clave === '') return false
  return originales.some((original) => {
    const base = original.trim().toLowerCase()
    return base === clave || base.includes(clave)
  })
}

/**
 * La propuesta solo se aplica si fue autorizada. Cada alias que queda
 * tiene que existir ya o ser un fragmento de uno existente.
 */
export function aplicarPropuestaDeRevision(
  actual: MapaDeMemoria,
  cambios: readonly CambioDeRevision[],
  autorizada: boolean,
): MapaDeMemoria {
  if (!autorizada) return actual
  const siguiente: MapaDeMemoria = { ...actual }
  for (const cambio of cambios) {
    const previa = siguiente[cambio.codigo]
    if (previa === undefined) continue
    const aliases = unicos(cambio.aliases).filter((alias) =>
      cabeEnAlguno(alias, previa.aliases),
    )
    const etiquetas = unicos(cambio.etiquetas).filter((etiqueta) =>
      cabeEnAlguno(etiqueta, previa.etiquetas),
    )
    siguiente[cambio.codigo] = { aliases, etiquetas }
  }
  return siguiente
}

export function tandasDeRevision(
  mapa: MapaDeMemoria,
): MapaDeMemoria[] {
  const codigos = Object.keys(mapa).sort((a, b) => a.localeCompare(b))
  const tandas: MapaDeMemoria[] = []
  let tanda: MapaDeMemoria = {}
  let caracteres = 0
  for (const codigo of codigos) {
    const entrada = mapa[codigo]
    if (entrada === undefined) continue
    if (entrada.aliases.length === 0 && entrada.etiquetas.length === 0) continue
    const peso =
      entrada.aliases.reduce((suma, alias) => suma + alias.length, 0) +
      entrada.etiquetas.reduce((suma, etiqueta) => suma + etiqueta.length, 0)
    if (
      caracteres > 0 &&
      caracteres + peso > TOPE_TANDA_REVISION_CARACTERES
    ) {
      tandas.push(tanda)
      tanda = {}
      caracteres = 0
    }
    tanda[codigo] = entrada
    caracteres += peso
  }
  if (Object.keys(tanda).length > 0) tandas.push(tanda)
  return tandas
}
