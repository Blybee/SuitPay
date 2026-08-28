import { create } from 'zustand'
import type { LineaDeCaptura } from '../captura/tipos.ts'
import type { ClienteDelPedido } from '../pedido/almacen.ts'

export type FaseDePropuestaPdf = 'procesando' | 'lista' | 'error'

export interface PropuestaPdf {
  readonly id: string
  readonly nombreArchivo: string
  readonly fase: FaseDePropuestaPdf
  readonly lineas?: readonly LineaDeCaptura[]
  readonly etiquetaCliente?: string
  readonly cliente?: ClienteDelPedido | null
  readonly capturaId?: string
  readonly medioUrl?: string
  readonly mensajeError?: string
}

interface Acciones {
  encolar: (propuesta: PropuestaPdf) => void
  actualizar: (id: string, parche: Partial<PropuestaPdf>) => void
  quitar: (id: string) => void
}

export type AlmacenDePropuestasPdf = {
  readonly propuestas: readonly PropuestaPdf[]
} & Acciones

export const usarPropuestasPdf = create<AlmacenDePropuestasPdf>((set, get) => ({
  propuestas: [],

  encolar(propuesta) {
    set({ propuestas: [propuesta, ...get().propuestas] })
  },

  actualizar(id, parche) {
    set({
      propuestas: get().propuestas.map((p) =>
        p.id === id ? { ...p, ...parche } : p,
      ),
    })
  },

  quitar(id) {
    set({ propuestas: get().propuestas.filter((p) => p.id !== id) })
  },
}))
