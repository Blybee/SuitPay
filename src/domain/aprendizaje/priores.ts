/**
 * Priores de marca por familia. `peso` se deriva de `n` (Laplace: n + 1).
 */

export const FAMILIA_GLOBAL = '_global'

const TOKENS_DE_FAMILIA: readonly string[] = [
  'codo',
  'tee',
  'niple',
  'union',
  'unión',
  'reduccion',
  'reducción',
  'llave',
  'valvula',
  'válvula',
  'tubo',
  'tuberia',
  'tubería',
  'pegamento',
  'soldadura',
  'sumidero',
  'sifon',
  'sifón',
  'grifo',
  'ducha',
  'flexible',
  'abrazadera',
  'tapon',
  'tapón',
  'adaptador',
  'cruz',
  'curva',
  'colector',
]

export interface ConteoDeMarca {
  readonly n: number
  readonly peso: number
}

/** familia → marca → conteo */
export type MapaDeMarcas = Record<string, Record<string, ConteoDeMarca>>

export interface DeltaDeMarca {
  readonly familia: string
  readonly marca: string
  readonly delta: number
}

export function pesoLaplace(n: number): number {
  return Math.max(0, n) + 1
}

export function claveDeFamilia(valor: string): string {
  const limpio = valor.trim().toLowerCase()
  return limpio === '' ? FAMILIA_GLOBAL : limpio.slice(0, 40)
}

export function familiaDeProducto(entrada: {
  readonly descripcion: string
  readonly categoriaNombre?: string | null
}): string {
  const categoria = entrada.categoriaNombre?.trim() ?? ''
  if (categoria !== '') return claveDeFamilia(categoria)
  const texto = entrada.descripcion.toLowerCase()
  for (const token of TOKENS_DE_FAMILIA) {
    if (texto.includes(token)) return claveDeFamilia(token)
  }
  return FAMILIA_GLOBAL
}

export function aplicarDeltasDeMarca(
  actual: MapaDeMarcas,
  deltas: readonly DeltaDeMarca[],
): MapaDeMarcas {
  const siguiente: MapaDeMarcas = {}
  for (const [familia, marcas] of Object.entries(actual)) {
    siguiente[familia] = { ...marcas }
  }
  for (const delta of deltas) {
    const marca = delta.marca.trim()
    if (marca === '' || delta.delta === 0) continue
    const familia = claveDeFamilia(delta.familia)
    const grupo = { ...(siguiente[familia] ?? {}) }
    const previa = grupo[marca]?.n ?? 0
    const n = Math.max(0, previa + delta.delta)
    grupo[marca] = { n, peso: pesoLaplace(n) }
    siguiente[familia] = grupo
  }
  return siguiente
}

export function deltasDeMarcaDesdeCodigos(
  codigos: readonly string[],
  porCodigo: Readonly<
    Record<string, { readonly marca: string; readonly familia: string }>
  >,
): DeltaDeMarca[] {
  const acumulado = new Map<string, DeltaDeMarca>()
  for (const codigo of codigos) {
    const fila = porCodigo[codigo]
    if (fila === undefined) continue
    const marca = fila.marca.trim()
    if (marca === '') continue
    const familia = claveDeFamilia(fila.familia)
    const clave = `${familia}\0${marca}`
    const previa = acumulado.get(clave)
    acumulado.set(clave, {
      familia,
      marca,
      delta: (previa?.delta ?? 0) + 1,
    })
  }
  return [...acumulado.values()]
}

/**
 * JSON compacto para el prompt. Sin identidad. Familias vacías se omiten.
 */
export function textoDePrioresParaPrompt(mapa: MapaDeMarcas): string {
  const plano: Record<string, Record<string, number>> = {}
  for (const [familia, marcas] of Object.entries(mapa)) {
    const fila: Record<string, number> = {}
    for (const [marca, conteo] of Object.entries(marcas)) {
      if (conteo.n <= 0) continue
      fila[marca] = conteo.peso
    }
    if (Object.keys(fila).length === 0) continue
    plano[familia] = fila
  }
  return JSON.stringify(plano)
}

export function marcasDesdeDocumento(
  crudo: unknown,
): MapaDeMarcas {
  if (!crudo || typeof crudo !== 'object' || Array.isArray(crudo)) return {}
  const mapa: MapaDeMarcas = {}
  for (const [familia, valor] of Object.entries(
    crudo as Record<string, unknown>,
  )) {
    if (!valor || typeof valor !== 'object' || Array.isArray(valor)) continue
    const grupo: Record<string, ConteoDeMarca> = {}
    for (const [marca, fila] of Object.entries(
      valor as Record<string, unknown>,
    )) {
      if (!fila || typeof fila !== 'object') continue
      const n = (fila as { n?: unknown }).n
      const entero = typeof n === 'number' && Number.isFinite(n) ? n : 0
      grupo[marca] = { n: entero, peso: pesoLaplace(entero) }
    }
    if (Object.keys(grupo).length > 0) mapa[familia] = grupo
  }
  return mapa
}
