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
  /** Texto breve para la lista seleccionable. */
  readonly descripcion: string
}

/** Más específico primero (prefijos más largos). */
export const CATALOGO_DE_COMANDOS: readonly DefinicionDeComando[] = [
  {
    id: 'crear-transportista',
    prefijo: '/crear transportista',
    parametros: ['{RUC}'],
    descripcion: 'Alta de transportista con confirmación',
  },
  {
    id: 'crear-vecino',
    prefijo: '/crear vecino',
    parametros: ['{alias}', '{DNI/RUC}', '{teléfono?}'],
    descripcion: 'Alta de vecino con cotización (teléfono opcional)',
  },
  {
    id: 'guia',
    prefijo: '/guia',
    parametros: [],
    descripcion: 'Abrir papeleta de guía de remisión',
  },
  {
    id: 'usar-cotizacion',
    prefijo: '/usar cotizacion',
    parametros: ['{n}'],
    descripcion: 'Cargar cotización al pedido',
  },
  {
    id: 'limpiar-pedido',
    prefijo: '/limpiar pedido',
    parametros: [],
    descripcion: 'Vaciar el pedido en curso',
  },
  {
    id: 'cotizacion',
    prefijo: '/cotizacion',
    parametros: ['{n}'],
    descripcion: 'Ver cotización por número',
  },
  {
    id: 'cotizaciones',
    prefijo: '/cotizaciones',
    parametros: [],
    descripcion: 'Ir al tab Cotizaciones',
  },
  {
    id: 'vecino',
    prefijo: '/vecino',
    parametros: ['{alias}'],
    descripcion: 'Abrir tab de un vecino',
  },
  {
    id: 'vecinos',
    prefijo: '/vecinos',
    parametros: [],
    descripcion: 'Ir al tab Vecinos',
  },
  {
    id: 'cliente',
    prefijo: '/cliente',
    parametros: ['{DNI/RUC}'],
    descripcion: 'Buscar cliente local',
  },
  {
    id: 'ayuda',
    prefijo: '/ayuda',
    parametros: [],
    descripcion: 'Listar comandos disponibles',
  },
  {
    id: 'audio-convierte-boleta-sin',
    prefijo: '/audio: convierte',
    parametros: ['{n}', 'a boleta sin dni'],
    descripcion: 'Voz: convierte {n} a boleta sin dni',
  },
  {
    id: 'audio-convierte-boleta-con',
    prefijo: '/audio: boleta con dni',
    parametros: ['{n}', '{DNI}'],
    descripcion: 'Voz: convierte {n} a boleta con dni {DNI}',
  },
  {
    id: 'audio-convierte-factura',
    prefijo: '/audio: factura con ruc',
    parametros: ['{n}', '{RUC}'],
    descripcion: 'Voz: convierte {n} a factura con ruc {RUC}',
  },
  {
    id: 'audio-agrega',
    prefijo: '/audio: agrega',
    parametros: ['{cantidad}', '{producto}'],
    descripcion: 'Voz: agrega {cantidad} {producto}',
  },
  {
    id: 'audio-cambia-tipo',
    prefijo: '/audio: cambia a',
    parametros: ['{nota|boleta|factura}'],
    descripcion: 'Voz: cambia a nota/boleta/factura',
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

function plantillaDe(comando: DefinicionDeComando): string {
  return comando.parametros.length === 0
    ? comando.prefijo
    : `${comando.prefijo} ${comando.parametros.join(' ')}`
}

function claveNormalizada(escrito: string): string {
  return escrito.trimStart().toLowerCase().replace(/\s+/g, ' ').trimEnd()
}

/**
 * Comandos del catálogo que coinciden con lo tecleado (lista seleccionable).
 * Con solo `/` devuelve todo el catálogo.
 */
export function comandosCoincidentes(
  termino: string,
): readonly DefinicionDeComando[] {
  if (!esModoComando(termino)) return []
  const clave = claveNormalizada(termino)
  if (clave === '/') return CATALOGO_DE_COMANDOS

  return CATALOGO_DE_COMANDOS.filter((comando) => {
    const prefijo = comando.prefijo.toLowerCase()
    const plantilla = plantillaDe(comando).toLowerCase()
    return (
      prefijo.startsWith(clave) ||
      clave.startsWith(`${prefijo} `) ||
      clave === prefijo ||
      plantilla.startsWith(clave)
    )
  })
}

/**
 * Texto a poner en el buscador al elegir un comando de la lista.
 * Deja un espacio final si faltan parámetros (para el fantasma).
 */
export function textoAlElegirComando(comando: DefinicionDeComando): string {
  if (comando.parametros.length === 0) return comando.prefijo
  return `${comando.prefijo} `
}

/**
 * Resuelve la pista según lo tecleado.
 *
 * - `/` → fantasma del primer comando coincidente (la lista muestra el catálogo)
 * - `/crear ve` → completa el prefijo + params
 * - `/crear vecino` → ` {alias} {DNI/RUC} {teléfono?}`
 * - completo → ``
 */
export function pistaDeComando(termino: string): PistaDeComando {
  if (!esModoComando(termino)) {
    return { fantasma: '', plantilla: null }
  }

  const escrito = termino.trimStart()
  const clave = claveNormalizada(termino)

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
      return { fantasma: '', plantilla: '/comando…' }
    }
    return { fantasma: '', plantilla: null }
  }

  const prefijo = coincidencia.prefijo
  const params = coincidencia.parametros.join(' ')
  const plantilla = plantillaDe(coincidencia)
  const prefijoClave = prefijo.toLowerCase()

  // Prefijo incompleto: completar lo que falta del prefijo + todos los params.
  if (clave.length < prefijoClave.length) {
    const escritoMinus = escrito.toLowerCase()
    let i = 0
    while (
      i < escritoMinus.length &&
      i < prefijoClave.length &&
      escritoMinus[i] === prefijoClave[i]
    ) {
      i += 1
    }
    const completar =
      i < prefijo.length ? prefijo.slice(Math.min(i, prefijo.length)) : ''
    if (params.length === 0) {
      return {
        fantasma: completar.length > 0 ? completar : '',
        plantilla,
      }
    }
    const cuerpo =
      completar.length > 0 ? `${completar} ${params}` : ` ${params}`
    return { fantasma: cuerpo, plantilla }
  }

  if (coincidencia.parametros.length === 0) {
    return { fantasma: '', plantilla }
  }

  const resto = escrito.slice(prefijo.length)
  const tokens = tokensTrasPrefijo(resto)
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
