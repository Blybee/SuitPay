import { usarCaptura } from './estado.ts'
import type { LineaDeCaptura, TipoDeCaptura } from './tipos.ts'

/**
 * Gancho solo para e2e / emulador: inyecta una propuesta sin pasar por micrófono.
 * No se registra en producción (ni DEV sin emuladores).
 */

export interface PropuestaInyectable {
  readonly capturaId?: string
  readonly tipo?: TipoDeCaptura
  readonly medioObjectUrl?: string | null
  readonly pasoTextoPrimero?: boolean
  readonly lineas: readonly LineaDeCaptura[]
}

declare global {
  interface Window {
    __suitpayInyectarPropuestaCaptura?: (entrada: PropuestaInyectable) => void
  }
}

export function registrarInyeccionDeCapturaParaPruebas(): void {
  if (typeof window === 'undefined') return
  const emuladores = import.meta.env.VITE_USAR_EMULADORES === 'true'
  if (!import.meta.env.DEV && !emuladores) return

  window.__suitpayInyectarPropuestaCaptura = (entrada) => {
    usarCaptura.getState().recibirPropuesta({
      capturaId: entrada.capturaId ?? `e2e-${Date.now()}`,
      medioUrl: 'capturas/e2e/fixture.webm',
      medioObjectUrl: entrada.medioObjectUrl ?? null,
      tipo: entrada.tipo ?? 'audio',
      lineas: entrada.lineas,
      pasoTextoPrimero: entrada.pasoTextoPrimero,
    })
  }
}
