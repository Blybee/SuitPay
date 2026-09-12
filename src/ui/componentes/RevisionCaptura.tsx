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
import { Boton } from './primitivas.tsx'

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
                ambigua || pendiente ? 'border-l-2 border-l-aviso pl-[calc(1rem-2px)]' : '',
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
                <div className="flex shrink-0 items-center gap-1">
                  {(ambigua || pendiente) && (
                    <Boton
                      variante="discreto"
                      tamano="icono"
                      aria-label={
                        ambigua
                          ? 'Buscar otro producto'
                          : 'Buscar producto para esta línea'
                      }
                      aria-expanded={lupaEn === indice}
                      onClick={() =>
                        setLupaEn((actual) =>
                          actual === indice ? null : indice,
                        )
                      }
                    >
                      <Search className="size-4" aria-hidden />
                    </Boton>
                  )}
                  <Boton
                    variante="discreto"
                    tamano="icono"
                    data-testid={`quitar-linea-captura-${indice}`}
                    className="hover:border-aviso/40 hover:bg-aviso/10 hover:text-aviso"
                    aria-label={`Quitar ${linea.textoOriginal} de la revisión`}
                    onClick={() => quitar(indice)}
                  >
                    <X className="size-5" aria-hidden />
                  </Boton>
                </div>
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
                  <p className="font-mono text-etiqueta uppercase tracking-wide text-desvaida">
                    Elige un candidato
                  </p>
                  <OpcionesAmbiguas
                    candidatos={linea.candidatos}
                    onElegir={(codigo) => elegir(indice, codigo)}
                  />
                  <div
                    className="grid transition-[grid-template-rows] duration-media ease-salida motion-reduce:transition-none"
                    style={{
                      gridTemplateRows: lupaEn === indice ? '1fr' : '0fr',
                    }}
                  >
                    <div
                      className="min-h-0 overflow-hidden"
                      inert={lupaEn === indice ? undefined : true}
                    >
                      <ComboboxProductoLinea
                        autoFocus={lupaEn === indice}
                        onElegir={(producto) => {
                          asignar(indice, producto)
                          setLupaEn(null)
                        }}
                        onCerrar={() => setLupaEn(null)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {pendiente && (
                <div className="ml-4 mt-2">
                  <p className="font-mono text-etiqueta uppercase tracking-wide text-desvaida">
                    Sin interpretar
                  </p>
                  <p className="mt-1 text-cuerpo text-tinta">
                    No se pudo interpretar. Búscalo o escríbelo a mano.
                  </p>
                  <div
                    className="grid transition-[grid-template-rows] duration-media ease-salida motion-reduce:transition-none"
                    style={{
                      gridTemplateRows: lupaEn === indice ? '1fr' : '0fr',
                    }}
                  >
                    <div
                      className="min-h-0 overflow-hidden"
                      inert={lupaEn === indice ? undefined : true}
                    >
                      <ComboboxProductoLinea
                        autoFocus={lupaEn === indice}
                        onElegir={(producto) => {
                          asignar(indice, producto)
                          setLupaEn(null)
                        }}
                        onCerrar={() => setLupaEn(null)}
                      />
                    </div>
                  </div>
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
