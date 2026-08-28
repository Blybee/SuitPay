import { create } from 'zustand'
import { sileo } from 'sileo'

/**
 * Puerta SuitPay → Sileo.
 *
 * La app sigue hablando en `tono` / `mensaje` / `titulo`; aquí se traduce a
 * `sileo.success|error|info`. El host visual es `<Toaster />` en `__root.tsx`.
 * Docs: `docs/UI-COMPONENTES.md`.
 */

export type TonoDeNotificacion = 'exito' | 'error' | 'info'

export interface EntradaDeNotificacion {
  readonly tono: TonoDeNotificacion
  readonly titulo?: string
  readonly mensaje: string
  /** ms; por omisión según tono. `0` = sin auto-cierre (duration null). */
  readonly duracionMs?: number
}

interface AlmacenDeNotificaciones {
  mostrar: (entrada: EntradaDeNotificacion) => string
  descartar: (id: string) => void
  limpiar: () => void
}

function etiquetaPorDefecto(tono: TonoDeNotificacion): string {
  if (tono === 'exito') return 'Éxito'
  if (tono === 'error') return 'Error'
  return 'Info'
}

function duracionPorDefecto(tono: TonoDeNotificacion): number {
  if (tono === 'error') return 6_000
  if (tono === 'exito') return 3_500
  return 4_500
}

function dispararSileo(entrada: EntradaDeNotificacion): string {
  const title =
    entrada.titulo !== undefined && entrada.titulo.trim() !== ''
      ? entrada.titulo
      : etiquetaPorDefecto(entrada.tono)

  const duration =
    entrada.duracionMs === 0
      ? null
      : (entrada.duracionMs ?? duracionPorDefecto(entrada.tono))

  const opciones = {
    title,
    description: entrada.mensaje,
    duration,
  }

  if (entrada.tono === 'exito') return sileo.success(opciones)
  if (entrada.tono === 'error') return sileo.error(opciones)
  return sileo.info(opciones)
}

export const usarNotificaciones = create<AlmacenDeNotificaciones>(() => ({
  mostrar(entrada) {
    return dispararSileo(entrada)
  },

  descartar(id) {
    sileo.dismiss(id)
  },

  limpiar() {
    sileo.clear()
  },
}))

/** Atajo sin hook: `mostrarNotificacion({ tono: 'info', mensaje: '…' })`. */
export function mostrarNotificacion(entrada: EntradaDeNotificacion): string {
  return usarNotificaciones.getState().mostrar(entrada)
}
