import { RefreshCw, X } from 'lucide-react'

/**
 * Estado de fotografía ilegible con motivo y reintento (T135).
 */
export function EstadoIlegible({
  motivo,
  onReintentar,
  onCerrar,
}: {
  readonly motivo: string
  readonly onReintentar: () => void
  readonly onCerrar: () => void
}) {
  return (
    <div
      className="border-b border-aviso/40 bg-aviso/10 px-4 py-4"
      data-testid="captura-ilegible"
    >
      <p className="text-cuerpo font-bold text-aviso">Fotografía ilegible</p>
      <p className="mt-1 text-cuerpo text-tinta">{motivo}</p>
      <p className="mt-1 font-mono text-etiqueta text-desvaida">
        El original se conserva. Puedes reintentar con otra foto o escribir el
        pedido.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          data-testid="reintentar-foto"
          onClick={onReintentar}
          className="flex min-h-12 items-center gap-2 rounded-full bg-tinta px-4 text-papel"
        >
          <RefreshCw className="size-4" aria-hidden />
          Otra foto
        </button>
        <button
          type="button"
          onClick={onCerrar}
          className="flex min-h-12 items-center gap-2 rounded-full border border-borde px-4 text-tinta"
        >
          <X className="size-4" aria-hidden />
          Escribir
        </button>
      </div>
    </div>
  )
}
