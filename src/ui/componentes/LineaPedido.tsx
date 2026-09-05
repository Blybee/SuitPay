import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import {
  calcularImporte,
  formatearImporte,
  lineaEsEmitible,
  precioEsMenorQueCatalogo,
} from '../../domain/totales/calculo.ts'
import type { Centimos, LineaDePedido } from '../../domain/totales/calculo.ts'
import { Campo } from './primitivas.tsx'

/**
 * Un renglón del pedido.
 *
 * ## El precio se edita en el sitio, con piso en el mayorista
 *
 * Se puede negociar al alza o igualar el catálogo. Por debajo del precio
 * mayorista la línea se marca, se muestra el mayorista tachado y se bloquea
 * emitir/guardar. Si el precio es ≥ catálogo, ese aviso no aparece.
 *
 * ## Por qué el campo guarda texto y no el número
 *
 * Mientras se teclea "12." el valor no es un número válido, y si el estado fuera
 * numérico el punto desaparecería en cuanto se escribe. Se guarda lo tecleado y se
 * convierte al confirmar. Es la diferencia entre un campo que se deja escribir y
 * uno que pelea con los dedos.
 *
 * ## El importe no positivo se marca aquí, no solo al emitir
 *
 * Una línea en cero bloquea la emisión, y enterarse de eso al pulsar EMITIR con el
 * cliente delante sería tarde. Se ve en la línea que lo causa.
 */

export interface PropsDeLineaPedido {
  readonly linea: LineaDePedido
  /** Precio del catálogo. Si difiere del de la línea, se muestra tachado. */
  readonly precioDeCatalogo: Centimos | undefined
  readonly indice: number
  readonly onCambiarCantidad: (cantidad: number) => void
  readonly onCambiarPrecio: (precio: Centimos) => void
  readonly onQuitar: () => void
  /**
   * Return focus to search: tras confirmar cantidad/precio (blur/Enter), si el
   * foco no quedó en otro control de la misma línea, vuelve al buscador.
   */
  readonly onVolverAlBuscador?: () => void
  /** Barrido shimmer si el producto ya estaba y acaba de elegirse otra vez. */
  readonly resaltar?: boolean
  /** Se llama al terminar los 3 barridos (o de inmediato si hay reduced motion). */
  readonly onFinResalte?: () => void
  /** Tras agregar desde el combobox, el foco cae en cantidad. */
  readonly enfocarCantidad?: boolean
  readonly senal?: number
  /**
   * Aviso no bloqueante de cifra orientativa (0 o bajo umbral).
   * No impide emitir.
   */
  readonly avisoInventario?: string | null
}

/** Convierte lo tecleado a céntimos. Acepta coma o punto, como se escriba. */
function aCentimos(texto: string): Centimos | null {
  const limpio = texto.replace(/\s/g, '').replace(',', '.')
  if (limpio === '') return null
  const numero = Number(limpio)
  if (!Number.isFinite(numero)) return null
  return Math.round(numero * 100)
}

function aTexto(centimos: Centimos): string {
  return (centimos / 100).toFixed(2)
}

/**
 * Misma plantilla en cabecera y filas (evita desfase).
 * Móvil: columnas numéricas más estrechas + producto con minmax(0,1fr).
 */
const REJILLA_LINEA = [
  'grid grid-cols-[minmax(0,1fr)_2.75rem_3.5rem_3.5rem_2rem] gap-1 px-2',
  'sm:grid-cols-[minmax(0,1fr)_3.25rem_4.25rem_4.25rem_2rem] sm:gap-1.5 sm:px-3',
  'md:grid-cols-[minmax(0,1fr)_5rem_7rem_7rem_2.5rem] md:gap-2 md:px-4',
].join(' ')

/** Tres barridos; alineado con `--shimmer-dur` de `.t-shimmer`. */
const SHIMMER_MS = 700
const SHIMMER_BARRIDOS = 3
/** `--duration-media` si hay reduced motion (no se anima). */
const SHIMMER_REDUCIDO_MS = 280

