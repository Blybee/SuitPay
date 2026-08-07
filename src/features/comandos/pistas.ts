/**
 * Pistas de parámetros para el buscador en modo comando (`/…`).
 * Catálogo cerrado: al añadir un comando, registrar aquí prefijo + parámetros.
 */

export interface DefinicionDeComando {
  readonly id: string
  /** Prefijo canónico, p. ej. `/crear vecino`. */
  readonly prefijo: string
  /** Tokens tras el prefijo, p. ej. `{alias}`, `{DNI/RUC}`. */
  readonly parametros: readonly string[]
}

/** Más específico primero (prefijos más largos). */
export const CATALOGO_DE_COMANDOS: readonly DefinicionDeComando[] = [
  {
    id: 'crear-vecino',
    prefijo: '/crear vecino',
    parametros: ['{alias}', '{DNI/RUC}'],
  },
]

const PLACEHOLDER_PRODUCTO = 'Escribe un producto…'

export function esModoComando(termino: string): boolean {
  return termino.trimStart().startsWith('/')
}

export interface PistaDeComando {
  /** Texto fantasma tras lo escrito (complemento del prefijo o parámetros). */
  readonly fantasma: string
  /** Plantilla completa; útil como placeholder cuando el valor es solo `/`. */
  readonly plantilla: string | null
}

/**
 * Placeholder del input.
 * Con valor vacío: producto. En modo comando incompleto: plantilla del comando
 * (el nativo solo se ve si el campo está vacío; el fantasma cubre el resto).
 */
export function placeholderDelBuscador(termino: string): string {
  if (termino.length === 0) return PLACEHOLDER_PRODUCTO
  if (esModoComando(termino)) {
    const pista = pistaDeComando(termino)
    return pista.plantilla ?? '/comando…'
  }
  return PLACEHOLDER_PRODUCTO
}

function tokensTrasPrefijo(resto: string): readonly string[] {
  const recortado = resto.trim()
  if (recortado === '') return []
  return recortado.split(/\s+/).filter((t) => t.length > 0)
}

/**
 * Resuelve la pista según lo tecleado.
 *
 * - `/` → fantasma `crear vecino {alias} {DNI/RUC}`
 * - `/crear ve` → completa el prefijo + params
 * - `/crear vecino` → ` {alias} {DNI/RUC}`
 * - `/crear vecino wilmer` → ` {DNI/RUC}`
 * - completo → ``
 */
export function pistaDeComando(termino: string): PistaDeComando {
  if (!esModoComando(termino)) {
    return { fantasma: '', plantilla: null }
  }

  const escrito = termino.trimStart()
  const clave = escrito.toLowerCase().replace(/\s+/g, ' ').trimEnd()

  const coincidencia = CATALOGO_DE_COMANDOS.find((comando) => {
    const prefijo = comando.prefijo.toLowerCase()
    return (
      clave === prefijo ||
      clave.startsWith(`${prefijo} `) ||
      prefijo.startsWith(clave)
    )
  })

  if (coincidencia === undefined) {
    if (clave === '/') {
      const listado = CATALOGO_DE_COMANDOS.map(
        (c) => `${c.prefijo.slice(1)} ${c.parametros.join(' ')}`,
      ).join(' · ')
      return { fantasma: listado, plantilla: `/${listado}` }
    }
    return { fantasma: '', plantilla: null }
  }

  const prefijo = coincidencia.prefijo
  const params = coincidencia.parametros.join(' ')
  const plantilla = `${prefijo} ${params}`
  const prefijoClave = prefijo.toLowerCase()

  // Prefijo incompleto: completar lo que falta del prefijo + todos los params.
  if (clave.length < prefijoClave.length) {
    // Comparar carácter a carácter sobre el prefijo canónico vs lo escrito
    // en minúsculas (sin colapsar espacios del valor crudo para el slice).
    const escritoMinus = escrito.toLowerCase()
    let i = 0
    while (
      i < escritoMinus.length &&
      i < prefijoClave.length &&
      escritoMinus[i] === prefijoClave[i]
    ) {
      i += 1
    }
    // Si divergen por espacios normalizados, usar longitud del trim.
    const completar =
      i < prefijo.length ? prefijo.slice(Math.min(i, prefijo.length)) : ''
    const cuerpo =
      completar.length > 0 ? `${completar} ${params}` : ` ${params}`
    return { fantasma: cuerpo, plantilla }
  }

  const resto = escrito.slice(prefijo.length)
  const tokens = tokensTrasPrefijo(resto)
  // El token en curso no se muestra otra vez: faltan los siguientes.
  const restantes = coincidencia.parametros.slice(tokens.length)

  if (restantes.length === 0) {
    return { fantasma: '', plantilla }
  }

  const separador = /\s$/.test(escrito) ? '' : ' '
  return {
    fantasma: `${separador}${restantes.join(' ')}`,
    plantilla,
  }
}
