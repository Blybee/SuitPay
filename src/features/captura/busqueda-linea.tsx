import { useEffect, useId, useRef, useState } from 'react'
import { usarCatalogo } from '../catalogo/almacen.ts'
import type { ProductoBuscable } from '../../domain/busqueda/productos.ts'

/**
 * Combobox local para resolver una línea de captura (FR-061c).
 */
export function ComboboxProductoLinea({
  onElegir,
  onCerrar,
}: {
  readonly onElegir: (producto: ProductoBuscable) => void
  readonly onCerrar: () => void
}) {
  const id = useId()
  const listboxId = `${id}-listbox`
  const campo = useRef<HTMLInputElement>(null)
  const [termino, setTermino] = useState('')
  const [resaltado, setResaltado] = useState(0)
  const catalogo = usarCatalogo()
  const resultado = catalogo.buscar(termino, 8)
  const coincidencias = resultado.coincidencias
  const activo = coincidencias[resaltado]

  useEffect(() => {
    campo.current?.focus()
  }, [])

  useEffect(() => {
    setResaltado(0)
  }, [termino])

  function elegir(indice: number): void {
    const fila = coincidencias[indice]
    if (fila === undefined) return
    onElegir(fila.elemento)
    onCerrar()
  }

  return (
    <div className="relative mt-2">
      <input
        ref={campo}
        type="search"
        role="combobox"
        aria-expanded
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          activo
            ? `${listboxId}-${activo.elemento.codigo}`
            : undefined
        }
        className="min-h-11 w-full rounded-full border border-borde bg-papel px-4 text-tinta placeholder:text-desvaida focus-visible:border-tinta focus-visible:outline-none"
        placeholder="Buscar producto…"
        value={termino}
        onChange={(e) => setTermino(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            onCerrar()
            return
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setResaltado((i) => Math.min(i + 1, coincidencias.length - 1))
            return
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault()
            setResaltado((i) => Math.max(i - 1, 0))
            return
          }
          if (e.key === 'Enter') {
            e.preventDefault()
            elegir(resaltado)
          }
        }}
      />
      {termino.length > 0 ? (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-2xl border border-borde bg-papel shadow-md"
        >
          {resultado.sinCoincidencias ? (
            <li className="px-4 py-3 text-cuerpo text-desvaida">
              Sin coincidencias. Prueba otro término.
            </li>
          ) : (
            coincidencias.map((c, indice) => (
              <li
                key={c.elemento.codigo}
                id={`${listboxId}-${c.elemento.codigo}`}
                role="option"
                aria-selected={indice === resaltado}
              >
                <button
                  type="button"
                  className={[
                    'w-full px-4 py-2 text-left text-cuerpo',
                    indice === resaltado ? 'bg-mesa' : 'hover:bg-mesa',
                  ].join(' ')}
                  onMouseEnter={() => setResaltado(indice)}
                  onClick={() => elegir(indice)}
                >
                  <span className="font-bold text-tinta">
                    {c.elemento.descripcion}
                  </span>
                  <span className="ml-2 font-mono text-etiqueta text-desvaida">
                    {c.elemento.codigo}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  )
}
