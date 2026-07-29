import { useEffect, useRef, useState } from 'react'
import { Camera, Mic, Search } from 'lucide-react'
import { formatearImporte } from '../../domain/totales/calculo.ts'
import type {
  ProductoBuscable,
  ResultadoDeBusqueda,
} from '../../domain/busqueda/productos.ts'

/**
 * Cinta de herramientas del mostrador: un campo + dictado/foto.
 * Persiste siempre en la página de Inicio, anclada arriba (sobre los tabs).
 * Soft-Pill: cápsulas, borde sutil, full-bleed del área de trabajo.
 */

export interface PropsDeEntrada {
  readonly resultado: ResultadoDeBusqueda<ProductoBuscable>
  readonly termino: string
  readonly onTerminoCambia: (termino: string) => void
  readonly onElegirProducto: (producto: ProductoBuscable) => void
  readonly asistenciaDisponible: boolean
  readonly onDictar?: () => void
  readonly onFotografiar?: () => void
  readonly enfocarAlMontar?: boolean
}

export function Entrada({
  resultado,
  termino,
  onTerminoCambia,
  onElegirProducto,
  asistenciaDisponible,
  onDictar,
  onFotografiar,
  enfocarAlMontar = true,
}: PropsDeEntrada) {
  const campo = useRef<HTMLInputElement>(null)
  const [resaltado, setResaltado] = useState(0)

  useEffect(() => {
    if (enfocarAlMontar) campo.current?.focus()
  }, [enfocarAlMontar])

  useEffect(() => {
    setResaltado(0)
  }, [termino])

  const sugiriendo = termino.length > 0
  const coincidencias = resultado.coincidencias

  function elegir(indice: number): void {
    const elegida = coincidencias[indice]
    if (elegida === undefined) return
    onElegirProducto(elegida.elemento)
    onTerminoCambia('')
    campo.current?.focus()
  }

  function alPulsarTecla(evento: React.KeyboardEvent<HTMLInputElement>): void {
    if (coincidencias.length === 0) return
    if (evento.key === 'ArrowDown') {
      evento.preventDefault()
      setResaltado((actual) => (actual + 1) % coincidencias.length)
    } else if (evento.key === 'ArrowUp') {
      evento.preventDefault()
      setResaltado(
        (actual) => (actual - 1 + coincidencias.length) % coincidencias.length,
      )
    } else if (evento.key === 'Enter') {
      evento.preventDefault()
      elegir(resaltado)
    } else if (evento.key === 'Escape') {
      onTerminoCambia('')
    }
  }

  return (
    <div className="sticky top-0 z-20 w-full border-b border-borde bg-papel">
      <div className="flex w-full items-stretch gap-2 px-4 py-3">
        <div className="relative flex flex-1 items-center">
          <Search
            className="pointer-events-none absolute left-4 size-5 text-desvaida"
            aria-hidden
          />
          <input
            ref={campo}
            value={termino}
            onChange={(evento) => onTerminoCambia(evento.target.value)}
            onKeyDown={alPulsarTecla}
            placeholder="Escribe un producto…"
            aria-label="Buscar producto o escribir un comando"
            aria-autocomplete="list"
            aria-expanded={sugiriendo}
            aria-controls="sugerencias-de-producto"
            aria-activedescendant={
              sugiriendo && coincidencias.length > 0
                ? `sugerencia-${resaltado}`
                : undefined
            }
            role="combobox"
            className={[
              'min-h-14 w-full rounded-full border border-borde bg-mesa pl-12 pr-4',
              'text-entrada text-tinta placeholder:text-desvaida shadow-sm',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tinta',
            ].join(' ')}
          />
        </div>

        <BotonDeCaptura
          etiqueta="Dictar el pedido"
          disponible={asistenciaDisponible}
          onClick={onDictar}
        >
          <Mic className="size-6" aria-hidden />
        </BotonDeCaptura>

        <BotonDeCaptura
          etiqueta="Fotografiar el pedido"
          disponible={asistenciaDisponible}
          onClick={onFotografiar}
        >
          <Camera className="size-6" aria-hidden />
        </BotonDeCaptura>
      </div>

      {!asistenciaDisponible && (
        <p className="w-full px-4 pb-2 font-mono text-etiqueta uppercase text-aviso">
          Dictado y fotografía no disponibles
        </p>
      )}

      {sugiriendo && (
        <Sugerencias
          resultado={resultado}
          resaltado={resaltado}
          onElegir={elegir}
          onResaltar={setResaltado}
        />
      )}
    </div>
  )
}

function BotonDeCaptura({
  etiqueta,
  disponible,
  onClick,
  children,
}: {
  readonly etiqueta: string
  readonly disponible: boolean
  readonly onClick: (() => void) | undefined
  readonly children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={etiqueta}
      title={disponible ? etiqueta : `${etiqueta} — no disponible`}
      disabled={!disponible}
      onClick={onClick}
      className={[
        'flex min-h-14 w-14 shrink-0 items-center justify-center rounded-full border',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tinta',
        disponible
          ? 'border-borde bg-papel text-tinta shadow-sm hover:bg-tinta hover:text-papel'
          : 'cursor-not-allowed border-borde bg-mesa text-desvaida',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function Sugerencias({
  resultado,
  resaltado,
  onElegir,
  onResaltar,
}: {
  readonly resultado: ResultadoDeBusqueda<ProductoBuscable>
  readonly resaltado: number
  readonly onElegir: (indice: number) => void
  readonly onResaltar: (indice: number) => void
}) {
  if (resultado.sinCoincidencias) {
    return (
      <div className="w-full border-t border-borde bg-papel px-4 py-3">
        <p className="text-cuerpo font-bold text-aviso">
          No hay ningún producto que coincida con «{resultado.termino}»
        </p>
        <p className="text-cuerpo text-desvaida">
          Revisa cómo se escribe, o pídele al administrador que lo cargue.
        </p>
      </div>
    )
  }

  return (
    <div className="w-full border-t border-borde bg-papel">
      {resultado.soloAproximadas && (
        <p className="border-b border-aviso px-4 py-1.5 font-mono text-etiqueta font-bold uppercase text-aviso">
          Nada coincide con exactitud. Comprueba antes de aceptar.
        </p>
      )}
      <ul
        id="sugerencias-de-producto"
        role="listbox"
        className="max-h-80 overflow-y-auto"
      >
        {resultado.coincidencias.map((coincidencia, indice) => (
          <li
            key={coincidencia.elemento.codigo}
            id={`sugerencia-${indice}`}
            role="option"
            aria-selected={indice === resaltado}
          >
            <button
              type="button"
              onMouseEnter={() => onResaltar(indice)}
              onClick={() => onElegir(indice)}
              className={[
                'flex min-h-11 w-full items-baseline justify-between gap-3 px-4 py-2 text-left',
                indice === resaltado
                  ? 'bg-tinta text-papel'
                  : 'text-tinta hover:bg-mesa',
              ].join(' ')}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-cuerpo">
                  {coincidencia.elemento.descripcion}
                </span>
                <span
                  className={[
                    'block font-mono text-etiqueta uppercase',
                    indice === resaltado ? 'text-papel/70' : 'text-desvaida',
                  ].join(' ')}
                >
                  {coincidencia.elemento.codigo} ·{' '}
                  {coincidencia.elemento.unidad}
                  {coincidencia.grado === 'aproximada' && ' · aproximado'}
                </span>
              </span>
              <span className="font-mono tabular-nums text-cuerpo font-bold">
                {formatearImporte(coincidencia.elemento.precio)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
