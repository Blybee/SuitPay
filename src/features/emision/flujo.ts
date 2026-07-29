import { create } from 'zustand'
import type { CodigoDeError, RespuestaDeEmitir } from './emitir.funciones.ts'
import { usarDegradacion } from '../degradacion/estado.ts'
import { usarPedido } from '../pedido/almacen.ts'

/**
 * El flujo de emisión visto desde el cliente.
 *
 * ## La distinción que este módulo existe para hacer visible
 *
 * `yaExistia` separa **"emitido ahora"** de **"ya estaba emitido"**, y no es un
 * matiz. Si un reintento dijera "Emitido" sin más, el vendedor no sabría si acaba
 * de generar un segundo documento, y su reacción natural sería ir a buscarlo para
 * anularlo. Decirle que ese comprobante ya existía y es el mismo le ahorra una
 * anulación que no hace falta y una llamada al administrador.
 *
 * ## Por qué el estado indeterminado no ofrece reintentar
 *
 * Es el estado más delicado del sistema: hay un cliente delante, no se sabe si el
 * comprobante existe, y la única acción incorrecta —volver a emitir— es también la
 * que el vendedor querrá hacer. La interfaz **no ofrece el botón**. No lo pone
 * deshabilitado con un aviso: no lo pone.
 *
 * Y esa decisión no depende de que quien escriba la pantalla se acuerde: el
 * servidor devuelve `reintentable: false` en el propio error, así que la
 * prohibición viaja con el dato.
 *
 * ## Por qué el pedido no se vacía hasta que la venta está cerrada
 *
 * Si se vaciara al pulsar emitir y la respuesta fuera indeterminada, el vendedor
 * se quedaría sin el pedido y sin comprobante, con el cliente delante. El pedido
 * se conserva hasta que consta que el documento existe.
 */

export type FaseDeEmision =
  | { readonly nombre: 'inactiva' }
  | { readonly nombre: 'en_vuelo' }
  | {
      readonly nombre: 'emitida'
      readonly comprobante: RespuestaDeEmitir
      /** Si la llamada fue un reintento que no produjo nada nuevo. */
      readonly yaExistia: boolean
    }
  | {
      readonly nombre: 'en_espera'
      readonly comprobanteId: string
      readonly mensaje: string
    }
  | {
      readonly nombre: 'en_verificacion'
      readonly comprobanteId: string | null
      readonly mensaje: string
    }
  | {
      readonly nombre: 'rechazada'
      readonly mensaje: string
      readonly codigo: CodigoDeError
    }
  | {
      readonly nombre: 'no_se_pudo'
      readonly mensaje: string
      readonly codigo: CodigoDeError
      readonly reintentable: boolean
    }

export interface RespuestaDelServidor {
  readonly ok: boolean
  readonly comprobante?: RespuestaDeEmitir
  readonly error?: {
    readonly codigo: CodigoDeError
    readonly mensaje: string
    readonly reintentable: boolean
    readonly detalle?: Record<string, string | number | boolean | null>
  }
}

interface AlmacenDeEmision {
  readonly fase: FaseDeEmision
  /**
   * Marca la emisión en vuelo. Se llama **antes** de cualquier espera, de modo
   * que la segunda pulsación de un doble clic ya encuentra el botón inerte. Es la
   * primera de las dos defensas; la segunda es la clave de idempotencia, y hacen
   * falta las dos porque ésta no cubre dos dispositivos ni una recarga.
   */
  comenzar: () => boolean
  resolver: (respuesta: RespuestaDelServidor) => void
  falloDeRed: () => void
  cerrar: () => void
}

export const usarEmision = create<AlmacenDeEmision>((set, get) => ({
  fase: { nombre: 'inactiva' },

  comenzar() {
    if (get().fase.nombre === 'en_vuelo') return false
    set({ fase: { nombre: 'en_vuelo' } })
    return true
  },

  resolver(respuesta) {
    if (respuesta.ok && respuesta.comprobante !== undefined) {
      const comprobante = respuesta.comprobante
      set({
        fase: {
          nombre: 'emitida',
          comprobante,
          yaExistia: comprobante.yaExistia,
        },
      })
      // Solo ahora. Vaciar antes habría dejado al vendedor sin pedido y sin
      // comprobante si la respuesta no hubiera llegado.
      usarPedido.getState().vaciar()
      usarDegradacion.getState().resolver('proveedor')
      return
    }

    const error = respuesta.error
    if (error === undefined) {
      set({
        fase: {
          nombre: 'no_se_pudo',
          mensaje: 'La respuesta del servidor no se entendió.',
          codigo: 'fallo_inesperado',
          reintentable: true,
        },
      })
      return
    }

    switch (error.codigo) {
      case 'emision_indeterminada':
        // El pedido NO se vacía y NO se ofrece reintentar. La venta queda a cargo
        // de la reconciliación, que preguntará al proveedor.
        set({
          fase: {
            nombre: 'en_verificacion',
            comprobanteId:
              typeof error.detalle?.['comprobanteId'] === 'string'
                ? error.detalle['comprobanteId']
                : null,
            mensaje: error.mensaje,
          },
        })
        return

      case 'proveedor_no_disponible':
        set({
          fase: {
            nombre: 'en_espera',
            comprobanteId:
              typeof error.detalle?.['comprobanteId'] === 'string'
                ? error.detalle['comprobanteId']
                : '',
            mensaje: error.mensaje,
          },
        })
        usarDegradacion.getState().declarar('proveedor')
        return

      case 'emision_rechazada':
        set({
          fase: {
            nombre: 'rechazada',
            mensaje: error.mensaje,
            codigo: error.codigo,
          },
        })
        return

      default:
        set({
          fase: {
            nombre: 'no_se_pudo',
            mensaje: error.mensaje,
            codigo: error.codigo,
            // Se respeta lo que dice el servidor. La interfaz no decide esto por
            // su cuenta, porque decidirlo mal produce comprobantes duplicados.
            reintentable: error.reintentable,
          },
        })
    }
  },

  falloDeRed() {
    // Un fallo de red desde el cliente es indistinguible de una respuesta que se
    // perdió: la petición pudo llegar y emitirse. Se trata como verificación
    // pendiente y **no se ofrece reintentar**, aunque la clave de idempotencia
    // haría seguro el reintento. La razón de ser tan conservador es que la clave
    // se conserva en IndexedDB pero un vendedor puede recargar en otro navegador,
    // y el coste de equivocarse aquí es un documento fiscal de más.
    set({
      fase: {
        nombre: 'en_verificacion',
        comprobanteId: usarPedido.getState().claveIdempotencia,
        mensaje:
          'No se pudo confirmar si el comprobante se emitió. NO vuelvas a emitir: se está verificando.',
      },
    })
    usarDegradacion.getState().declarar('red')
  },

  cerrar() {
    set({ fase: { nombre: 'inactiva' } })
  },
}))

/**
 * Si la interfaz puede ofrecer un botón de reintentar. Deliberadamente
 * pesimista: solo cuando consta que no se emitió nada.
 */
export function sePuedeReintentar(fase: FaseDeEmision): boolean {
  if (fase.nombre === 'no_se_pudo') return fase.reintentable
  // `en_verificacion` nunca, `en_espera` tampoco: la venta ya está registrada y
  // la completará la tarea programada.
  return false
}
