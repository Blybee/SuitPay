/**
 * Factor de conversión (*conversion factor*) de una unidad de empaque
 * a la unidad base (NIU). El mapa es por SKU: bolsa puede ser 25 en uno
 * y 50 en otro.
 */

export const FACTOR_MINIMO = 2
export const FACTOR_MAXIMO = 10_000

export type MapaDeCantidades = Readonly<Record<string, number>>

export interface EvidenciaDeEmpaque {
  readonly unidad: string
  readonly bultos: number
  readonly unidades: number
}

export interface FactorPropuesto {
  readonly unidad: string
  readonly factor: number
  readonly anterior?: number
}

const ALIAS_DE_EMPAQUE: Readonly<Record<string, string>> = {
  bolsa: 'bolsa',
  bolsas: 'bolsa',
  bls: 'bolsa',
  bl: 'bolsa',
  saco: 'saco',
  sacos: 'saco',
  caja: 'caja',
  cajas: 'caja',
  cja: 'caja',
  cjas: 'caja',
  paquete: 'paquete',
  paquetes: 'paquete',
  paq: 'paquete',
  pkg: 'paquete',
  rollo: 'rollo',
  rollos: 'rollo',
  atado: 'atado',
  atados: 'atado',
  fardo: 'fardo',
  fardos: 'fardo',
  docena: 'docena',
  docenas: 'docena',
  doc: 'docena',
  dz: 'docena',
  ciento: 'ciento',
  cientos: 'ciento',
  millar: 'millar',
  millares: 'millar',
  mll: 'millar',
}

/** Múltiplos fijos. Un valor aprendido en el SKU los reemplaza. */
export const MULTIPLOS_FIJOS: Readonly<Record<string, number>> = {
  docena: 12,
  ciento: 100,
  millar: 1000,
}

const EMPAQUE_VARIABLE = new Set([
  'bolsa',
  'saco',
  'caja',
  'paquete',
  'rollo',
  'atado',
  'fardo',
])

export function canonicoDeEmpaque(texto: string): string | null {
  const clave = texto
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\.$/, '')
  if (clave === '') return null
  return ALIAS_DE_EMPAQUE[clave] ?? null
}

export function esEmpaqueVariable(unidad: string): boolean {
  return EMPAQUE_VARIABLE.has(unidad)
}

export function esFactorValido(valor: unknown): valor is number {
  return (
    typeof valor === 'number' &&
    Number.isInteger(valor) &&
    valor >= FACTOR_MINIMO &&
    valor <= FACTOR_MAXIMO
  )
}

/**
 * Aprendido del SKU si existe; si no, el múltiplo fijo (docena, ciento, millar).
 */
export function factorDeUnidad(
  unidad: string,
  aprendidas?: MapaDeCantidades,
): number | null {
  const canon = canonicoDeEmpaque(unidad)
  if (canon === null) return null
  const aprendido = aprendidas?.[canon]
  if (esFactorValido(aprendido)) return aprendido
  return MULTIPLOS_FIJOS[canon] ?? null
}

/**
 * unidades / bultos, solo si la división es entera y la unidad es de empaque
 * variable. Docena, ciento y millar no se aprenden: viven en código.
 */
const PREFIJO_EMPAQUE =
  /^(\d+)\s+(bolsas?|bls|sacos?|cajas?|cja|paquetes?|paq|rollos?|atados?|fardos?)\b/i

/**
 * Atajo del entrenamiento simulado: el pedido abre con «N bolsa» y el oro
 * escribe CANTIDAD junto al SKU. El modelo real no usa esta función.
 */
export function evidenciaSimulada(
  textoPedido: string,
  textoOro: string,
  codigo: string,
): EvidenciaDeEmpaque | null {
  const match = textoPedido.trim().match(PREFIJO_EMPAQUE)
  const unidad = match?.[2]
  const bultos = match?.[1] !== undefined ? Number(match[1]) : Number.NaN
  if (unidad === undefined || !Number.isInteger(bultos) || bultos < 1) return null
  const indice = textoOro.toLowerCase().indexOf(codigo.toLowerCase())
  if (indice < 0) return null
  const ventana = textoOro.slice(indice, indice + 180)
  const cantidad = ventana.match(/cantidad\s*:?\s*(\d+)/i)
  if (cantidad?.[1] === undefined) return null
  const unidades = Number(cantidad[1])
  if (!Number.isInteger(unidades) || unidades < 1) return null
  return { unidad, bultos, unidades }
}

export function factorDesdeEvidencia(
  evidencia: EvidenciaDeEmpaque,
): { readonly unidad: string; readonly factor: number } | null {
  const unidad = canonicoDeEmpaque(evidencia.unidad)
  if (unidad === null || !esEmpaqueVariable(unidad)) return null
  const { bultos, unidades } = evidencia
  if (!Number.isInteger(bultos) || bultos < 1) return null
  if (!Number.isInteger(unidades) || unidades < 1) return null
  if (unidades % bultos !== 0) return null
  const factor = unidades / bultos
  if (!esFactorValido(factor)) return null
  return { unidad, factor }
}

