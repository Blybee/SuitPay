import { usarCaptura } from './estado.ts'
import { MiniaturaCaptura } from './miniatura.tsx'

/**
 * Revisión en dos pasos para fotografía (T133):
 * 1) texto extraído editable
 * 2) emparejamiento (fase revision)
 */
export function PasoTextoExtraido({
  onContinuar,
  onCancelar,
}: {
  readonly onContinuar: () => void
  readonly onCancelar: () => void
}) {
  const lineas = usarCaptura((s) => s.lineas)
  const medioObjectUrl = usarCaptura((s) => s.medioObjectUrl)
  const actualizar = usarCaptura((s) => s.actualizarTextoOriginal)
  const pasar = usarCaptura((s) => s.pasarAEmparejamiento)

  return (
    <div
      className="border-b border-borde bg-papel px-4 py-3"
      data-testid="revision-texto-imagen"
    >
      <div className="flex gap-4">
        <MiniaturaCaptura src={medioObjectUrl} />
        <div className="min-w-0 flex-1">
          <p className="text-cuerpo font-bold text-tinta">
            Paso 1 — Texto extraído
          </p>
          <p className="font-mono text-etiqueta text-desvaida">
            Corrige lo leído antes de emparejar con el catálogo.
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {lineas.map((linea, indice) => (
              <li key={`texto-${indice}`}>
                <label className="font-mono text-etiqueta text-desvaida">
                  Renglón {indice + 1}
                  <input
                    value={linea.textoOriginal}
                    onChange={(e) =>
                      actualizar(indice, e.target.value)
                    }
                    className="mt-1 min-h-12 w-full rounded-lg border border-borde bg-mesa px-3 text-cuerpo text-tinta"
                  />
                </label>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              data-testid="continuar-emparejamiento"
              onClick={() => {
                pasar()
                onContinuar()
              }}
              className="min-h-12 rounded-full bg-tinta px-4 text-papel"
            >
              Emparejar productos
            </button>
            <button
              type="button"
              onClick={onCancelar}
              className="min-h-12 rounded-full border border-borde px-4 text-tinta"
            >
              Descartar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
