import { useEffect, useMemo } from 'react'
import { formatearImporte } from '../../domain/totales/calculo.ts'
import { AccionesDePdf } from '../emision/acciones-pdf.tsx'
import { Modal } from '../../ui/componentes/Modal.tsx'
import { Boton } from '../../ui/componentes/primitivas.tsx'
import { blobDePdfDeCotizacion, nombreDeArchivoDeCotizacion } from './pdf.ts'
import type { Cotizacion } from './tipos.ts'

/**
 * Diálogo de éxito tras guardar (mismo cuerpo que «Comprobante emitido»).
 */
export function CotizacionEmitida({
  cotizacion,
  onCerrar,
}: {
  readonly cotizacion: Cotizacion
  readonly onCerrar: () => void
}) {
  const blob = useMemo(() => blobDePdfDeCotizacion(cotizacion), [cotizacion])
  const url = useMemo(() => URL.createObjectURL(blob), [blob])

  useEffect(() => {
    return () => {
      URL.revokeObjectURL(url)
    }
  }, [url])

  return (
    <Modal
      abierta
      alCambiar={(abierta) => {
        if (!abierta) onCerrar()
      }}
      titulo="Cotización emitida"
    >
      <div className="space-y-3">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="font-mono text-etiqueta uppercase text-desvaida">
            Número
          </dt>
          <dd className="font-mono text-cuerpo text-tinta">
            #{cotizacion.numero}
          </dd>
          <dt className="font-mono text-etiqueta uppercase text-desvaida">
            Total
          </dt>
          <dd className="font-mono tabular-nums text-cuerpo font-bold text-tinta">
            {formatearImporte(cotizacion.total)}
          </dd>
        </dl>

        <AccionesDePdf
          nombre={nombreDeArchivoDeCotizacion(cotizacion.numero)}
          blob={blob}
          url={url}
        />

        <div className="flex flex-wrap gap-2">
          <Boton variante="discreto" onClick={onCerrar}>
            Siguiente venta
          </Boton>
        </div>
      </div>
    </Modal>
  )
}
