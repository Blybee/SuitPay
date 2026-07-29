/**
 * El comprobante como algo que se pueda enviar, pensado para el móvil (FR-054).
 *
 * ## Por qué tres caminos y en este orden
 *
 * En el móvil, la hoja de compartir del sistema es lo que el vendedor espera:
 * WhatsApp está ahí y es como se manda todo en la práctica. En el escritorio no
 * existe, y descargar el archivo es lo natural. Y si tampoco se puede descargar,
 * copiar el enlace al menos deja al vendedor con algo que pegar.
 *
 * El orden es de mejor a peor, y cada paso es un respaldo del anterior. La
 * alternativa —detectar el dispositivo y elegir— se equivoca justo donde más se
 * usa el sistema: con las tabletas y con los escritorios táctiles.
 *
 * ## Compartir no toca el comprobante
 *
 * Igual que imprimir: aquí no hay ni una línea que escriba en el documento. Lo que
 * se envía es el archivo que generó el proveedor, y un fallo al enviarlo no altera
 * lo que consta ante la autoridad.
 */

export type ResultadoDeCompartir =
  | { readonly ok: true; readonly via: 'sistema' | 'descarga' | 'portapapeles' }
  | { readonly ok: false; readonly motivo: 'sin_archivo' | 'cancelado' | 'no_se_pudo' }

export async function compartirDocumento(
  urlDelPdf: string | null,
  nombreSugerido: string,
): Promise<ResultadoDeCompartir> {
  if (urlDelPdf === null || urlDelPdf === '') {
    return { ok: false, motivo: 'sin_archivo' }
  }

  if (typeof navigator !== 'undefined' && 'share' in navigator) {
    try {
      await navigator.share({
        title: nombreSugerido,
        text: `Comprobante ${nombreSugerido}`,
        url: urlDelPdf,
      })
      return { ok: true, via: 'sistema' }
    } catch (error) {
      // Cancelar la hoja de compartir lanza `AbortError`. No es un fallo: el
      // vendedor cambió de idea, y presentarlo como error le haría pensar que algo
      // se rompió. Cualquier otro error sí cae al siguiente camino.
      if (error instanceof Error && error.name === 'AbortError') {
        return { ok: false, motivo: 'cancelado' }
      }
    }
  }

  try {
    const enlace = document.createElement('a')
    enlace.href = urlDelPdf
    enlace.download = `${nombreSugerido}.pdf`
    enlace.rel = 'noopener noreferrer'
    enlace.target = '_blank'
    enlace.click()
    return { ok: true, via: 'descarga' }
  } catch {
    // Último recurso.
  }

  try {
    await navigator.clipboard.writeText(urlDelPdf)
    return { ok: true, via: 'portapapeles' }
  } catch {
    return { ok: false, motivo: 'no_se_pudo' }
  }
}

/** El nombre legible de un comprobante, para el archivo y para decirlo en voz alta. */
export function nombreDelComprobante(serie: string, numero: number | null): string {
  if (serie === '' || numero === null) return 'documento-interno'
  return `${serie}-${String(numero).padStart(8, '0')}`
}
