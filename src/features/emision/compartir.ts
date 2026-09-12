/**
 * El comprobante como algo que se pueda enviar (FR-054).
 *
 * Prioriza la hoja de compartir del sistema con el **archivo** PDF (Web Share
 * Level 2). En escritorio Windows, WhatsApp Desktop aparece como destino de
 * compartir. Guardar sigue siendo la descarga explícita: Compartir no la duplica.
 */

export type ResultadoDeCompartir =
  | { readonly ok: true; readonly via: 'sistema' | 'descarga' | 'portapapeles' }
  | {
      readonly ok: false
      readonly motivo: 'sin_archivo' | 'cancelado' | 'sin_hoja' | 'no_se_pudo'
    }

export interface EntradaDeCompartir {
  readonly nombreSugerido: string
  readonly archivo?: Blob | File | null
  readonly urlDelPdf?: string | null
  /** Lista de requerimiento: si no hay hoja, descarga. El modal de emisión no. */
  readonly descargarSiFalla?: boolean
}

function aArchivoPdf(origen: Blob | File, nombreSugerido: string): File {
  if (origen instanceof File) return origen
  return new File([origen], `${nombreSugerido}.pdf`, {
    type: origen.type || 'application/pdf',
  })
}

async function resolverArchivo(
  entrada: EntradaDeCompartir,
): Promise<File | null> {
  if (entrada.archivo !== null && entrada.archivo !== undefined) {
    return aArchivoPdf(entrada.archivo, entrada.nombreSugerido)
  }
  const url = entrada.urlDelPdf
  if (url === undefined || url === null || url === '') return null
  try {
    const respuesta = await fetch(url)
    if (!respuesta.ok) return null
    const blob = await respuesta.blob()
    return aArchivoPdf(blob, entrada.nombreSugerido)
  } catch {
    return null
  }
}

function puedeCompartirArchivo(archivo: File): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'share' in navigator &&
    (typeof navigator.canShare !== 'function' ||
      navigator.canShare({ files: [archivo] }))
  )
}

async function intentarHoja(archivo: File, titulo: string): Promise<boolean> {
  if (!puedeCompartirArchivo(archivo)) return false
  try {
    await navigator.share({ title: titulo, files: [archivo] })
    return true
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw error
    }
    return false
  }
}

function descargarUrl(url: string, nombreSugerido: string): boolean {
  try {
    const enlace = document.createElement('a')
    enlace.href = url
    enlace.download = `${nombreSugerido}.pdf`
    enlace.rel = 'noopener noreferrer'
    enlace.target = '_blank'
    enlace.click()
    return true
  } catch {
    return false
  }
}

export async function compartirDocumento(
  entrada: EntradaDeCompartir,
): Promise<ResultadoDeCompartir> {
  const nombre = entrada.nombreSugerido
  let archivo: File | null
  try {
    archivo = await resolverArchivo(entrada)
  } catch {
    archivo = null
  }

  try {
    if (archivo !== null) {
      const compartido = await intentarHoja(archivo, nombre)
      if (compartido) return { ok: true, via: 'sistema' }
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { ok: false, motivo: 'cancelado' }
    }
  }

  if (entrada.descargarSiFalla === true) {
    if (archivo !== null) {
      const urlLocal = URL.createObjectURL(archivo)
      const ok = descargarUrl(urlLocal, nombre)
      URL.revokeObjectURL(urlLocal)
      if (ok) return { ok: true, via: 'descarga' }
    }
    const url = entrada.urlDelPdf
    if (url !== undefined && url !== null && url !== '') {
      if (descargarUrl(url, nombre)) return { ok: true, via: 'descarga' }
      try {
        await navigator.clipboard.writeText(url)
        return { ok: true, via: 'portapapeles' }
      } catch {
        return { ok: false, motivo: 'no_se_pudo' }
      }
    }
  }

  if (archivo === null && (entrada.urlDelPdf === null || entrada.urlDelPdf === undefined || entrada.urlDelPdf === '') && (entrada.archivo === null || entrada.archivo === undefined)) {
    return { ok: false, motivo: 'sin_archivo' }
  }

  return { ok: false, motivo: 'sin_hoja' }
}

/** El nombre legible de un comprobante, para el archivo y para decirlo en voz alta. */
export function nombreDelComprobante(
  serie: string,
  numero: number | null,
  tipoDocumento?: string,
): string {
  if (tipoDocumento === 'nota_venta') return 'nota-de-venta'
  if (serie === '' || numero === null) return 'documento-interno'
  return `${serie}-${String(numero).padStart(8, '0')}`
}
