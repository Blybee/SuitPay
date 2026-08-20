import { useRef, useMemo, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { CategoriaDeCatalogo, Producto } from '../../domain/esquemas/comunes.ts'
import { filtrarPorFacetas, marcasDe } from '../../domain/catalogo/filtros.ts'
import { formatearImporte } from '../../domain/totales/calculo.ts'
import {
  Boton,
  Campo,
  Casilla,
  Etiqueta,
} from '../../ui/componentes/primitivas.tsx'

/**
 * Grilla de revisión previa a publicar (FR-009b, FR-009d).
 * Crear categoría, filtrar, seleccionar, editar inline y quitar filas.
 * Nada se escribe hasta confirmar. Virtualizada: ~3000 filas del PDF.
 */

function idDeCategoria(): string {
  return crypto.randomUUID().slice(0, 8)
}

const ALTO_FILA = 48

export function GrillaRevision({
  productos,
  categorias,
  onProductos,
  onCategorias,
}: {
  readonly productos: readonly Producto[]
  readonly categorias: readonly CategoriaDeCatalogo[]
  readonly onProductos: (productos: readonly Producto[]) => void
  readonly onCategorias: (categorias: readonly CategoriaDeCatalogo[]) => void
}) {
  const [marca, setMarca] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [nombreNueva, setNombreNueva] = useState('')
  const [seleccion, setSeleccion] = useState<ReadonlySet<string>>(
    () => new Set(),
  )
  const [asignarA, setAsignarA] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const marcas = useMemo(() => marcasDe(productos), [productos])
  const visibles = useMemo(
    () =>
      filtrarPorFacetas(productos, {
        marca: marca.length > 0 ? marca : null,
        categoriaId: categoriaId.length > 0 ? categoriaId : null,
      }),
    [productos, marca, categoriaId],
  )

  const virtualizador = useVirtualizer({
    count: visibles.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ALTO_FILA,
    overscan: 10,
  })

  function parche(codigo: string, cambio: Partial<Producto>): void {
    onProductos(
      productos.map((producto) =>
        producto.codigo === codigo ? { ...producto, ...cambio } : producto,
      ),
    )
  }

  function alternar(codigo: string): void {
    const siguiente = new Set(seleccion)
    if (siguiente.has(codigo)) siguiente.delete(codigo)
    else siguiente.add(codigo)
    setSeleccion(siguiente)
  }

  function seleccionarVisibles(): void {
    setSeleccion(new Set(visibles.map((p) => p.codigo)))
  }

  function quitarSeleccion(): void {
    if (seleccion.size === 0) return
    onProductos(productos.filter((p) => !seleccion.has(p.codigo)))
    setSeleccion(new Set())
  }

  function crearCategoria(): void {
    const nombre = nombreNueva.trim()
    if (nombre.length === 0) return
    if (categorias.some((c) => c.nombre.toLowerCase() === nombre.toLowerCase())) {
      return
    }
    onCategorias([...categorias, { id: idDeCategoria(), nombre }])
    setNombreNueva('')
  }

  function asignarSeleccion(): void {
    if (asignarA.length === 0 || seleccion.size === 0) return
    onProductos(
      productos.map((producto) =>
        seleccion.has(producto.codigo)
          ? { ...producto, categoriaId: asignarA }
          : producto,
      ),
    )
    setSeleccion(new Set())
  }

  return (
    <section className="flex flex-col gap-4 rounded-3xl border border-borde bg-papel p-6 shadow-sm">
      <h2 className="text-subtitulo font-bold text-tinta">Revisión</h2>
      <p className="text-cuerpo text-desvaida">
        Crea categorías de un nivel, asígnalas a la selección, edita o quita
        filas. Nada se escribe hasta confirmar.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-40 flex-col gap-1">
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
        </label>
        <label className="flex min-w-40 flex-col gap-1">
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
        </label>
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

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-48 flex-col gap-1">
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
        </label>
        <Boton onClick={crearCategoria} disabled={nombreNueva.trim().length === 0}>
          Crear
        </Boton>
        <label className="flex min-w-40 flex-col gap-1">
          <Etiqueta htmlFor="asignar-cat">Asignar a selección</Etiqueta>
          <select
            id="asignar-cat"
            className="min-h-11 rounded-full border border-borde bg-papel px-4"
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
        </label>
        <Boton
          variante="principal"
          onClick={asignarSeleccion}
          disabled={asignarA.length === 0 || seleccion.size === 0}
        >
          Asignar ({seleccion.size})
        </Boton>
      </div>

      <div
        role="table"
        aria-label="Productos a publicar"
        className="rounded-2xl border border-borde"
      >
        <div
          role="row"
          className="grid grid-cols-[2.5rem_8rem_1fr_7rem_4.5rem_6rem_7rem] gap-1 border-b border-borde bg-mesa px-2 py-2 font-mono text-etiqueta uppercase text-desvaida"
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
            {virtualizador.getVirtualItems().map((fila) => {
              const producto = visibles[fila.index]
              if (producto === undefined) return null
              return (
                <div
                  key={producto.codigo}
                  role="row"
                  className="absolute top-0 left-0 grid w-full grid-cols-[2.5rem_8rem_1fr_7rem_4.5rem_6rem_7rem] items-center gap-1 border-b border-borde px-2"
                  style={{
                    height: `${fila.size}px`,
                    transform: `translateY(${fila.start}px)`,
                  }}
                >
                  <span role="cell">
                    <Casilla
                      checked={seleccion.has(producto.codigo)}
                      onCheckedChange={() => alternar(producto.codigo)}
                      aria-label={`Seleccionar ${producto.codigo}`}
                    />
                  </span>
                  <span
                    role="cell"
                    className="truncate font-mono text-etiqueta"
                    title={producto.codigo}
                  >
                    {producto.codigo}
                  </span>
                  <span role="cell">
                    <input
                      className="min-h-11 w-full rounded-full border border-borde bg-papel px-3 text-cuerpo uppercase"
                      value={producto.descripcion}
                      aria-label={`Descripción ${producto.codigo}`}
                      onChange={(e) =>
                        parche(producto.codigo, {
                          descripcion: e.target.value,
                        })
                      }
                    />
                  </span>
                  <span role="cell">
                    <input
                      className="min-h-11 w-full rounded-full border border-borde bg-papel px-3 text-cuerpo"
                      value={producto.marca}
                      aria-label={`Marca ${producto.codigo}`}
                      onChange={(e) =>
                        parche(producto.codigo, { marca: e.target.value })
                      }
                    />
                  </span>
                  <span role="cell">
                    <input
                      className="min-h-11 w-full rounded-full border border-borde bg-papel px-2 font-mono text-etiqueta"
                      value={producto.unidad}
                      aria-label={`Unidad ${producto.codigo}`}
                      onChange={(e) =>
                        parche(producto.codigo, {
                          unidad: e.target.value.toUpperCase(),
                        })
                      }
                    />
                  </span>
                  <span role="cell">
                    <input
                      key={`${producto.codigo}-precio`}
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
                        parche(producto.codigo, { precio: Math.round(n * 100) })
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
