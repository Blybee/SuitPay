import type { Centimos } from '../totales/calculo.ts'
import { REGLAS  } from './tipos.ts'
import type {TipoDeDocumento} from './tipos.ts';

/**
 * El umbral de identificación del comprador.
 *
 * FR-021 obliga a exigir los datos del cliente cuando una boleta supera cierto
 * importe. Ese importe es de **origen regulatorio**, no una preferencia del
 * negocio: puede cambiar por norma sin que cambie nada más en SuitPay.
 *
 * Por eso todas las funciones de aquí reciben el umbral como argumento en lugar
 * de leer una constante. La constante convertiría un cambio de norma en un
 * despliegue, y lo peor de una constante enterrada no es el despliegue: es que
 * dentro de dos años nadie recuerde que ese número tenía origen legal.
 *
 * El valor vive en `config/parametros`.
 */

export interface ClienteIdentificado {
  readonly tipoDocumento: string
  readonly numeroDocumento: string
  readonly denominacion: string
}

export type ResultadoDeUmbral =
  | { readonly requiereCliente: false }
  | {
      readonly requiereCliente: true
      readonly motivo: 'supera_umbral' | 'tipo_lo_exige'
      readonly umbral: Centimos
      readonly total: Centimos
    }

export function evaluarIdentificacionDelComprador(
  tipo: TipoDeDocumento,
  total: Centimos,
  cliente: ClienteIdentificado | null,
  umbral: Centimos,
): ResultadoDeUmbral {
  if (cliente !== null) return { requiereCliente: false }

  const reglas = REGLAS[tipo]

  if (reglas.exigeClienteIdentificado) {
    return {
      requiereCliente: true,
      motivo: 'tipo_lo_exige',
      umbral,
      total,
    }
  }

  if (reglas.sujetoAUmbralDeIdentificacion && total > umbral) {
    return {
      requiereCliente: true,
      motivo: 'supera_umbral',
      umbral,
      total,
    }
  }

  return { requiereCliente: false }
}

/**
 * Si conviene avisar al vendedor de que se está acercando al umbral, para que
 * pida los datos mientras el cliente todavía está delante en lugar de al final,
 * cuando ya guardó la billetera.
 */
export function seAcercaAlUmbral(
  tipo: TipoDeDocumento,
  total: Centimos,
  cliente: ClienteIdentificado | null,
  umbral: Centimos,
  margen = 0.85,
): boolean {
  if (cliente !== null) return false
  if (!REGLAS[tipo].sujetoAUmbralDeIdentificacion) return false
  return total > umbral * margen && total <= umbral
}
