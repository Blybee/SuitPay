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
import type { ProductoBuscable } from '../../domain/busqueda/productos.ts'

/**
 * Revisión contrastada de una captura (T122 / FR-042).
 * Original pendiente o ambiguo: resaltado al ancho del texto.
 * Original ya resuelto: tachado, con la propuesta debajo.
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

  function asignarYCerrar(indice: number, producto: ProductoBuscable): void {
    asignar(indice, producto)
    setLupaEn(null)
  }

  return (
    <div
      className="flex min-h-0 flex-1 flex-col border-b border-borde bg-papel"
      data-testid="revision-captura"
    >
      <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-3 bg-papel px-4 py-3">
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
          <Boton
            variante="principal"
            data-testid="aprobar-captura"
            disabled={hayBloqueo || guardando || lineas.length === 0}
            aria-busy={guardando || undefined}
            onClick={() => void aprobar()}
          >
            <Check className="size-4" aria-hidden />
            Aprobar
          </Boton>
          <Boton
            variante="secundario"
            data-testid="descartar-captura"
            onClick={descartar}
          >
            <X className="size-4" aria-hidden />
            Descartar
          </Boton>
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
          const sinResolver = ambigua || pendiente

          return (
            <li
              key={`cap-${indice}`}
              className="border-b border-borde px-4 py-3"
              data-testid={`linea-captura-${indice}`}
              data-estado={linea.estadoLinea}
            >
              <div className="flex items-center gap-2">
                <p className="min-w-0 flex-1">
                  <span
                    className={
                      sinResolver
                        ? 'inline w-fit rounded-md bg-sello/15 px-1.5 py-0.5 text-renglon font-bold text-tinta'
                        : 'text-cuerpo text-desvaida line-through decoration-desvaida/80'
                    }
                  >
                    {linea.textoOriginal}
                  </span>
                </p>
                <div className="flex shrink-0 items-center gap-1">
                  {sinResolver && (
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
                <div className="mt-2">
                  <BusquedaEnLinea
                    abierta={lupaEn === indice}
                    onElegir={(producto) => asignarYCerrar(indice, producto)}
                    onCerrar={() => setLupaEn(null)}
                  />
                  <p className="font-mono text-etiqueta uppercase tracking-wide text-desvaida">
                    Elige un candidato
                  </p>
                  <OpcionesAmbiguas
                    candidatos={linea.candidatos}
                    onElegir={(codigo) => elegir(indice, codigo)}
                  />
                </div>
              )}

              {pendiente && (
                <div className="mt-2">
                  <p className="font-mono text-etiqueta uppercase tracking-wide text-desvaida">
                    Sin interpretar
                  </p>
                  <p className="mt-1 text-cuerpo text-tinta">
                    No se pudo interpretar. Búscalo o escríbelo a mano.
                  </p>
                  <BusquedaEnLinea
                    abierta={lupaEn === indice}
                    onElegir={(producto) => asignarYCerrar(indice, producto)}
                    onCerrar={() => setLupaEn(null)}
                  />
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

function BusquedaEnLinea({
  abierta,
  onElegir,
  onCerrar,
}: {
  readonly abierta: boolean
  readonly onElegir: (producto: ProductoBuscable) => void
  readonly onCerrar: () => void
}) {
  return (
    <div
      className="grid transition-[grid-template-rows] duration-media ease-salida motion-reduce:transition-none"
      style={{ gridTemplateRows: abierta ? '1fr' : '0fr' }}
    >
      <div
        className={abierta ? 'min-h-0' : 'min-h-0 overflow-hidden'}
        inert={abierta ? undefined : true}
      >
        <ComboboxProductoLinea
          autoFocus={abierta}
          onElegir={onElegir}
          onCerrar={onCerrar}
        />
      </div>
    </div>
  )
}
