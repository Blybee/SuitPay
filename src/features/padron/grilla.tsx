import { useLayoutEffect, useMemo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { IdCard, Search } from 'lucide-react'
import { Boton, Campo, Etiqueta } from '../../ui/componentes/primitivas.tsx'
import { IndicadorDeCarga } from '../../ui/componentes/IndicadorDeCarga.tsx'
import {
  documentoInvalido,
  filtrarFilas,
} from './borrador.ts'
import type { FilaDeBorrador, VistaDePadron } from './borrador.ts'

const ALTO_FILA = 52
const OVERSCAN = 12
const COLUMNAS = 'grid-cols-[9.5rem_minmax(12rem,1fr)_3.25rem]'

/**
 * Lista del índice, virtualizada. La ficha no vive en la fila:
 * el botón de la última columna la pide aparte.
 */
export function GrillaDePadron({
  vista,
  filas,
  consulta,
  cargando,
  claveAbierta,
  claveAEnfocar,
  onConsulta,
  onFilas,
  onAbrirFicha,
  onEnfocada,
}: {
  readonly vista: VistaDePadron
  readonly filas: readonly FilaDeBorrador[]
  readonly consulta: string
  readonly cargando: boolean
  readonly claveAbierta: string | null
  readonly claveAEnfocar: string | null
  readonly onConsulta: (consulta: string) => void
  readonly onFilas: (filas: readonly FilaDeBorrador[]) => void
  readonly onAbrirFicha: (clave: string) => void
  readonly onEnfocada: () => void
}) {
  const idBuscar = `padron-buscar-${vista}`
  const scrollRef = useRef<HTMLDivElement>(null)
  const etiquetaDocumento = vista === 'clientes' ? 'Documento' : 'RUC'
  const etiquetaNombre = vista === 'clientes' ? 'Nombre' : 'Razón social'
  const etiquetaLista = vista === 'clientes' ? 'Clientes' : 'Empresas de transporte'
  const placeholder =
    vista === 'clientes' ? 'DNI, RUC o nombre' : 'RUC o razón social'

  const visibles = useMemo(
    () => filtrarFilas(filas, consulta),
    [filas, consulta],
  )

  const virtualizador = useVirtualizer({
    count: visibles.length,
    getScrollElement: () => scrollRef.current,
    initialRect: { width: 800, height: 640 },
    overscan: OVERSCAN,
    observeElementRect: (_instancia, informar) => {
      const el = scrollRef.current
      const emitir = (): void => {
        informar({
          width: el?.clientWidth || 800,
          height: el?.clientHeight || 640,
        })
      }
      emitir()
      if (el === null) return
      const observador = new ResizeObserver(emitir)
      observador.observe(el)
      return () => observador.disconnect()
    },
    estimateSize: () => ALTO_FILA,
  })

  const alEnfocar = useRef(onEnfocada)
  alEnfocar.current = onEnfocada

  useLayoutEffect(() => {
    if (claveAEnfocar === null) return
    if (scrollRef.current !== null) scrollRef.current.scrollTop = 0
    const nodo = scrollRef.current?.querySelector<HTMLInputElement>(
      `[data-enfocar="${CSS.escape(claveAEnfocar)}"]`,
    )
    if (nodo === null) return
    nodo.focus()
    alEnfocar.current()
  }, [claveAEnfocar, visibles])

  function parche(clave: string, parcial: Partial<FilaDeBorrador>): void {
    onFilas(
      filas.map((fila) => (fila.clave === clave ? { ...fila, ...parcial } : fila)),
    )
  }

  return (
    <section className="flex flex-col gap-4 rounded-3xl border border-borde bg-papel p-6 shadow-sm">
      <div className="flex min-w-0 flex-col gap-1">
        <Etiqueta htmlFor={idBuscar}>
          {vista === 'clientes' ? 'Buscar cliente' : 'Buscar transportista'}
        </Etiqueta>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-desvaida"
            aria-hidden
          />
          <Campo
            id={idBuscar}
            type="search"
            superficie="papel"
            value={consulta}
            placeholder={placeholder}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
            aria-controls="grilla-padron"
            className="pl-10"
            onChange={(evento) => onConsulta(evento.target.value)}
            onKeyDown={(evento) => {
              if (evento.key === 'Escape' && consulta.length > 0) {
                evento.preventDefault()
                onConsulta('')
              }
            }}
          />
        </div>
      </div>

      {cargando ? (
        <IndicadorDeCarga mensaje="Cargando lista…" />
      ) : (
        <div
          id="grilla-padron"
          role="table"
          aria-label={etiquetaLista}
          className="overflow-x-auto rounded-2xl border border-borde"
        >
          <div className="min-w-[36rem]">
            <div
              role="row"
              className={`grid ${COLUMNAS} gap-1 border-b border-borde bg-mesa px-2 py-2 font-mono text-etiqueta uppercase text-desvaida`}
            >
              <span role="columnheader">{etiquetaDocumento}</span>
              <span role="columnheader">{etiquetaNombre}</span>
              <span role="columnheader" className="flex justify-center">
                <IdCard className="size-4" aria-hidden />
                <span className="sr-only">Ficha</span>
              </span>
            </div>
            <div
              ref={scrollRef}
              className="max-h-[min(70dvh,40rem)] overflow-y-auto bg-papel"
            >
              {visibles.length === 0 ? (
                <p
                  role="status"
                  className="px-4 py-8 text-center text-cuerpo text-desvaida"
                >
                  {filas.length === 0
                    ? 'Todavía no hay registros. Importa un PDF o pulsa Nuevo.'
                    : 'Nadie coincide.'}
                </p>
              ) : null}
              <div
                className="relative w-full"
                style={{ height: `${virtualizador.getTotalSize()}px` }}
              >
                {virtualizador.getVirtualItems().map((virtual) => {
                  const fila = visibles[virtual.index]
                  if (fila === undefined) return null
                  const nombre =
                    fila.denominacion.trim() !== ''
                      ? fila.denominacion
                      : fila.numeroDocumento
                  return (
                    <div
                      key={fila.clave}
                      data-index={virtual.index}
                      ref={virtualizador.measureElement}
                      role="row"
                      className={`absolute top-0 left-0 grid ${COLUMNAS} min-h-12 w-full items-start gap-1 border-b border-borde bg-papel px-2 py-1`}
                      style={{ transform: `translateY(${virtual.start}px)` }}
                    >
                      <span role="cell">
                        {fila.nueva ? (
                          <Campo
                            variante="en-linea"
                            className="font-mono text-etiqueta"
                            value={fila.numeroDocumento}
                            inputMode="numeric"
                            maxLength={11}
                            invalido={documentoInvalido(vista, fila.numeroDocumento)}
                            aria-label={`${etiquetaDocumento} de la fila nueva`}
                            data-enfocar={fila.clave}
                            onChange={(evento) =>
                              parche(fila.clave, {
                                numeroDocumento: evento.target.value.replace(
                                  /\D/g,
                                  '',
                                ),
                              })
                            }
                          />
                        ) : (
                          <span className="flex min-h-11 items-center font-mono text-etiqueta text-tinta">
                            {fila.numeroDocumento}
                          </span>
                        )}
                      </span>
                      <span role="cell" className="min-w-0">
                        <Campo
                          variante="en-linea"
                          value={fila.denominacion}
                          aria-label={`${etiquetaNombre} de ${nombre || 'fila nueva'}`}
                          maxLength={300}
                          onChange={(evento) =>
                            parche(fila.clave, { denominacion: evento.target.value })
                          }
                        />
                      </span>
                      <span role="cell" className="flex justify-center">
                        <Boton
                          variante="discreto"
                          tamano="icono"
                          aria-expanded={claveAbierta === fila.clave}
                          aria-label={`Ficha de ${nombre || 'fila nueva'}`}
                          onClick={() => onAbrirFicha(fila.clave)}
                        >
                          <IdCard className="size-4" aria-hidden />
                        </Boton>
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}
      <p aria-live="polite" className="font-mono text-etiqueta text-desvaida">
        {visibles.length} de {filas.length}{' '}
        {vista === 'clientes' ? 'clientes' : 'transportistas'} visibles
      </p>
    </section>
  )
}
