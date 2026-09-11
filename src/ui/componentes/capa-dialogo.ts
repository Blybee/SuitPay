import { createContext, useContext } from 'react'

/**
 * El `<dialog showModal()>` vive en la top layer. Un portal a `document.body`
 * queda detrás. Quien pinte un listbox (Selector) lee este contexto y porta
 * dentro del dialog abierto.
 */
export const CapaDeDialogo = createContext<HTMLElement | null>(null)

export function usarCapaDeDialogo(): HTMLElement | null {
  return useContext(CapaDeDialogo)
}