export function LineaPedido({
  linea,
  precioDeCatalogo,
  indice,
  onCambiarCantidad,
  onCambiarPrecio,
  onQuitar,
  onVolverAlBuscador,
  resaltar = false,
  onFinResalte,
  enfocarCantidad = false,
  senal = 0,
  avisoInventario = null,
}: PropsDeLineaPedido) {
  const [precioTecleado, setPrecioTecleado] = useState(() =>
    aTexto(linea.precio),
  )
  const [cantidadTecleada, setCantidadTecleada] = useState(() =>
    String(linea.cantidad),
  )
  const editando = useRef(false)
  const fila = useRef<HTMLLIElement>(null)
  const finResalteHecho = useRef(false)
  const onFinResalteRef = useRef(onFinResalte)
  onFinResalteRef.current = onFinResalte

  function intentarVolverAlBuscador(relatedTarget: EventTarget | null): void {
    if (onVolverAlBuscador === undefined) return
    const destino = relatedTarget
    if (
      destino instanceof Node &&
      fila.current !== null &&
      fila.current.contains(destino)
    ) {
      // Tab entre cantidad ↔ precio (u otro control de la fila): no robar foco.
      return
    }
    // Tras blur/Enter el foco a veces cae en body un frame; entonces sí.
    requestAnimationFrame(() => {
      const activo = document.activeElement
      if (
        activo === null ||
        activo === document.body ||
        activo === document.documentElement
      ) {
        onVolverAlBuscador()
      }
    })
  }

  // Si la línea cambia por fuera —al restaurar el pedido, o al aprobar una
  // captura— el campo tiene que reflejarlo. Pero no mientras se está tecleando,
  // porque sobrescribir lo que el vendedor escribe a medias es intolerable.
  useEffect(() => {
    if (!editando.current) setPrecioTecleado(aTexto(linea.precio))
  }, [linea.precio])

  useEffect(() => {
    if (!editando.current) setCantidadTecleada(String(linea.cantidad))
  }, [linea.cantidad])

  useEffect(() => {
    finResalteHecho.current = false
    if (!resaltar) return
    fila.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    const reducido =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const espera = reducido
      ? SHIMMER_REDUCIDO_MS
      : SHIMMER_MS * SHIMMER_BARRIDOS
    const id = window.setTimeout(() => {
      if (finResalteHecho.current) return
      finResalteHecho.current = true
      onFinResalteRef.current?.()
    }, espera)
    return () => window.clearTimeout(id)
  }, [resaltar, senal])

  useEffect(() => {
    if (!enfocarCantidad) return
    const campo = fila.current?.querySelector<HTMLInputElement>(
      'input[aria-label^="Cantidad"]',
    )
    campo?.focus()
    campo?.select()
  }, [enfocarCantidad, senal])

  const importe = calcularImporte(linea)
  const emitible = lineaEsEmitible(linea)
  const precioEnEdicion = aCentimos(precioTecleado)
  const bajoPiso = precioEsMenorQueCatalogo(
    precioEnEdicion ?? linea.precio,
    precioDeCatalogo,
  )
  const lineaEnAviso = !emitible || bajoPiso

  function confirmarPrecio(): void {
    editando.current = false
    const centimos = aCentimos(precioTecleado)
    if (centimos === null) {
      setPrecioTecleado(aTexto(linea.precio))
      return
    }
    onCambiarPrecio(centimos)
  }

  function confirmarCantidad(): void {
    editando.current = false
    const numero = Number(cantidadTecleada.replace(',', '.'))
    if (!Number.isFinite(numero)) {
      setCantidadTecleada(String(linea.cantidad))
      return
    }
    onCambiarCantidad(numero)
  }

  return (
    <li
      ref={fila}
      className={[
        REJILLA_LINEA,
        'linea-pedido items-baseline border-b border-borde py-1.5',
        // El estado no se distingue solo por color: el campo se marca y abajo
        // se escribe el motivo.
        lineaEnAviso && 'bg-aviso/5',
        resaltar && 't-resalte-fila',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="min-w-0 overflow-hidden">
        <p
          className="truncate text-cuerpo uppercase text-tinta"
          title={`${linea.descripcion} · ${linea.codigo} · ${linea.unidad}`}
        >
          {resaltar ? (
            <span key={senal} className="t-shimmer">
              {linea.descripcion}
            </span>
          ) : (
            linea.descripcion
          )}
        </p>
        {/* En móvil el código compite con el nombre y desborda la grilla. */}
        <p className="hidden min-w-0 truncate font-mono text-etiqueta uppercase text-desvaida md:block">
          {resaltar ? (
            <span key={senal} className="t-shimmer">
              {linea.codigo} · {linea.unidad}
            </span>
          ) : (
            <>
              {linea.codigo} · {linea.unidad}
            </>
          )}
        </p>
        <p className="sr-only md:hidden">
          {linea.codigo} · {linea.unidad}
        </p>
        {!emitible && (
          <p className="font-mono text-etiqueta font-bold uppercase text-aviso">
            Cantidad o precio en cero: corrígelo para emitir
          </p>
        )}
        {emitible && bajoPiso && (
          <p className="font-mono text-etiqueta font-bold uppercase text-aviso">
            Bajo el mayorista ({formatearImporte(precioDeCatalogo ?? 0)})
          </p>
        )}
        <div
          className="grid transition-[grid-template-rows] duration-media ease-salida motion-reduce:transition-none"
          style={{
            gridTemplateRows:
              avisoInventario !== null && avisoInventario.length > 0
                ? '1fr'
                : '0fr',
          }}
        >
          <div className="min-h-0 overflow-hidden">
            {avisoInventario !== null && avisoInventario.length > 0 ? (
              <p className="font-mono text-etiqueta font-bold uppercase text-aviso">
                {avisoInventario}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <Campo
        aria-label={`Cantidad de ${linea.descripcion}`}
        value={cantidadTecleada}
        inputMode="decimal"
        variante="en-linea"
        numerico
        superficie="papel"
        onFocus={() => {
          editando.current = true
        }}
        onChange={(evento) => setCantidadTecleada(evento.target.value)}
        onBlur={(evento) => {
          confirmarCantidad()
          intentarVolverAlBuscador(evento.relatedTarget)
        }}
        onKeyDown={(evento) => {
          if (evento.key === 'Enter') evento.currentTarget.blur()
        }}
      />

      <div className="min-w-0">
        <Campo
          aria-label={`Precio de ${linea.descripcion}`}
          value={precioTecleado}
          inputMode="decimal"
          variante="en-linea"
          numerico
          superficie="papel"
          invalido={bajoPiso}
          onFocus={() => {
            editando.current = true
          }}
          onChange={(evento) => setPrecioTecleado(evento.target.value)}
          onBlur={(evento) => {
            confirmarPrecio()
            intentarVolverAlBuscador(evento.relatedTarget)
          }}
          onKeyDown={(evento) => {
            if (evento.key === 'Enter') evento.currentTarget.blur()
          }}
        />
        {bajoPiso && precioDeCatalogo !== undefined && (
          <p className="hidden px-1 text-right font-mono text-etiqueta text-desvaida md:block">
            <span className="line-through">
              {formatearImporte(precioDeCatalogo)}
            </span>{' '}
            catálogo
          </p>
        )}
      </div>

      <p className="min-w-0 truncate font-mono tabular-nums text-right text-cuerpo font-bold text-tinta">
        {formatearImporte(importe)}
      </p>

      <button
        type="button"
        // "Quitar", nunca "eliminar": la palabra está reservada y no debe
        // aparecer referida a un documento (FR-039). Aquí se quita una línea de un
        // pedido en curso, que es otra cosa, pero el vocabulario se mantiene
        // limpio en toda la aplicación para que la distinción no se erosione.
        aria-label={`Quitar ${linea.descripcion} del pedido`}
        onClick={onQuitar}
        className={[
          'flex min-h-11 items-center justify-center text-desvaida',
          'hover:text-aviso focus-visible:outline-none focus-visible:border-tinta',
        ].join(' ')}
      >
        <X className="size-5" aria-hidden />
      </button>

      <span className="sr-only">Línea {indice + 1}</span>
    </li>
  )
}

/**
 * Las cabeceras de columna. Existen incluso con el pedido vacío: es lo que hace
 * que la pantalla en blanco se lea como una hoja lista para escribir y no como un
 * error de carga, y por eso el estado vacío no necesita ilustración ni bienvenida.
 */
export function CabecerasDeColumna({
  numeroDeLineas = 0,
}: {
  readonly numeroDeLineas?: number
}) {
  return (
    <div
      className={[
        REJILLA_LINEA,
        'border-b border-borde pb-1',
        'font-mono text-etiqueta uppercase text-desvaida',
      ].join(' ')}
    >
      <span className="min-w-0 truncate">
        Producto
        {numeroDeLineas > 0 ? (
          <span className="ml-1 normal-case text-desvaida">
            ({numeroDeLineas})
          </span>
        ) : null}
      </span>
      <span className="min-w-0 text-right">Cant.</span>
      <span className="min-w-0 truncate text-right">
        <span className="md:hidden">P.U.</span>
        <span className="hidden md:inline">Precio</span>
      </span>
      <span className="min-w-0 truncate text-right">
        <span className="md:hidden">Imp.</span>
        <span className="hidden md:inline">Importe</span>
      </span>
      <span />
    </div>
  )
}
