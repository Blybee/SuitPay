import { create } from 'zustand'

export type TonoDeNotificacion = 'exito' | 'error' | 'info'

export interface Notificacion {
  readonly id: string
  readonly tono: TonoDeNotificacion
  readonly titulo?: string
  readonly mensaje: string
  readonly creadaEn: number
}

interface AlmacenDeNotificaciones {
  readonly activas: readonly Notificacion[]
  mostrar: (entrada: {
    readonly tono: TonoDeNotificacion
    readonly titulo?: string
    readonly mensaje: string
    /** ms; por omisión según tono */
    readonly duracionMs?: number
  }) => string
  descartar: (id: string) => void
  limpiar: () => void
}

let contador = 0
const timers = new Map<string, ReturnType<typeof setTimeout>>()

function duracionPorDefecto(tono: TonoDeNotificacion): number {
  if (tono === 'error') return 6_000
  if (tono === 'exito') return 3_500
  return 4_500
}

/**
 * Cola de toasts tipo Dynamic Island (FR UX admin).
 * El host visual es `NotificacionIsla` en la raíz.
 */
export const usarNotificaciones = create<AlmacenDeNotificaciones>((set, get) => ({
  activas: [],

  mostrar(entrada) {
    contador += 1
    const id = `n-${contador}-${Date.now()}`
    const notificacion: Notificacion = {
      id,
      tono: entrada.tono,
      ...(entrada.titulo !== undefined ? { titulo: entrada.titulo } : {}),
      mensaje: entrada.mensaje,
      creadaEn: Date.now(),
    }
    set({ activas: [...get().activas, notificacion] })

    const ms = entrada.duracionMs ?? duracionPorDefecto(entrada.tono)
    if (ms > 0) {
      const timer = setTimeout(() => {
        timers.delete(id)
        get().descartar(id)
      }, ms)
      timers.set(id, timer)
    }
    return id
  },

  descartar(id) {
    const timer = timers.get(id)
    if (timer !== undefined) {
      clearTimeout(timer)
      timers.delete(id)
    }
    set({ activas: get().activas.filter((cada) => cada.id !== id) })
  },

  limpiar() {
    for (const timer of timers.values()) clearTimeout(timer)
    timers.clear()
    set({ activas: [] })
  },
}))
