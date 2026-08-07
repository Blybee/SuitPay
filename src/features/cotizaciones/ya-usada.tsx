import { Boton } from '../../ui/componentes/primitivas.tsx'

/**
 * Aviso cuando la cotización ya no existe (convertida o eliminada) (FR-019).
 */
export function YaUsada({
  mensaje,
  onCerrar,
}: {
  readonly mensaje?: string
  readonly onCerrar?: () => void
}) {
  return (
    <div className="space-y-3" role="status">
      <p className="text-cuerpo font-bold text-aviso">
        {mensaje ??
          'Esta cotización ya no existe. Se convirtió en un comprobante o se quitó.'}
      </p>
      <p className="text-cuerpo text-tinta">
        Si ya se emitió, búscalo en la lista de comprobantes. No vuelvas a emitir
        con la misma cotización.
      </p>
      {onCerrar !== undefined ? (
        <Boton variante="secundario" onClick={onCerrar}>
          Volver
        </Boton>
      ) : null}
    </div>
  )
}
