import { diaEnLima } from '../../domain/anulacion/ventana.ts'
import { procesarLoteAprendizajeFn } from './aprendizaje.funciones.ts'

const CLAVE = 'suitpay-aprendizaje-lote-dia'

export function intentarLoteAprendizaje(): void {
  const hoy = diaEnLima(new Date())
  try {
    const ultimo = localStorage.getItem(CLAVE)
    if (ultimo === hoy) return
  } catch {
    return
  }
  window.setTimeout(() => {
    void (async () => {
      const respuesta = await procesarLoteAprendizajeFn()
      if (respuesta.ok) {
        try {
          localStorage.setItem(CLAVE, hoy)
        } catch {
          /* ignore */
        }
      }
    })()
  }, 2500)
}
