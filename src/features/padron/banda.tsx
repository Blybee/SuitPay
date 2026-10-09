import { usarImportacionDePadron } from './almacen.ts'

export function BandaDeImportacion() {
  const fase = usarImportacionDePadron((s) => s.fase)
  const tipo = usarImportacionDePadron((s) => s.tipo)
  const hecho = usarImportacionDePadron((s) => s.hecho)
  const total = usarImportacionDePadron((s) => s.total)
  const visible = fase === 'leyendo' || fase === 'guardando'
  const titulo =
    tipo === 'transportistas' ? 'Empresas de transporte' : 'Clientes'
  const detalle =
    fase === 'leyendo'
      ? `Leyendo página ${hecho} de ${total || '…'}`
      : `Guardando ${hecho} de ${total || '…'}`
  const porcentaje =
    total > 0 ? Math.min(100, Math.round((hecho / total) * 100)) : 0

  return (
    <div
      className="grid transition-[grid-template-rows] duration-media ease-salida motion-reduce:transition-none"
      style={{ gridTemplateRows: visible ? '1fr' : '0fr' }}
    >
      <div className="min-h-0 overflow-hidden">
        <div
          className="border-b border-borde bg-papel px-4 py-2"
          role="status"
          aria-live="polite"
          data-testid="banda-importacion"
        >
          <p className="text-cuerpo font-bold text-tinta">
            Importando {titulo}. Puedes seguir usando la aplicación.
          </p>
          <p className="text-cuerpo text-desvaida">{detalle}</p>
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-mesa"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={total || 1}
            aria-valuenow={hecho}
            aria-valuetext={detalle}
          >
            <div
              className="h-full bg-tinta transition-[width] duration-media ease-salida motion-reduce:transition-none"
              style={{ width: `${porcentaje}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