/**
 * Funde propuestas en el mapa vigente. Dos factores distintos para la misma
 * clave en el mismo par no se escriben: queda el valor anterior.
 */
export function fusionarCantidades(
  actual: MapaDeCantidades | undefined,
  propuestas: readonly { readonly unidad: string; readonly factor: number }[],
): MapaDeCantidades | undefined {
  const vistos = new Map<string, number | 'conflicto'>()
  for (const propuesta of propuestas) {
    if (!esEmpaqueVariable(propuesta.unidad) || !esFactorValido(propuesta.factor)) {
      continue
    }
    const ya = vistos.get(propuesta.unidad)
    if (ya === 'conflicto') continue
    if (ya === undefined) vistos.set(propuesta.unidad, propuesta.factor)
    else if (ya !== propuesta.factor) vistos.set(propuesta.unidad, 'conflicto')
  }
  const siguiente: Record<string, number> = { ...(actual ?? {}) }
  for (const [unidad, factor] of vistos) {
    if (factor === 'conflicto') continue
    siguiente[unidad] = factor
  }
  return Object.keys(siguiente).length > 0 ? siguiente : undefined
}

export function factoresVisibles(
  evidencias: readonly EvidenciaDeEmpaque[],
  previas?: MapaDeCantidades,
): FactorPropuesto[] {
  const vistos = new Map<string, number | 'conflicto'>()
  for (const evidencia of evidencias) {
    const factor = factorDesdeEvidencia(evidencia)
    if (factor === null) continue
    const ya = vistos.get(factor.unidad)
    if (ya === 'conflicto') continue
    if (ya === undefined) vistos.set(factor.unidad, factor.factor)
    else if (ya !== factor.factor) vistos.set(factor.unidad, 'conflicto')
  }
  const salida: FactorPropuesto[] = []
  for (const [unidad, factor] of vistos) {
    if (factor === 'conflicto') continue
    const anterior = previas?.[unidad]
    salida.push(
      anterior !== undefined && anterior !== factor
        ? { unidad, factor, anterior }
        : { unidad, factor },
    )
  }
  return salida
}

export function textoDeFactor(
  unidad: string,
  factor: number,
  anterior?: number,
): string {
  if (anterior !== undefined && anterior !== factor) {
    return `${unidad}: ${anterior} → ${factor}`
  }
  return `${unidad} = ${factor} u`
}

export interface RenglonConEmpaque {
  readonly cantidad: number
  readonly unidad: string
  readonly bultos?: number
  readonly unidadEmpaque?: string
  readonly cantidades?: MapaDeCantidades
}

/**
 * El servidor multiplica bultos × factor una sola vez. Si no hay factor,
 * la cantidad queda como se dijo. «25 unidades» no es empaque.
 */
export function aplicarFactorARenglon(
  entrada: RenglonConEmpaque,
): { readonly cantidad: number; readonly unidad: string } {
  const dicha =
    entrada.unidadEmpaque !== undefined && entrada.unidadEmpaque.trim() !== ''
      ? entrada.unidadEmpaque
      : entrada.unidad
  const canon = canonicoDeEmpaque(dicha)
  if (canon === null) {
    return {
      cantidad: entrada.cantidad,
      unidad: entrada.unidad.trim() !== '' ? entrada.unidad : 'NIU',
    }
  }
  const factor = factorDeUnidad(canon, entrada.cantidades)
  if (factor === null) {
    return { cantidad: entrada.cantidad, unidad: canon }
  }
  const bultos =
    entrada.bultos !== undefined &&
    Number.isInteger(entrada.bultos) &&
    entrada.bultos > 0
      ? entrada.bultos
      : entrada.cantidad
  return { cantidad: bultos * factor, unidad: 'NIU' }
}

export function mapasDeCantidadesIguales(
  izquierda: MapaDeCantidades | undefined,
  derecha: MapaDeCantidades | undefined,
): boolean {
  const a = izquierda ?? {}
  const b = derecha ?? {}
  const claves = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const clave of claves) {
    if (a[clave] !== b[clave]) return false
  }
  return true
}

export function cantidadesDesdeDocumento(
  valor: unknown,
): MapaDeCantidades | undefined {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return undefined
  const salida: Record<string, number> = {}
  for (const [clave, crudo] of Object.entries(valor as Record<string, unknown>)) {
    const canon = canonicoDeEmpaque(clave)
    if (canon === null || !esFactorValido(crudo)) continue
    salida[canon] = crudo
  }
  return Object.keys(salida).length > 0 ? salida : undefined
}
