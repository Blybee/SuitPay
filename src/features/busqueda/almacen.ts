import { create } from 'zustand'
import { esModoComando } from '../comandos/pistas.ts'

/**
 * Última búsqueda de producto del mostrador (sesión en memoria).
 *
 * No persiste en IndexedDB: basta con que sobreviva al cambio de tab y a
 * volver al mostrador en la misma sesión. Los comandos (`/…`) no se recuerdan.
 */

interface AlmacenDeBusqueda {
  readonly ultima: string
  recordar: (termino: string) => void
}

export const usarBusqueda = create<AlmacenDeBusqueda>((set) => ({
  ultima: '',

  recordar(termino) {
    if (termino.trim().length === 0 || esModoComando(termino)) return
    set({ ultima: termino })
  },
}))
