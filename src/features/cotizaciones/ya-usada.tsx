import { Boton } from '../../ui/componentes/primitivas.tsx'

/**
 * Aviso cuando la cotización ya no existe (convertida o eliminada) (FR-019)
 * o cuando el pedido de vecino ya consumió esa generación (FR-035a).
 */
export function YaUsada({
  mensaje,
  onIrAComprobantes,
  onNuevoPedido,
}: {
  readonly mensaje?: string
  readonly onIrAComprobantes?: () => void
  readonly onNuevoPedido?: () => void
}) {
  const conAcciones =
    onIrAComprobantes !== undefined && onNuevoPedido !== undefined

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
      {conAcciones ? (
        <div className="flex flex-wrap gap-2 pt-1">
          <Boton variante="principal" onClick={onIrAComprobantes}>
            Comprobantes
          </Boton>
          <Boton variante="secundario" onClick={onNuevoPedido}>
            Nuevo pedido
          </Boton>
        </div>
      ) : null}
    </div>
  )
}
