import { Check, X } from 'lucide-react'
import { OpcionesAmbiguas } from '../../features/captura/ambiguos.tsx'
import { extraerLineasAprobadasDeCaptura, type LineaCapturaAprobada } from '../../features/captura/aprobar.ts'
import { usarCaptura } from '../../features/captura/estado.ts'
import { MiniaturaCaptura } from '../../features/captura/miniatura.tsx'
import { formatearImporte } from '../../domain/totales/calculo.ts'
import { usarCatalogo } from '../../features/catalogo/almacen.ts'
import { CabecerasDeColumna } from './LineaPedido.tsx'

/**
 * Revisión contrastada de una captura (T122 / FR-042).
 * Lectura original tachada; debajo, sangrada, la propuesta limpia.
 */
export function RevisionCaptura({
  onAprobada,
  onDescartar,
}: {
  readonly onAprobada: (
    lineas: readonly LineaCapturaAprobada[],
    textosOriginales: readonly string[],
    capturaId: string | null,
  ) => void
  readonly onDescartar: () => void
}) {
  const lineas = usarCaptura((s) => s.lineas)
  const medioObjectUrl = usarCaptura((s) => s.medioObjectUrl)
  const tipo = usarCaptura((s) => s.tipo)
  const elegir = usarCaptura((s) => s.elegirCandidato)
  const cancelar = usarCaptura((s) => s.cancelar)
  const hayBloqueo = usarCaptura((s) => s.hayPendientesOAmbiguas())
  const catalogo = usarCatalogo()

  function aprobar(): void {
    const resultado = extraerLineasAprobadasDeCaptura()
    if (!resultado.ok) return
    const capturaId = usarCaptura.getState().capturaId
    cancelar()
    onAprobada(resultado.lineas, resultado.textosOriginales, capturaId)
  }

  function descartar(): void {
    cancelar()
    onDescartar()
  }

  return (
    <div
      className="border-b border-borde bg-papel"
      data-testid="revision-captura"
    >
      <div className="flex items-start justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 flex-1 gap-3">
          {tipo === 'imagen' && <MiniaturaCaptura src={medioObjectUrl} />}
          <div>
            <p className="text-cuerpo font-bold text-tinta">
              Revisar propuesta
            </p>
            <p className="font-mono text-etiqueta text-desvaida">
              Compara con el original. Nada se emite hasta que apruebes.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            data-testid="aprobar-captura"
            disabled={hayBloqueo}
            onClick={aprobar}
            className={[
              'flex min-h-12 items-center gap-2 rounded-full px-4',
              hayBloqueo
                ? 'cursor-not-allowed bg-mesa text-desvaida'
                : 'bg-tinta text-papel',
            ].join(' ')}
          >
            <Check className="size-4" aria-hidden />
            Aprobar
          </button>
          <button
            type="button"
            data-testid="descartar-captura"
            onClick={descartar}
            className="flex min-h-12 items-center gap-2 rounded-full border border-borde px-4 text-tinta"
          >
            <X className="size-4" aria-hidden />
            Descartar
          </button>
        </div>
      </div>

      <CabecerasDeColumna />
      <ul>
        {lineas.map((linea, indice) => {
          const elegido =
            linea.seleccion !== null
              ? catalogo.productoPorCodigo(linea.seleccion)
              : undefined
          const ambigua = linea.estadoLinea === 'ambigua'
          const pendiente = linea.estadoLinea === 'pendiente'

          return (
            <li
              key={`cap-${indice}`}
              className={[
                'border-b border-borde px-4 py-3',
                ambigua || pendiente ? 'bg-aviso/5' : '',
              ].join(' ')}
              data-testid={`linea-captura-${indice}`}
              data-estado={linea.estadoLinea}
            >
              <p className="text-cuerpo text-desvaida line-through decoration-desvaida/80">
                {linea.textoOriginal}
              </p>

              {linea.estadoLinea === 'resuelta' && elegido && (
                <div className="mt-1 ml-4 grid grid-cols-[1fr_auto_auto_auto] items-baseline gap-3">
                  <span className="text-cuerpo font-bold text-tinta">
                    {elegido.descripcion}
                  </span>
                  <span className="font-mono text-etiqueta text-desvaida">
                    ×{linea.cantidad}
                  </span>
                  <span className="font-mono text-etiqueta text-desvaida">
                    {elegido.unidad}
                  </span>
                  <span className="font-mono text-cuerpo text-tinta">
                    {formatearImporte(elegido.precio)}
                  </span>
                </div>
              )}

              {ambigua && (
                <div className="ml-4 mt-2">
                  <p className="font-mono text-etiqueta uppercase text-aviso">
                    Elige un candidato
                  </p>
                  <OpcionesAmbiguas
                    candidatos={linea.candidatos}
                    onElegir={(codigo) => elegir(indice, codigo)}
                  />
                </div>
              )}

              {pendiente && (
                <p className="ml-4 mt-2 text-cuerpo text-aviso">
                  Pendiente: no se pudo interpretar. Escribe este producto a mano
                  o descarta la propuesta.
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
