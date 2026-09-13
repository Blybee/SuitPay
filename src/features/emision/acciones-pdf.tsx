import { Download, Loader2, Printer, Share2 } from 'lucide-react'
import { useState } from 'react'
import { Boton } from '../../ui/componentes/primitivas.tsx'
import { compartirDocumento } from './compartir.ts'
import { imprimirDocumento } from './impresion.ts'

/**
 * Imprimir / Guardar / Compartir sobre un PDF ya resuelto (blob o URL).
 * Lo usan el modal de comprobante emitido y el de cotización emitida.
 */
export function AccionesDePdf({
  nombre,
  blob,
  url,
  onImprimirFallback,
  onCompartirFallback,
}: {
  readonly nombre: string
  readonly blob: Blob | null
  readonly url: string | null
  readonly onImprimirFallback?: () => void
  readonly onCompartirFallback?: () => void
}) {
  const [aviso, setAviso] = useState<string | null>(null)
  const [compartiendo, setCompartiendo] = useState(false)
  const sinPdf = blob === null && (url === null || url === '')

  function urlFresco(): string | null {
    if (blob !== null) return URL.createObjectURL(blob)
    if (url !== null && url !== '') return url
    return null
  }

  function alImprimir(): void {
    setAviso(null)
    const destino = urlFresco()
    if (destino !== null) {
      const resultado = imprimirDocumento(destino)
      if (!resultado.ok) {
        setAviso(
          resultado.motivo === 'no_se_pudo_abrir'
            ? 'No se pudo abrir el PDF. Revisa el bloqueador de ventanas.'
            : 'Este documento no tiene archivo PDF.',
        )
      }
      return
    }
    onImprimirFallback?.()
  }

  function alGuardar(): void {
    setAviso(null)
    const destino = urlFresco()
    if (destino === null) {
      setAviso('Este documento no tiene archivo PDF para guardar.')
      return
    }
    const enlace = document.createElement('a')
    enlace.href = destino
    enlace.download = `${nombre}.pdf`
    enlace.rel = 'noopener noreferrer'
    enlace.target = '_blank'
    enlace.click()
  }

  async function alCompartir(): Promise<void> {
    setAviso(null)
    setCompartiendo(true)
    try {
      const resultado = await compartirDocumento({
        nombreSugerido: nombre,
        archivo: blob,
        urlDelPdf: url,
      })
      if (resultado.ok) return
      if (resultado.motivo === 'cancelado') return
      if (resultado.motivo === 'sin_archivo') {
        onCompartirFallback?.()
        return
      }
      setAviso(
        resultado.motivo === 'sin_hoja'
          ? 'No se pudo abrir la hoja de compartir. Usa Guardar y adjúntalo en WhatsApp.'
          : 'No se pudo compartir el PDF.',
      )
    } finally {
      setCompartiendo(false)
    }
  }

  return (
    <div className="space-y-2 pt-1">
      {aviso !== null ? (
        <p className="text-cuerpo font-bold text-aviso" role="status">
          {aviso}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Boton variante="principal" onClick={alImprimir}>
          <Printer className="size-5" aria-hidden />
          Imprimir
        </Boton>
        <Boton onClick={alGuardar} disabled={sinPdf}>
          <Download className="size-5" aria-hidden />
          Guardar
        </Boton>
        <Boton
          disabled={compartiendo}
          aria-busy={compartiendo || undefined}
          onClick={() => {
            void alCompartir()
          }}
        >
          {compartiendo ? (
            <Loader2 className="size-5 animate-spin" aria-hidden />
          ) : (
            <Share2 className="size-5" aria-hidden />
          )}
          Compartir
        </Boton>
      </div>
    </div>
  )
}
