import type { EstadoNormalizado } from '../interfaz.ts'

/**
 * Traducción de los estados del proveedor a los nuestros.
 *
 * ## La confusión que este archivo existe para impedir
 *
 * El proveedor tiene dos estados que dicen "sin respuesta de SUNAT", y la
 * tentación es tratarlos como nuestro `indeterminado`. **No lo son, y
 * confundirlos produciría lógica de reconciliación equivocada.**
 *
 * Son dos ejes distintos. Que SUNAT no haya respondido al proveedor es una
 * situación **normal y ya gestionada por él**: firma en sus propios servidores y
 * mantiene una cola de reintentos hacia SUNAT. Nuestro `indeterminado` es otra
 * cosa: que *nosotros* no sabemos si el proveedor llegó a recibir la petición.
 *
 * De ahí la regla que gobierna esta tabla: **`indeterminado` nunca se deriva de
 * un estado del proveedor.** Solo lo produce nuestra propia incertidumbre. Si
 * alguna vez alguien añade aquí una fila que devuelva `indeterminado`, está
 * introduciendo el error que la decisión 4b de research.md documenta.
 *
 * Consecuencia práctica que conviene tener presente: como el proveedor firma y
 * reintenta por su cuenta, **una caída de SUNAT no impide emitir**. El camino de
 * venta en espera con documento interno de FR-050 se estrecha a los casos en que
 * el proveedor mismo o nuestra red estén inalcanzables. Sigue siendo necesario,
 * pero será raro, y la interfaz no debe tratarlo como el escenario habitual.
 */

/**
 * Los códigos de estado del proveedor. Este es vocabulario ajeno y no sale de
 * este módulo.
 */
const TRADUCCION: Record<string, EstadoNormalizado> = {
  // Registrado en su servidor: el documento existe, está firmado y su envío
  // está en marcha. Avisa además de que todavía se puede editar allí; SuitPay
  // nunca lo editará, pero implica que aún no es un compromiso irreversible.
  '01': 'registrado',

  // Enviado a SUNAT y sin respuesta todavía. NO es un fallo: el proveedor
  // reintenta por su cuenta y no requiere nada de nosotros.
  '03': 'sin_respuesta_autoridad',
  '19': 'sin_respuesta_autoridad',

  '05': 'aceptado',

  // Rechazo definitivo: la corrección es un documento nuevo, no un reintento.
  '09': 'rechazado',

  '11': 'anulado',
}

/**
 * El estado `13`, "por anular", es una transición intermedia: la baja no es
 * instantánea. Se traduce al estado anterior del documento a propósito, para que
 * la interfaz **no presente la anulación como cerrada** hasta llegar a `11`.
 */
export const CODIGO_POR_ANULAR = '13'

export interface EstadoTraducido {
  readonly estado: EstadoNormalizado | undefined
  /** Verdadero mientras la baja esté en curso y sin confirmar. */
  readonly anulacionEnCurso: boolean
  /** Si el código no estaba previsto. Se registra en lugar de adivinar. */
  readonly codigoDesconocido: boolean
}

export function traducirEstado(codigo: string | undefined): EstadoTraducido {
  if (codigo === undefined || codigo === '') {
    return {
      estado: undefined,
      anulacionEnCurso: false,
      codigoDesconocido: true,
    }
  }

  const normalizado = codigo.trim().padStart(2, '0')

  if (normalizado === CODIGO_POR_ANULAR) {
    return {
      estado: 'aceptado',
      anulacionEnCurso: true,
      codigoDesconocido: false,
    }
  }

  const traducido = TRADUCCION[normalizado]
  if (traducido === undefined) {
    // No se inventa un estado. Un código nuevo del proveedor tiene que
    // aparecer como desconocido y no colarse como "aceptado" por omisión.
    return {
      estado: undefined,
      anulacionEnCurso: false,
      codigoDesconocido: true,
    }
  }

  return {
    estado: traducido,
    anulacionEnCurso: false,
    codigoDesconocido: false,
  }
}

/** Si un estado del proveedor indica que el documento existe de verdad. */
export function elDocumentoExiste(estado: EstadoNormalizado | undefined): boolean {
  return estado !== undefined
}
