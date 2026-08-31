import { useRef, useState } from 'react'
import { Check, Search, X } from 'lucide-react'
import { OpcionesAmbiguas } from '../../features/captura/ambiguos.tsx'
import { ComboboxProductoLinea } from '../../features/captura/busqueda-linea.tsx'
import { extraerLineasAprobadasDeCaptura } from '../../features/captura/aprobar.ts'
import type { LineaCapturaAprobada } from '../../features/captura/aprobar.ts'
import { usarCaptura } from '../../features/captura/estado.ts'
import { MiniaturaCaptura } from '../../features/captura/miniatura.tsx'
import { formatearImporte } from '../../domain/totales/calculo.ts'
import { usarCatalogo } from '../../features/catalogo/almacen.ts'
import { CabecerasDeColumna } from './LineaPedido.tsx'

/**
 * Revisión contrastada de una captura (T122 / FR-042).
 * Original tachado solo si ya hay propuesta; pendiente se lee sin tachar.
 */
export function RevisionCaptura({
  onAprobada,
  onDescartar,
}: {
  readonly onAprobada: (
    lineas: readonly LineaCapturaAprobada[],
    textosOriginales: readonly string[],
    capturaId: string | null,
  ) => boolean | void | Promise<boolean | void>
  readonly onDescartar: () => void
}) {
  const lineas = usarCaptura((s) => s.lineas)
  const medioObjectUrl = usarCaptura((s) => s.medioObjectUrl)
  const tipo = usarCaptura((s) => s.tipo)
  const elegir = usarCaptura((s) => s.elegirCandidato)
  const asignar = usarCaptura((s) => s.asignarProducto)
  const quitarLinea = usarCaptura((s) => s.quitarLinea)
  const cancelar = usarCaptura((s) => s.cancelar)
  const hayBloqueo = usarCaptura((s) => s.hayPendientesOAmbiguas())
  const catalogo = usarCatalogo()
  const [guardando, setGuardando] = useState(false)
  const [lupaEn, setLupaEn] = useState<number | null>(null)
  const enVuelo = useRef(false)

  async function aprobar(): Promise<void> {
    if (enVuelo.current || hayBloqueo) return
    const resultado = extraerLineasAprobadasDeCaptura()
    if (!resultado.ok) return
    const capturaId = usarCaptura.getState().capturaId
    enVuelo.current = true
    setGuardando(true)
    try {
      const ok = await Promise.resolve(
        onAprobada(resultado.lineas, resultado.textosOriginales, capturaId),
      )
      if (ok !== false) cancelar()
    } finally {
      enVuelo.current = false
      setGuardando(false)
    }
  }

  function descartar(): void {
    cancelar()
    onDescartar()
  }

  function quitar(indice: number): void {
    quitarLinea(indice)
    setLupaEn((actual) => {
      if (actual === null) return null
      if (actual === indice) return null
      if (actual > indice) return actual - 1
      return actual
    })
  }

  return (
    <div
      className="flex min-h-0 flex-1 flex-col border-b border-borde bg-papel"
      data-testid="revision-captura"
    >
      <div className="sticky top-0 z-10 flex shrink-0 items-start justify-between gap-3 bg-papel px-4 py-3">
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
            disabled={hayBloqueo || guardando || lineas.length === 0}
            onClick={() => void aprobar()}
            className={[
              'flex min-h-12 items-center gap-2 rounded-full px-4',
              hayBloqueo || guardando
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

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
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
              <div className="flex items-start gap-2">
                <p
                  className={[
                    'min-w-0 flex-1 text-cuerpo',
                    pendiente
                      ? 'text-tinta'
                      : 'text-desvaida line-through decoration-desvaida/80',
                  ].join(' ')}
                >
                  {linea.textoOriginal}
                </p>
                <button
                  type="button"
                  data-testid={`quitar-linea-captura-${indice}`}
                  className={[
                    'inline-flex size-11 shrink-0 items-center justify-center rounded-full',
                    'text-desvaida transition-[color,background-color] duration-rapida ease-salida',
                    'hover:bg-aviso/15 hover:text-aviso',
                    'focus-visible:outline-none focus-visible:border focus-visible:border-tinta',
                  ].join(' ')}
                  aria-label={`Quitar ${linea.textoOriginal} de la revisión`}
                  onClick={() => quitar(indice)}
                >
                  <X className="size-5" aria-hidden />
                </button>
              </div>

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
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-etiqueta uppercase text-aviso">
                      Elige un candidato
                    </p>
                    <button
                      type="button"
                      className="inline-flex size-11 items-center justify-center rounded-full text-desvaida hover:bg-mesa hover:text-tinta focus-visible:border focus-visible:border-tinta focus-visible:outline-none"
                      aria-label="Buscar otro producto"
                      aria-expanded={lupaEn === indice}
                      onClick={() =>
                        setLupaEn((actual) => (actual === indice ? null : indice))
                      }
                    >
                      <Search className="size-4" aria-hidden />
                    </button>
                  </div>
                  <OpcionesAmbiguas
                    candidatos={linea.candidatos}
                    onElegir={(codigo) => elegir(indice, codigo)}
                  />
                  {lupaEn === indice ? (
                    <ComboboxProductoLinea
                      onElegir={(producto) => {
                        asignar(indice, producto)
                        setLupaEn(null)
                      }}
                      onCerrar={() => setLupaEn(null)}
                    />
                  ) : null}
                </div>
              )}

              {pendiente && (
                <div className="ml-4 mt-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-cuerpo text-aviso">
                      Pendiente: no se pudo interpretar. Búscalo o escríbelo a
                      mano.
                    </p>
                    <button
                      type="button"
                      className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-desvaida hover:bg-mesa hover:text-tinta focus-visible:border focus-visible:border-tinta focus-visible:outline-none"
                      aria-label="Buscar producto para esta línea"
                      aria-expanded={lupaEn === indice}
                      onClick={() =>
                        setLupaEn((actual) => (actual === indice ? null : indice))
                      }
                    >
                      <Search className="size-4" aria-hidden />
                    </button>
                  </div>
                  {lupaEn === indice ? (
                    <ComboboxProductoLinea
                      onElegir={(producto) => {
                        asignar(indice, producto)
                        setLupaEn(null)
                      }}
                      onCerrar={() => setLupaEn(null)}
                    />
                  ) : null}
                </div>
              )}
            </li>
          )
        })}
      </ul>
      </div>
    </div>
  )
}
