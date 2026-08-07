import { create } from 'zustand'
import type { CodigoDeError, RespuestaDeEmitir } from './emitir.funciones.ts'
import { usarDegradacion } from '../degradacion/estado.ts'
import { usarPedido } from '../pedido/almacen.ts'

/**
 * El flujo de emisión visto desde el cliente (decisión 10).
 *
 * - `proveedor_no_disponible`: reintento manual; el pedido no se vacía.
 * - `emision_indeterminada`: sin reemitir; solo «Consultar estado».
 */

export type FaseDeEmision =
  | { readonly nombre: 'inactiva' }
  | { readonly nombre: 'en_vuelo' }
  | {
      readonly nombre: 'emitida'
      readonly comprobante: RespuestaDeEmitir
      readonly yaExistia: boolean
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
  | {
      readonly nombre: 'cotizacion_ya_usada'
      readonly mensaje: string
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
  comenzar: () => boolean
  resolver: (respuesta: RespuestaDelServidor) => void
  falloDeRed: () => void
  adoptarConsulta: (comprobante: RespuestaDeEmitir) => void
  marcarReintentableTrasConsulta: (mensaje: string) => void
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

      case 'cotizacion_ya_usada':
      case 'cotizacion_no_pendiente':
        set({
          fase: {
            nombre: 'cotizacion_ya_usada',
            mensaje: error.mensaje,
          },
        })
        return

      case 'proveedor_no_disponible':
        set({
          fase: {
            nombre: 'no_se_pudo',
            mensaje: error.mensaje,
            codigo: error.codigo,
            reintentable: true,
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
            reintentable: error.reintentable,
          },
        })
    }
  },

  falloDeRed() {
    set({
      fase: {
        nombre: 'en_verificacion',
        comprobanteId: usarPedido.getState().claveIdempotencia,
        mensaje:
          'No se pudo confirmar si el comprobante se emitió. NO vuelvas a emitir a ciegas: usa «Consultar estado».',
      },
    })
    usarDegradacion.getState().declarar('red')
  },

  adoptarConsulta(comprobante) {
    set({
      fase: {
        nombre: 'emitida',
        comprobante,
        yaExistia: true,
      },
    })
    usarPedido.getState().vaciar()
    usarDegradacion.getState().resolver('proveedor')
    usarDegradacion.getState().resolver('red')
  },

  marcarReintentableTrasConsulta(mensaje) {
    set({
      fase: {
        nombre: 'no_se_pudo',
        mensaje,
        codigo: 'proveedor_no_disponible',
        reintentable: true,
      },
    })
  },

  cerrar() {
    set({ fase: { nombre: 'inactiva' } })
  },
}))

export function sePuedeReintentar(fase: FaseDeEmision): boolean {
  if (fase.nombre === 'no_se_pudo') return fase.reintentable
  return false
}
