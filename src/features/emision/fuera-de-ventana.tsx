/**
 * Estado de fuera de ventana de anulación (T106, FR-038).
 * Explica que corresponde una nota de crédito y no ofrece un botón que fallará.
 */

export function FueraDeVentana({
  diaDeEmision,
}: {
  readonly diaDeEmision?: string
}) {
  return (
    <div
      className="rounded-2xl border border-aviso bg-aviso/5 px-4 py-3"
      role="status"
    >
      <p className="text-cuerpo font-bold text-aviso">
        Ya no se puede anular este comprobante
      </p>
      <p className="mt-1 text-cuerpo text-tinta">
        {diaDeEmision !== undefined
          ? `Se emitió el ${diaDeEmision} (hora de Lima) y la ventana del mismo día cerró.`
          : 'La ventana de anulación del mismo día ya cerró.'}{' '}
        Corresponde emitir una nota de crédito; esa operación no está en este
        flujo.
      </p>
    </div>
  )
}
