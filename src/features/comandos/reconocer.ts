import { OPERACIONES_DE_CONSULTA } from './catalogo.ts'
import type { IdDeConsulta, OperacionDeConsulta } from './catalogo.ts'

/**
 * Despacho de instrucciones del buscador (US9).
 * Consultas sí; escritura de comprobantes nunca (principio I / FR-048).
 */

export type ResultadoDeReconocer =
  | {
      readonly tipo: 'consulta'
      readonly operacion: OperacionDeConsulta
      readonly argumentos: readonly string[]
    }
  | {
      readonly tipo: 'incompleto'
      readonly operacion: OperacionDeConsulta
      readonly faltantes: readonly string[]
    }
  | {
      readonly tipo: 'escritura_prohibida'
      readonly mensaje: string
      readonly donde: string
    }
  | {
      readonly tipo: 'desconocido'
      readonly escrito: string
    }

const ESCRITURAS_DE_COMPROBANTE: readonly {
  readonly patron: RegExp
  readonly donde: string
}[] = [
  {
    patron: /\/anular\b/i,
    donde: 'el detalle del comprobante, con el botón Anular',
  },
  {
    patron: /\/emitir\b/i,
    donde: 'el botón Emitir del mostrador, tras revisar el pedido',
  },
  {
    patron: /\/eliminar\b/i,
    donde: 'el detalle del comprobante; los comprobantes no se borran',
  },
  {
    patron: /\/baja\b|\/dar\s+de\s+baja\b/i,
    donde: 'el detalle del comprobante, con el botón Anular',
  },
  {
    patron:
      /\b(anula|anular|emite|emitir|elimina|eliminar|da de baja|dar de baja)\b[\s\S]{0,40}\b(boleta|factura|comprobante|nota de venta|nota)\b/i,
    donde: 'el mostrador (Emitir) o el detalle del comprobante (Anular)',
  },
]

export function reconocer(texto: string): ResultadoDeReconocer {
  const escrito = texto.trim()
  if (escrito.length === 0) {
    return { tipo: 'desconocido', escrito }
  }

  for (const regla of ESCRITURAS_DE_COMPROBANTE) {
    if (regla.patron.test(escrito)) {
      return {
        tipo: 'escritura_prohibida',
        mensaje:
          'Esa operación no se hace con una instrucción. Los comprobantes solo se emiten o anulan con confirmación explícita.',
        donde: regla.donde,
      }
    }
  }

  const clave = escrito.toLowerCase().replace(/\s+/g, ' ')
  const operacion = OPERACIONES_DE_CONSULTA.find((cada) => {
    const prefijo = cada.prefijo.toLowerCase()
    return clave === prefijo || clave.startsWith(`${prefijo} `)
  })

  if (operacion === undefined) {
    return { tipo: 'desconocido', escrito }
  }

  const resto = escrito.slice(operacion.prefijo.length).trim()
  const argumentos =
    resto.length === 0 ? [] : resto.split(/\s+/).filter((t) => t.length > 0)
  const faltantes = operacion.parametros.slice(argumentos.length)

  if (faltantes.length > 0) {
    return { tipo: 'incompleto', operacion, faltantes }
  }

  return { tipo: 'consulta', operacion, argumentos }
}

export function idReconocido(texto: string): IdDeConsulta | null {
  const resultado = reconocer(texto)
  if (resultado.tipo === 'consulta' || resultado.tipo === 'incompleto') {
    return resultado.operacion.id
  }
  return null
}
