import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import {
  calcularImporte,
  formatearImporte,
  lineaEsEmitible
  
  
} from '../../domain/totales/calculo.ts'
import type {Centimos, LineaDePedido} from '../../domain/totales/calculo.ts';

/**
 * Un renglón del pedido.
 *
 * ## El precio se edita en el sitio y sin validación
 *
 * FR-012, y es el requisito que más cuesta implementar bien porque el instinto de
 * cualquiera es poner un mínimo, un máximo o un aviso. No lleva ninguno, y la
 * razón es del negocio: en un mostrador mayorista **el precio se negocia**. Un
 * campo que discute con el vendedor mientras el cliente espera es un campo que se
 * acaba sorteando escribiendo el pedido en otro sitio.
 *
 * Lo que sí se hace es dejar **rastro visible**: cuando el precio difiere del de
 * catálogo, el de catálogo aparece tachado al lado. Sin validar nada, pero sin
 * ocultar nada tampoco. Quien mire el pedido ve que hubo una negociación.
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

export function LineaPedido({
  linea,
  precioDeCatalogo,
  indice,
  onCambiarCantidad,
  onCambiarPrecio,
  onQuitar,
}: PropsDeLineaPedido) {
  const [precioTecleado, setPrecioTecleado] = useState(() => aTexto(linea.precio))
  const [cantidadTecleada, setCantidadTecleada] = useState(() =>
    String(linea.cantidad),
  )
  const editando = useRef(false)

  // Si la línea cambia por fuera —al restaurar el pedido, o al aprobar una
  // captura— el campo tiene que reflejarlo. Pero no mientras se está tecleando,
  // porque sobrescribir lo que el vendedor escribe a medias es intolerable.
  useEffect(() => {
    if (!editando.current) setPrecioTecleado(aTexto(linea.precio))
  }, [linea.precio])

  useEffect(() => {
    if (!editando.current) setCantidadTecleada(String(linea.cantidad))
  }, [linea.cantidad])

  const importe = calcularImporte(linea)
  const emitible = lineaEsEmitible(linea)
  const precioAjustado =
    precioDeCatalogo !== undefined && precioDeCatalogo !== linea.precio

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
      className={[
        'grid grid-cols-[1fr_5rem_7rem_7rem_2.5rem] items-baseline gap-2',
        'border-b border-borde px-4 py-1.5',
        // El estado no se distingue solo por color: además del borde rojo, abajo
        // se escribe el motivo.
        !emitible && 'border-l-4 border-l-aviso bg-aviso/5',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="min-w-0">
        <p className="truncate text-cuerpo text-tinta" title={linea.descripcion}>
          {linea.descripcion}
        </p>
        <p className="font-mono text-etiqueta uppercase text-desvaida">
          {linea.codigo} · {linea.unidad}
        </p>
        {!emitible && (
          <p className="font-mono text-etiqueta font-bold uppercase text-aviso">
            Cantidad o precio en cero: corrígelo para emitir
          </p>
        )}
      </div>

      <input
        aria-label={`Cantidad de ${linea.descripcion}`}
        value={cantidadTecleada}
        inputMode="decimal"
        onFocus={() => {
          editando.current = true
        }}
        onChange={(evento) => setCantidadTecleada(evento.target.value)}
        onBlur={confirmarCantidad}
        onKeyDown={(evento) => {
          if (evento.key === 'Enter') evento.currentTarget.blur()
        }}
        className={[
          'min-h-11 w-full rounded-full border border-transparent bg-transparent px-2',
          'font-mono tabular-nums text-right text-cuerpo text-tinta',
          'hover:border-borde',
          'focus-visible:border-borde focus-visible:bg-mesa focus-visible:outline-none',
        ].join(' ')}
      />

      <div>
        <input
          aria-label={`Precio de ${linea.descripcion}`}
          value={precioTecleado}
          inputMode="decimal"
          onFocus={() => {
            editando.current = true
          }}
          onChange={(evento) => setPrecioTecleado(evento.target.value)}
          onBlur={confirmarPrecio}
          onKeyDown={(evento) => {
            if (evento.key === 'Enter') evento.currentTarget.blur()
          }}
          className={[
            'min-h-11 w-full rounded-full border border-transparent bg-transparent px-2',
            'font-mono tabular-nums text-right text-cuerpo text-tinta',
            'hover:border-borde',
            'focus-visible:border-borde focus-visible:bg-mesa focus-visible:outline-none',
          ].join(' ')}
        />
        {precioAjustado && (
          <p className="px-1 text-right font-mono text-etiqueta text-desvaida">
            <span className="line-through">
              {formatearImporte(precioDeCatalogo)}
            </span>{' '}
            catálogo
          </p>
        )}
      </div>

      <p className="font-mono tabular-nums text-right text-cuerpo font-bold text-tinta">
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
export function CabecerasDeColumna() {
  return (
    <div
      className={[
        'grid grid-cols-[1fr_5rem_7rem_7rem_2.5rem] gap-2',
        'border-b border-borde px-4 pb-1',
        'font-mono text-etiqueta uppercase text-desvaida',
      ].join(' ')}
    >
      <span>Producto</span>
      <span className="text-right">Cant.</span>
      <span className="text-right">Precio</span>
      <span className="text-right">Importe</span>
      <span />
    </div>
  )
}
