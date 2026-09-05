import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  Boxes,
  ListChecks,
  Minus,
  PencilLine,
  Plus,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  agruparConflictosPorCodigo,
  detectarConflictos,
  textoDeConflictos,
} from '../../domain/catalogo/conflictos.ts'
import { filtrarPorFacetas, marcasDe } from '../../domain/catalogo/filtros.ts'
import { formatearImporte } from '../../domain/totales/calculo.ts'
import type {
  CategoriaDeCatalogo,
  Producto,
} from '../../domain/esquemas/comunes.ts'
import {
  Boton,
  Campo,
  CampoArea,
  Casilla,
  Etiqueta,
} from '../../ui/componentes/primitivas.tsx'
import { Selector } from '../../ui/componentes/Selector.tsx'

/**
 * Grilla de catálogo: revisión de un lote a publicar, o lista maestra.
 * Virtualizada (~3000 filas). Conflictos en la fila, no en un recuadro aparte.
 */

function idDeCategoria(): string {
  return crypto.randomUUID().slice(0, 8)
}

const ALTO_FILA = 52
const ALTO_LINEA = 22
const ALTO_CALLOUT = 28
const OVERSCAN = 24
const COLUMNAS_REVISION =
  'grid-cols-[2.5rem_8rem_minmax(14rem,1fr)_7rem_4.5rem_6rem_7rem]'
const COLUMNAS_MAESTRO =
  'grid-cols-[2.5rem_8rem_minmax(14rem,1fr)_7rem_4.5rem_6rem_7rem_3.25rem]'
const ANCHO_MINIMO_REVISION = 'min-w-[52rem]'
const ANCHO_MINIMO_MAESTRO = 'min-w-[56rem]'

function estimarAltoDeFila(
  descripcion: string,
  conProblema: boolean,
): number {
  const lineas = Math.min(8, Math.max(1, Math.ceil(descripcion.length / 42)))
  return ALTO_FILA + (lineas - 1) * ALTO_LINEA + (conProblema ? ALTO_CALLOUT : 0)
}

export type ModoDeGrilla = 'revision' | 'maestro'

export interface BalanceDeRevision {
  readonly reconocidos: number
  readonly nuevos: number
  readonly cambiados: number
  readonly desaparecen: number
  readonly version: number | null
  readonly publicado: boolean
}

