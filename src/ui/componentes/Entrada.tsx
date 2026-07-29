import { useEffect, useRef, useState } from 'react'
import { Camera, Mic, Search } from 'lucide-react'
import { formatearImporte } from '../../domain/totales/calculo.ts'
import type {
  ProductoBuscable,
  ResultadoDeBusqueda,
} from '../../domain/busqueda/productos.ts'

/**
 * La entrada. Un campo, tres alimentaciones, fijo arriba.
 *
 * ## Por qué un solo campo
 *
 * No hay tres cajas —escribir, dictar, fotografiar— sino una boca de entrada con
 * tres formas de alimentarla. Tres campos obligarían al vendedor a elegir el
 * método antes de saber qué va a hacer, y el método correcto casi siempre es
 * teclear.
 *
 * ## La sugerencia no espera nada
 *
 * Se busca sobre el catálogo en memoria en el mismo gesto de teclear, sin
 * antirrebote y sin estado de carga. **No hay latencia que amortiguar**: la
 * búsqueda es local por diseño (FR-007), así que meter un retardo de 200 ms para
 * "no sobrecargar" sería añadir la única espera del recorrido y no ahorrar nada.
 *
 * ## Lo que se dice cuando no hay coincidencias, y por qué
 *
 * Un buscador que ante "codo fg 3/4" devuelve calladamente el codo de 1/2 porque
 * era lo más parecido es **peor** que uno que no devuelve nada: el vendedor teclea
 * rápido, ve una fila, la acepta y factura la pieza equivocada. De ahí que se
 * distinga con palabras la ausencia de coincidencias de la coincidencia
 * aproximada (FR-008).
 *
 * ## Los botones caídos se ven inertes y dicen por qué
 *
 * Cuando la asistencia no está disponible, el micrófono y la cámara quedan
 * visiblemente inutilizables con el motivo escrito. Lo que **no** se hace es
 * presentar escribir como plan B, porque no lo es: escribir es la vía principal y
 * el dictado es la ayuda.
 */

export interface PropsDeEntrada {
  readonly resultado: ResultadoDeBusqueda<ProductoBuscable>
  readonly termino: string
  readonly onTerminoCambia: (termino: string) => void
  readonly onElegirProducto: (producto: ProductoBuscable) => void
  readonly asistenciaDisponible: boolean
  readonly onDictar?: () => void
  readonly onFotografiar?: () => void
  /** Enfoca al montar. Es lo que permite teclear sin tocar nada al llegar. */
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

  // Toda la venta tiene que poder hacerse solo con teclado, incluida la elección
  // del producto: no se puede depender de la precisión del puntero cuando se
  // trabaja de pie.
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
    <div className="sticky top-0 z-20 w-full border-b-2 border-tinta bg-mesa">
      <div className="mx-auto flex w-full max-w-5xl items-stretch gap-2 px-3 py-2">
        <div className="relative flex flex-1 items-center">
          <Search
            className="pointer-events-none absolute left-3 size-5 text-desvaida"
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
              'min-h-14 w-full border-2 border-tinta bg-papel pl-11 pr-3',
              'text-entrada text-tinta placeholder:text-desvaida',
              'focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-tinta',
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
        <p className="mx-auto w-full max-w-5xl px-3 pb-2 font-mono text-etiqueta uppercase text-aviso">
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
        // Objetivos generosos: se pulsan de pie y con prisa.
        'flex min-h-14 w-14 shrink-0 items-center justify-center border-2',
        'focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-tinta',
        disponible
          ? 'border-tinta bg-papel text-tinta hover:bg-tinta hover:text-papel'
          : 'cursor-not-allowed border-desvaida bg-mesa text-desvaida',
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
      <div className="mx-auto w-full max-w-5xl border-t-2 border-desvaida bg-papel px-3 py-3">
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
    <div className="mx-auto w-full max-w-5xl border-t-2 border-desvaida bg-papel">
      {resultado.soloAproximadas && (
        // La advertencia que evita facturar la pieza equivocada. Dicha con
        // palabras y no insinuada con un color más pálido.
        <p className="border-b border-aviso px-3 py-1.5 font-mono text-etiqueta font-bold uppercase text-aviso">
          Nada coincide con exactitud. Comprueba antes de aceptar.
        </p>
      )}
      <ul id="sugerencias-de-producto" role="listbox" className="max-h-80 overflow-y-auto">
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
                'flex min-h-11 w-full items-baseline justify-between gap-3 px-3 py-2 text-left',
                indice === resaltado ? 'bg-tinta text-papel' : 'text-tinta',
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
