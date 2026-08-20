import { consultarComprobantesDeCliente } from './comprobantes-cliente.ts'
import { consultarCotizacionPorNumero } from './cotizacion.ts'
import { reconocer } from './reconocer.ts'
import type { ResultadoDeReconocer } from './reconocer.ts'
import type { ResultadoDeComando } from './resultados.tsx'
import type { OperacionDeConsulta } from './catalogo.ts'

export interface DespachoDeComando {
  readonly reconocer: ResultadoDeReconocer
  readonly resultado?: ResultadoDeComando
  readonly pestana?: 'cotizaciones' | 'vecinos'
}

export async function despacharComando(
  texto: string,
): Promise<DespachoDeComando> {
  const reconocido = reconocer(texto)
  if (reconocido.tipo !== 'consulta') {
    return { reconocer: reconocido }
  }

  const { operacion, argumentos } = reconocido
  switch (operacion.id) {
    case 'cliente': {
      const pagina = await consultarComprobantesDeCliente(argumentos[0] ?? '')
      return {
        reconocer: reconocido,
        resultado: {
          tipo: 'comprobantes',
          cliente: argumentos[0] ?? '',
          items: pagina.items,
        },
      }
    }
    case 'cotizacion': {
      const pagina = await consultarCotizacionPorNumero(argumentos[0] ?? '')
      return {
        reconocer: reconocido,
        resultado: { tipo: 'cotizacion', cotizacion: pagina.cotizacion },
      }
    }
    case 'ayuda':
      return { reconocer: reconocido, resultado: { tipo: 'ayuda' } }
    case 'cotizaciones':
      return { reconocer: reconocido, pestana: 'cotizaciones' }
    case 'vecinos':
    case 'vecino':
      return { reconocer: reconocido, pestana: 'vecinos' }
    case 'limpiar-pedido':
    case 'usar-cotizacion':
      return {
        reconocer: reconocido,
        resultado: {
          tipo: 'mensaje',
          texto:
            'Esa acción se confirma en pantalla, no al escribir el comando. No modifica comprobantes.',
        },
      }
    default:
      return { reconocer: reconocido }
  }
}

export function mensajeDeProhibido(
  resultado: Extract<ResultadoDeReconocer, { tipo: 'escritura_prohibida' }>,
): ResultadoDeComando {
  return {
    tipo: 'mensaje',
    texto: `${resultado.mensaje} Se realiza en ${resultado.donde}.`,
  }
}

export type { OperacionDeConsulta }
