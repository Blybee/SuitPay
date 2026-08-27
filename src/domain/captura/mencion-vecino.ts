/**
 * Resuelve el alias de un vecino en el texto oído, dentro del sistema.
 * El modelo no recibe la lista de vecinos (principio IV).
 */

export interface VecinoMencionable {
  readonly id: string
  readonly alias: string
}

function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function hablado(textos: readonly string[]): string {
  return textos.join(' ').trim()
}

/**
 * Si el dictado nombra un alias conocido, devuelve ese vecino.
 * Prefiere el alias más largo (p. ej. "don wilmer" antes que "wilmer").
 * Si no hay mención, null → el llamador usa el pill activo.
 */
export function extraerMencionDeVecino(
  textos: readonly string[],
  vecinos: readonly VecinoMencionable[],
): VecinoMencionable | null {
  const texto = hablado(textos).toLowerCase()
  if (texto === '' || vecinos.length === 0) return null

  const ordenados = [...vecinos]
    .filter((cada) => cada.alias.trim() !== '')
    .sort((a, b) => b.alias.trim().length - a.alias.trim().length)

  for (const vecino of ordenados) {
    const alias = vecino.alias.trim().toLowerCase()
    const limite = escaparRegex(alias)
    const patron = new RegExp(
      `(?:\\b(?:para|vecino|vecina|al\\s+vecino|a)\\s+)?\\b${limite}\\b`,
      'i',
    )
    if (patron.test(texto)) return vecino
  }
  return null
}

export function resolverDestinoDeVecino(entrada: {
  readonly textos: readonly string[]
  readonly vecinos: readonly VecinoMencionable[]
  readonly activoId: string | null
}): string | null {
  const mencion = extraerMencionDeVecino(entrada.textos, entrada.vecinos)
  if (mencion !== null) return mencion.id
  return entrada.activoId
}
