import { Link } from '@tanstack/react-router'
import { Boton } from '../../ui/componentes/primitivas.tsx'

/**
 * Papeleta cuando la cotización ya terminó en un comprobante (FR-019).
 */
export function YaConvertida({
  comprobanteId,
  mensaje,
  onCerrar,
}: {
  readonly comprobanteId: string | null
  readonly mensaje?: string
  readonly onCerrar?: () => void
}) {
  return (
    <div className="space-y-3" role="status">
      <p className="text-cuerpo font-bold text-aviso">
        {mensaje ??
          'Esta cotización ya se convirtió en un comprobante. No se puede emitir otra vez.'}
      </p>

      {comprobanteId !== null ? (
        <p className="text-cuerpo text-tinta">
          Terminó en el comprobante{' '}
          <span className="font-mono font-bold">{comprobanteId}</span>.
        </p>
      ) : (
        <p className="text-cuerpo text-tinta">
          El comprobante resultante no está disponible en este aviso. Búscalo en
          la lista de comprobantes.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {comprobanteId !== null ? (
          <Boton variante="principal" asChild>
            <Link to="/comprobantes/$comprobanteId" params={{ comprobanteId }}>
              Abrir comprobante
            </Link>
          </Boton>
        ) : null}
        {onCerrar !== undefined ? (
          <Boton variante="secundario" onClick={onCerrar}>
            Volver
          </Boton>
        ) : null}
      </div>
    </div>
  )
}
