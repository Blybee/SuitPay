import { useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  ListChecks,
  Minus,
  PencilLine,
  Plus,
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
  Casilla,
  Distintivo,
  Etiqueta,
} from '../../ui/componentes/primitivas.tsx'

/**
 * Grilla de revisión previa a publicar (FR-009b, FR-009d).
 * Crear categoría, filtrar, seleccionar, editar inline y quitar filas.
 * Los conflictos viven en la fila (validación en línea), no en un recuadro aparte.
 * Nada se escribe hasta confirmar. Virtualizada: ~3000 filas del PDF.
 */

function idDeCategoria(): string {
  return crypto.randomUUID().slice(0, 8)
}

const ALTO_FILA = 48
const ALTO_CALLOUT = 28
const COLUMNAS = 'grid-cols-[2.5rem_8rem_1fr_7rem_4.5rem_6rem_7rem]'

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
}: {
  readonly productos: readonly Producto[]
  readonly categorias: readonly CategoriaDeCatalogo[]
  readonly balance: BalanceDeRevision
  readonly onProductos: (productos: readonly Producto[]) => void
  readonly onCategorias: (categorias: readonly CategoriaDeCatalogo[]) => void
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
      if (
        soloProblemas &&
        (porCodigo.get(producto.codigo)?.length ?? 0) === 0
      ) {
        return []
      }
      return [{ producto, indice }]
    })
  }, [productos, marca, categoriaId, soloProblemas, porCodigo])

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
    initialRect: { width: 800, height: 384 },
    observeElementRect: (_instancia, informar) => {
      const el = scrollRef.current
      const emitir = (): void => {
        informar({
          width: el?.clientWidth || 800,
          height: el?.clientHeight || 384,
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
      return (porCodigo.get(fila.producto.codigo)?.length ?? 0) > 0
        ? ALTO_FILA + ALTO_CALLOUT
        : ALTO_FILA
    },
    getItemKey: (index) => {
      const fila = visibles[index]
      if (fila === undefined) return index
      const problemas = porCodigo.get(fila.producto.codigo)?.length ?? 0
      return `${fila.indice}:${problemas}`
    },
    overscan: 8,
  })

  function parche(indice: number, cambio: Partial<Producto>): void {
    onProductos(
      productos.map((producto, i) =>
        i === indice ? { ...producto, ...cambio } : producto,
      ),
    )
  }

  function alternar(indice: number): void {
    const siguiente = new Set(seleccion)
    if (siguiente.has(indice)) siguiente.delete(indice)
    else siguiente.add(indice)
    setSeleccion(siguiente)
  }

  function seleccionarVisibles(): void {
    setSeleccion(new Set(visibles.map((fila) => fila.indice)))
  }

  function quitarSeleccion(): void {
    if (seleccion.size === 0) return
    onProductos(productos.filter((_, indice) => !seleccion.has(indice)))
    setSeleccion(new Set())
  }

  function crearCategoria(): void {
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
    if (asignarA.length === 0 || seleccion.size === 0) return
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
        <BalanceCifras
          reconocidos={balance.reconocidos}
          nuevos={balance.nuevos}
          cambiados={balance.cambiados}
          desaparecen={balance.desaparecen}
          problemas={filasConProblema}
        />
        {balance.publicado && balance.version !== null ? (
          <div className="flex justify-end">
            <Distintivo tono="sello">Versión {balance.version}</Distintivo>
          </div>
        ) : null}
      </header>

      <div className="flex flex-col gap-3 rounded-2xl bg-mesa p-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex min-w-44 flex-1 flex-col gap-1 sm:max-w-48">
            <Etiqueta htmlFor="revision-marca">Filtrar marca</Etiqueta>
            <select
              id="revision-marca"
              className="min-h-11 rounded-full border border-borde bg-papel px-4"
              value={marca}
              onChange={(e) => setMarca(e.target.value)}
            >
              <option value="">Todas</option>
              {marcas.map((cada) => (
                <option key={cada} value={cada}>
                  {cada}
                </option>
              ))}
            </select>
          </div>
          <div className="flex min-w-44 flex-1 flex-col gap-1 sm:max-w-48">
            <Etiqueta htmlFor="revision-cat">Filtrar categoría</Etiqueta>
            <select
              id="revision-cat"
              className="min-h-11 rounded-full border border-borde bg-papel px-4"
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
            >
              <option value="">Todas</option>
              {categorias.map((cada) => (
                <option key={cada.id} value={cada.id}>
                  {cada.nombre}
                </option>
              ))}
            </select>
          </div>
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
            disabled={seleccion.size === 0}
          >
            Quitar ({seleccion.size})
          </Boton>
        </div>

        <div className="grid gap-3 border-t border-borde pt-3 md:grid-cols-2">
          <div className="flex min-w-0 flex-wrap items-end gap-2">
            <div className="flex min-w-52 flex-1 flex-col gap-1">
              <Etiqueta htmlFor="nueva-cat">Nueva categoría</Etiqueta>
              <Campo
                id="nueva-cat"
                value={nombreNueva}
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
              disabled={nombreNueva.trim().length === 0}
            >
              Crear
            </Boton>
          </div>

          <div className="flex min-w-0 flex-wrap items-end gap-2">
            <div className="flex min-w-52 flex-1 flex-col gap-1">
              <Etiqueta htmlFor="asignar-cat">Asignar a selección</Etiqueta>
              <select
                id="asignar-cat"
                className="min-h-11 w-full rounded-full border border-borde bg-papel px-4"
                value={asignarA}
                onChange={(e) => setAsignarA(e.target.value)}
              >
                <option value="">Elegir…</option>
                {categorias.map((cada) => (
                  <option key={cada.id} value={cada.id}>
                    {cada.nombre}
                  </option>
                ))}
              </select>
            </div>
            <Boton
              variante="principal"
              onClick={asignarSeleccion}
              disabled={asignarA.length === 0 || seleccion.size === 0}
            >
              Asignar ({seleccion.size})
            </Boton>
          </div>
        </div>
      </div>

      <div
        role="table"
        aria-label="Productos a publicar"
        className="overflow-hidden rounded-2xl border border-borde"
      >
        <div
          role="row"
          className={`grid ${COLUMNAS} gap-1 border-b border-borde bg-mesa px-2 py-2 font-mono text-etiqueta uppercase text-desvaida`}
        >
          <span role="columnheader">Sel.</span>
          <span role="columnheader">Código</span>
          <span role="columnheader">Descripción</span>
          <span role="columnheader">Marca</span>
          <span role="columnheader">U.M.</span>
          <span role="columnheader">Precio</span>
          <span role="columnheader">Categoría</span>
        </div>
        <div ref={scrollRef} className="max-h-96 overflow-auto">
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

              return (
                <div
                  key={indice}
                  role="row"
                  className={`absolute top-0 left-0 flex w-full flex-col border-b border-borde ${
                    tieneProblema ? 'bg-aviso/10' : ''
                  }`}
                  style={{
                    height: `${virtual.size}px`,
                    transform: `translateY(${virtual.start}px)`,
                  }}
                >
                  <div
                    className={`grid ${COLUMNAS} min-h-12 items-center gap-1 px-2`}
                  >
                    <span role="cell">
                      <Casilla
                        checked={seleccion.has(indice)}
                        onCheckedChange={() => alternar(indice)}
                        aria-label={`Seleccionar ${producto.codigo}`}
                      />
                    </span>
                    <span role="cell">
                      <Campo
                        className="px-3 font-mono text-etiqueta"
                        value={producto.codigo}
                        invalido={codigoInvalido}
                        aria-label={`Código ${producto.codigo}`}
                        aria-errormessage={tieneProblema ? idError : undefined}
                        maxLength={40}
                        onChange={(e) =>
                          parche(indice, { codigo: e.target.value })
                        }
                      />
                    </span>
                    <span role="cell">
                      <Campo
                        className="px-3 uppercase"
                        value={producto.descripcion}
                        invalido={descripcionInvalida}
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
                        className="px-3"
                        value={producto.marca}
                        aria-label={`Marca ${producto.codigo}`}
                        onChange={(e) =>
                          parche(indice, { marca: e.target.value })
                        }
                      />
                    </span>
                    <span role="cell">
                      <Campo
                        className="px-2 font-mono text-etiqueta"
                        value={producto.unidad}
                        invalido={unidadInvalida}
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
                      <input
                        key={`${indice}-precio`}
                        className="min-h-11 w-full rounded-full border border-borde bg-papel px-2 text-right font-mono tabular-nums"
                        inputMode="decimal"
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
                  </div>
                  {tieneProblema ? (
                    <p
                      id={idError}
                      role="note"
                      className={`grid ${COLUMNAS} gap-1 px-2 pb-1.5`}
                    >
                      <span aria-hidden />
                      <span className="col-span-6 min-w-0 truncate font-mono text-etiqueta leading-tight text-aviso">
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