export function GrillaRevision({
  productos,
  categorias,
  balance,
  onProductos,
  onCategorias,
  modo = 'revision',
  puedeEscribir = true,
  mostrarInactivos = false,
  onMostrarInactivos,
  onPedirCantidad,
  soloAlertas = false,
  codigosEnAlerta,
  codigoAEnfocar,
  onCodigoEnfocado,
}: {
  readonly productos: readonly Producto[]
  readonly categorias: readonly CategoriaDeCatalogo[]
  readonly balance: BalanceDeRevision
  readonly onProductos: (productos: readonly Producto[]) => void
  readonly onCategorias: (categorias: readonly CategoriaDeCatalogo[]) => void
  readonly modo?: ModoDeGrilla
  readonly puedeEscribir?: boolean
  readonly mostrarInactivos?: boolean
  readonly onMostrarInactivos?: (valor: boolean) => void
  readonly onPedirCantidad?: (codigo: string) => void
  readonly soloAlertas?: boolean
  readonly codigosEnAlerta?: ReadonlySet<string>
  readonly codigoAEnfocar?: string | null
  readonly onCodigoEnfocado?: () => void
}) {
  const [marca, setMarca] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [soloProblemas, setSoloProblemas] = useState(false)
  const [nombreNueva, setNombreNueva] = useState('')
  const [seleccion, setSeleccion] = useState<ReadonlySet<number>>(
    () => new Set(),
  )
  const [asignarA, setAsignarA] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const columnas =
    modo === 'maestro' ? COLUMNAS_MAESTRO : COLUMNAS_REVISION
  const anchoMinimo =
    modo === 'maestro' ? ANCHO_MINIMO_MAESTRO : ANCHO_MINIMO_REVISION
  const soloLectura = !puedeEscribir
  const conflictos = useMemo(() => detectarConflictos(productos), [productos])
  const porCodigo = useMemo(
    () => agruparConflictosPorCodigo(conflictos),
    [conflictos],
  )
  const marcas = useMemo(() => marcasDe(productos), [productos])

  const visibles = useMemo(() => {
    const facetados = new Set(
      filtrarPorFacetas(productos, {
        marca: marca.length > 0 ? marca : null,
        categoriaId: categoriaId.length > 0 ? categoriaId : null,
      }),
    )
    return productos.flatMap((producto, indice) => {
      if (!facetados.has(producto)) return []
      if (modo === 'maestro' && !mostrarInactivos && !producto.activo) {
        return []
      }
      if (soloAlertas && !(codigosEnAlerta?.has(producto.codigo) ?? false)) {
        return []
      }
      if (
        soloProblemas &&
        (porCodigo.get(producto.codigo)?.length ?? 0) === 0
      ) {
        return []
      }
      return [{ producto, indice }]
    })
  }, [
    productos,
    marca,
    categoriaId,
    soloProblemas,
    porCodigo,
    modo,
    mostrarInactivos,
    soloAlertas,
    codigosEnAlerta,
  ])

  const filasConProblema = useMemo(
    () =>
      productos.filter(
        (producto) => (porCodigo.get(producto.codigo)?.length ?? 0) > 0,
      ).length,
    [productos, porCodigo],
  )

  const virtualizador = useVirtualizer({
    count: visibles.length,
    getScrollElement: () => scrollRef.current,
    initialRect: { width: 800, height: 640 },
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
    estimateSize: (index) => {
      const fila = visibles[index]
      if (fila === undefined) return ALTO_FILA
      return estimarAltoDeFila(
        fila.producto.descripcion,
        (porCodigo.get(fila.producto.codigo)?.length ?? 0) > 0,
      )
    },
    measureElement: (el) => {
      const alto = el.getBoundingClientRect().height
      return alto > 0 ? alto : ALTO_FILA
    },
    getItemKey: (index) => {
      const fila = visibles[index]
      if (fila === undefined) return index
      return `${fila.indice}:${fila.producto.codigo}`
    },
    overscan: OVERSCAN,
  })

  useLayoutEffect(() => {
    if (codigoAEnfocar == null) return
    setMarca('')
    setCategoriaId('')
    setSoloProblemas(false)
  }, [codigoAEnfocar])

  useLayoutEffect(() => {
    if (codigoAEnfocar == null) return
    const i = visibles.findIndex(
      (fila) => fila.producto.codigo === codigoAEnfocar,
    )
    if (i < 0) return
    virtualizador.scrollToIndex(i, { align: 'start' })
    const id = window.requestAnimationFrame(() => {
      const campo = scrollRef.current?.querySelector(
        `[aria-label="Descripción ${codigoAEnfocar}"]`,
      )
      if (campo instanceof HTMLTextAreaElement) {
        campo.focus()
        campo.select()
      }
      onCodigoEnfocado?.()
    })
    return () => window.cancelAnimationFrame(id)
  }, [codigoAEnfocar, visibles, virtualizador, onCodigoEnfocado])

  function parche(indice: number, cambio: Partial<Producto>): void {
    if (soloLectura) return
    onProductos(
      productos.map((producto, i) =>
        i === indice ? { ...producto, ...cambio } : producto,
      ),
    )
  }

  function alternar(indice: number): void {
    if (soloLectura) return
    const siguiente = new Set(seleccion)
    if (siguiente.has(indice)) siguiente.delete(indice)
    else siguiente.add(indice)
    setSeleccion(siguiente)
  }

  function seleccionarVisibles(): void {
    setSeleccion(new Set(visibles.map((fila) => fila.indice)))
  }

  function quitarSeleccion(): void {
    if (seleccion.size === 0 || soloLectura) return
    onProductos(productos.filter((_, indice) => !seleccion.has(indice)))
    setSeleccion(new Set())
  }

  function darDeBaja(): void {
    if (seleccion.size === 0 || soloLectura) return
    onProductos(
      productos.map((producto, indice) =>
        seleccion.has(indice) ? { ...producto, activo: false } : producto,
      ),
    )
    setSeleccion(new Set())
  }

  function crearCategoria(): void {
    if (soloLectura) return
    const nombre = nombreNueva.trim()
    if (nombre.length === 0) return
    if (
      categorias.some((c) => c.nombre.toLowerCase() === nombre.toLowerCase())
    ) {
      return
    }
    onCategorias([...categorias, { id: idDeCategoria(), nombre }])
    setNombreNueva('')
  }

  function asignarSeleccion(): void {
    if (asignarA.length === 0 || seleccion.size === 0 || soloLectura) return
    onProductos(
      productos.map((producto, indice) =>
        seleccion.has(indice)
          ? { ...producto, categoriaId: asignarA }
          : producto,
      ),
    )
    setSeleccion(new Set())
  }

  return (
    <section className="flex flex-col gap-4 rounded-3xl border border-borde bg-papel p-6 shadow-sm">
      <header className="flex flex-col gap-3">
        {modo === 'revision' ? (
          <BalanceCifras
            reconocidos={balance.reconocidos}
            nuevos={balance.nuevos}
            cambiados={balance.cambiados}
            desaparecen={balance.desaparecen}
            problemas={filasConProblema}
          />
        ) : null}
      </header>

      <div className="flex flex-col gap-3 rounded-2xl bg-mesa p-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex min-w-44 flex-1 flex-col gap-1 sm:max-w-48">
            <Etiqueta htmlFor="revision-marca">Filtrar marca</Etiqueta>
            <Selector
              id="revision-marca"
              etiqueta="Filtrar marca"
              ocultarEtiqueta
              valor={marca}
              onCambiar={setMarca}
              opciones={[
                { valor: '', etiqueta: 'Todas' },
                ...marcas.map((cada) => ({ valor: cada, etiqueta: cada })),
              ]}
            />
          </div>
          <div className="flex min-w-44 flex-1 flex-col gap-1 sm:max-w-48">
            <Etiqueta htmlFor="revision-cat">Filtrar categoría</Etiqueta>
            <Selector
              id="revision-cat"
              etiqueta="Filtrar categoría"
              ocultarEtiqueta
              valor={categoriaId}
              onCambiar={setCategoriaId}
              opciones={[
                { valor: '', etiqueta: 'Todas' },
                ...categorias.map((cada) => ({
                  valor: cada.id,
                  etiqueta: cada.nombre,
                })),
              ]}
            />
          </div>
          {modo === 'revision' ? (
            <>
              <Boton
                variante={soloProblemas ? 'peligro' : 'secundario'}
                aria-pressed={soloProblemas}
                disabled={filasConProblema === 0 && !soloProblemas}
                onClick={() => setSoloProblemas((actual) => !actual)}
              >
                Con problemas
                {filasConProblema > 0 ? ` (${filasConProblema})` : ''}
              </Boton>
              <Boton
                onClick={seleccionarVisibles}
                disabled={marca.length === 0 || visibles.length === 0}
              >
                Seleccionar marca
              </Boton>
              <Boton
                variante="peligro"
                onClick={quitarSeleccion}
                disabled={seleccion.size === 0 || soloLectura}
              >
                Quitar ({seleccion.size})
              </Boton>
            </>
          ) : (
            <>
              <label className="flex min-h-11 items-center gap-2 px-2 text-cuerpo text-tinta">
                <Casilla
                  checked={mostrarInactivos}
                  onCheckedChange={(valor) =>
                    onMostrarInactivos?.(valor === true)
                  }
                  aria-label="Mostrar inactivos"
                />
                Mostrar inactivos
              </label>
              <Boton
                variante="peligro"
                onClick={darDeBaja}
                disabled={seleccion.size === 0 || soloLectura}
              >
                Dar de baja ({seleccion.size})
              </Boton>
              <Boton
                variante="peligro"
                tamano="icono"
                aria-label={
                  seleccion.size === 1
                    ? 'Eliminar 1 producto de la lista'
                    : `Eliminar ${seleccion.size} productos de la lista`
                }
                onClick={quitarSeleccion}
                disabled={seleccion.size === 0 || soloLectura}
              >
                <Trash2 className="size-4" aria-hidden />
              </Boton>
            </>
          )}
        </div>

        <div className="grid gap-3 border-t border-borde pt-3 md:grid-cols-2">
          <div className="flex min-w-0 flex-wrap items-end gap-2">
            <div className="flex min-w-52 flex-1 flex-col gap-1">
              <Etiqueta htmlFor="nueva-cat">Nueva categoría</Etiqueta>
              <Campo
                id="nueva-cat"
                value={nombreNueva}
                disabled={soloLectura}
                onChange={(e) => setNombreNueva(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    crearCategoria()
                  }
                }}
              />
            </div>
            <Boton
              onClick={crearCategoria}
              disabled={soloLectura || nombreNueva.trim().length === 0}
            >
              Crear
            </Boton>
          </div>

          <div className="flex min-w-0 flex-wrap items-end gap-2">
            <div className="flex min-w-52 flex-1 flex-col gap-1">
              <Etiqueta htmlFor="asignar-cat">Asignar a selección</Etiqueta>
              <Selector
                id="asignar-cat"
                etiqueta="Asignar a selección"
                ocultarEtiqueta
                valor={asignarA}
                onCambiar={setAsignarA}
                opciones={[
                  { valor: '', etiqueta: 'Elegir…' },
                  ...categorias.map((cada) => ({
                    valor: cada.id,
                    etiqueta: cada.nombre,
                  })),
                ]}
              />
            </div>
            <Boton
              variante="principal"
              onClick={asignarSeleccion}
              disabled={
                soloLectura || asignarA.length === 0 || seleccion.size === 0
              }
            >
              Asignar ({seleccion.size})
            </Boton>
          </div>
        </div>
      </div>

      <div
        role="table"
        aria-label={
          modo === 'maestro' ? 'Catálogo publicado' : 'Productos a publicar'
        }
        className="overflow-x-auto rounded-2xl border border-borde"
      >
        <div className={anchoMinimo}>
          <div
            role="row"
            className={`grid ${columnas} gap-1 border-b border-borde bg-mesa px-2 py-2 font-mono text-etiqueta uppercase text-desvaida`}
          >
          <span role="columnheader">Sel.</span>
          <span role="columnheader">Código</span>
          <span role="columnheader">Descripción</span>
          <span role="columnheader">Marca</span>
          <span role="columnheader">U.M.</span>
          <span role="columnheader">Precio</span>
          <span role="columnheader">Categoría</span>
          {modo === 'maestro' ? (
            <span role="columnheader" className="flex justify-center">
              <Boxes className="size-4" aria-hidden />
              <span className="sr-only">Cantidad</span>
            </span>
          ) : null}
        </div>
        <div
          ref={scrollRef}
          className="max-h-[min(70dvh,40rem)] overflow-y-auto bg-papel"
        >
          <div
            className="relative w-full"
            style={{ height: `${virtualizador.getTotalSize()}px` }}
          >
            {virtualizador.getVirtualItems().map((virtual) => {
              const fila = visibles[virtual.index]
              if (fila === undefined) return null
              const { producto, indice } = fila
              const deEsta = porCodigo.get(producto.codigo) ?? []
              const tieneProblema = deEsta.length > 0
              const idError = `conflicto-${indice}`
              const unidadInvalida = deEsta.some(
                (c) => c.tipo === 'unidad_desconocida',
              )
              const descripcionInvalida = deEsta.some(
                (c) => c.tipo === 'descripcion_ausente',
              )
              const codigoInvalido = deEsta.some(
                (c) => c.tipo === 'codigo_duplicado',
              )
              const enAlerta = codigosEnAlerta?.has(producto.codigo) ?? false

              return (
                <div
                  key={virtual.key}
                  data-index={virtual.index}
                  ref={virtualizador.measureElement}
                  role="row"
                  className={`absolute top-0 left-0 flex w-full flex-col border-b border-borde ${
                    tieneProblema ? 'bg-aviso/10' : 'bg-papel'
                  } ${producto.activo ? '' : 'opacity-60'}`}
                  style={{
                    transform: `translateY(${virtual.start}px)`,
                  }}
                >
                  <div
                    className={`grid ${columnas} min-h-12 items-start gap-1 px-2 py-1`}
                  >
                    <span role="cell">
                      <Casilla
                        checked={seleccion.has(indice)}
                        disabled={soloLectura}
                        onCheckedChange={() => alternar(indice)}
                        aria-label={`Seleccionar ${producto.codigo}`}
                      />
                    </span>
                    <span role="cell">
                      <Campo
                        variante="en-linea"
                        className="font-mono text-etiqueta"
                        value={producto.codigo}
                        invalido={codigoInvalido}
                        disabled={soloLectura}
                        aria-label={`Código ${producto.codigo}`}
                        aria-errormessage={tieneProblema ? idError : undefined}
                        maxLength={40}
                        onChange={(e) =>
                          parche(indice, { codigo: e.target.value })
                        }
                      />
                    </span>
                    <span role="cell" className="min-w-0">
                      <CampoArea
                        variante="en-linea"
                        className="uppercase"
                        value={producto.descripcion}
                        invalido={descripcionInvalida}
                        disabled={soloLectura}
                        aria-label={`Descripción ${producto.codigo}`}
                        aria-errormessage={tieneProblema ? idError : undefined}
                        onChange={(e) =>
                          parche(indice, {
                            descripcion: e.target.value,
                          })
                        }
                      />
                    </span>
                    <span role="cell">
                      <Campo
                        variante="en-linea"
                        value={producto.marca}
                        disabled={soloLectura}
                        aria-label={`Marca ${producto.codigo}`}
                        onChange={(e) =>
                          parche(indice, { marca: e.target.value })
                        }
                      />
                    </span>
                    <span role="cell">
                      <Campo
                        variante="en-linea"
                        alineacion="centro"
                        className="font-mono text-etiqueta uppercase"
                        value={producto.unidad}
                        invalido={unidadInvalida}
                        disabled={soloLectura}
                        aria-label={`Unidad ${producto.codigo}`}
                        aria-errormessage={tieneProblema ? idError : undefined}
                        onChange={(e) =>
                          parche(indice, {
                            unidad: e.target.value.toUpperCase(),
                          })
                        }
                      />
                    </span>
                    <span role="cell">
                      <Campo
                        key={`${indice}-precio`}
                        variante="en-linea"
                        numerico
                        inputMode="decimal"
                        disabled={soloLectura}
                        defaultValue={(producto.precio / 100).toFixed(2)}
                        aria-label={`Precio ${producto.codigo}`}
                        onBlur={(e) => {
                          const n = Number.parseFloat(e.target.value)
                          if (!Number.isFinite(n) || n < 0) {
                            e.target.value = (producto.precio / 100).toFixed(2)
                            return
                          }
                          parche(indice, { precio: Math.round(n * 100) })
                        }}
                      />
                    </span>
                    <span role="cell" className="truncate text-cuerpo">
                      {categorias.find((c) => c.id === producto.categoriaId)
                        ?.nombre ?? '—'}
                      <span className="sr-only">
                        {' '}
                        {formatearImporte(producto.precio)}
                      </span>
                    </span>
                    {modo === 'maestro' ? (
                      <span role="cell" className="flex justify-center">
                        <Boton
                          variante="discreto"
                          tamano="icono"
                          className={enAlerta ? 'text-aviso' : undefined}
                          aria-label={`Cantidad orientativa de ${producto.codigo}`}
                          onClick={() => onPedirCantidad?.(producto.codigo)}
                        >
                          <Boxes className="size-4" aria-hidden />
                        </Boton>
                      </span>
                    ) : null}
                  </div>
                  {tieneProblema ? (
                    <p
                      id={idError}
                      role="note"
                      className={`grid ${columnas} gap-1 px-2 pb-1.5`}
                    >
                      <span aria-hidden />
                      <span className="col-span-6 min-w-0 font-mono text-etiqueta leading-tight text-aviso">
                        {textoDeConflictos(deEsta)}
                      </span>
                    </p>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
        </div>
      </div>
      <p className="font-mono text-etiqueta text-desvaida">
        {visibles.length} de {productos.length} productos visibles
      </p>
    </section>
  )
}

function BalanceCifras({
  reconocidos,
  nuevos,
  cambiados,
  desaparecen,
  problemas,
}: {
  readonly reconocidos: number
  readonly nuevos: number
  readonly cambiados: number
  readonly desaparecen: number
  readonly problemas: number
}) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-borde bg-borde sm:grid-cols-3 md:grid-cols-5">
      <Cifra cifra={reconocidos} etiqueta="reconocidos" icono={ListChecks} />
      <Cifra cifra={nuevos} etiqueta="nuevos" icono={Plus} />
      <Cifra cifra={cambiados} etiqueta="cambiados" icono={PencilLine} />
      <Cifra cifra={desaparecen} etiqueta="salen" icono={Minus} />
      <Cifra
        cifra={problemas}
        etiqueta="con problema"
        icono={TriangleAlert}
        aviso={problemas > 0}
      />
    </dl>
  )
}

function Cifra({
  cifra,
  etiqueta,
  icono: Icono,
  aviso = false,
}: {
  readonly cifra: number
  readonly etiqueta: string
  readonly icono: LucideIcon
  readonly aviso?: boolean
}) {
  return (
    <div
      className={`flex min-w-0 items-center gap-3 px-4 py-3 ${
        aviso ? 'bg-aviso/10' : 'bg-papel'
      }`}
    >
      <span
        className={
          aviso
            ? 'flex size-9 shrink-0 items-center justify-center rounded-full bg-papel text-aviso'
            : 'flex size-9 shrink-0 items-center justify-center rounded-full bg-mesa text-desvaida'
        }
        aria-hidden
      >
        <Icono className="size-4" strokeWidth={2.25} />
      </span>
      <div className="min-w-0">
        <dt
          className={`truncate text-etiqueta tracking-normal capitalize ${
            aviso ? 'font-bold text-aviso' : 'text-desvaida'
          }`}
        >
          {etiqueta}
        </dt>
        <dd
          className={`font-mono text-cabecera font-bold tabular-nums ${
            aviso ? 'text-aviso' : 'text-tinta'
          }`}
        >
          {cifra}
        </dd>
      </div>
    </div>
  )
}
