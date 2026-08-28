import { create } from 'zustand'

/**
 * Día civil visible en el tab Lista. Las altas van al día actual; al agregar
 * se fuerza este valor a hoy para que la tabla coincida con lo escrito.
 */
export const usarDiaLista = create<{
  readonly fecha: string | null
  fijar: (fecha: string) => void
}>((set) => ({
  fecha: null,
  fijar: (fecha) => set({ fecha }),
}))
