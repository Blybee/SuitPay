import { obtenerUrlPdfComprobante } from './emitir.funciones.ts'

/**
 * Precarga (*prefetch* / `rel=preload`) del PDF del proveedor.
 *
 * No reemite ni sube el binario a Storage (FR-059). Si el CDN no envía CORS,
 * `as=fetch` igual calienta la caché HTTP en navegadores que reutilizan esa
 * petición al abrir la pestaña. `fetchpriority=low`: el PDF no es LCP.
 */

const enlaces = new Map<string, HTMLLinkElement>()

export function precargarRecursoPdf(url: string | null | undefined): void {
  if (url === undefined || url === null || url === '') return
  if (typeof document === 'undefined') return
  if (enlaces.has(url)) return

  const preload = document.createElement('link')
  preload.rel = 'preload'
  preload.setAttribute('as', 'fetch')
  preload.href = url
  preload.setAttribute('fetchpriority', 'low')
  document.head.appendChild(preload)
  enlaces.set(url, preload)
}

export function soltarPrecargaPdf(): void {
  for (const enlace of enlaces.values()) {
    enlace.remove()
  }
  enlaces.clear()
}

export async function resolverYPrecargarPdf(
  comprobanteId: string,
  urlConocida: string | null,
): Promise<string | null> {
  if (urlConocida !== null && urlConocida !== '') {
    precargarRecursoPdf(urlConocida)
    return urlConocida
  }

  const respuesta = await obtenerUrlPdfComprobante({
    data: { comprobanteId },
  }).catch(() => undefined)

  const url =
    respuesta?.ok === true &&
    respuesta.urlPdf !== undefined &&
    respuesta.urlPdf !== null &&
    respuesta.urlPdf !== ''
      ? respuesta.urlPdf
      : null

  precargarRecursoPdf(url)
  return url
}
