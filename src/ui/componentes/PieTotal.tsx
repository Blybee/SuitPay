import { formatearImporte  } from '../../domain/totales/calculo.ts'
import type {Centimos} from '../../domain/totales/calculo.ts';

/**
 * El pie del total. Anclado abajo, a todo el ancho.
 *
 * ## Por qué el motivo se dice y no se insinúa
 *
 * Un botón inhabilitado sin explicación es la peor forma de bloquear una acción:
 * el vendedor pulsa, no pasa nada, vuelve a pulsar, y acaba pensando que el
 * sistema está roto mientras el cliente espera. Aquí el motivo va escrito en rojo
 * debajo, siempre, y dice **qué falta y a quién pedírselo** cuando corresponde.
 *
 * ## El aviso llega antes de pulsar, no después
 *
 * Cuando el proveedor está caído, la etiqueta del botón cambia: dice que emitir
 * dejará la venta en espera y producirá un documento interno. Enterarse de eso
 * después de pulsar sería enterarse cuando ya hay que explicárselo al cliente.
 *
 * ## Por qué basta un botón que se deshabilita
 *
 * Se consideró un gesto elaborado —arrastrar contra resistencia— para evitar la
 * doble emisión. Se descartó: contra años de operación real, ese fallo no ocurre
 * con un botón que se deshabilita al pulsarse, y el vendedor quiere velocidad en
 * la operación que repite cien veces al día. El riesgo que sí existe es que la
 * petición llegue y la respuesta se pierda, y de eso no puede ocuparse ninguna
 * interfaz: se ocupa la clave de idempotencia, que es invisible y gratis.
 *
 * Hay además una protección que salió de balde: con la entrada arriba y el botón
 * abajo, los separa toda la altura de la pantalla.
 */

export type EstadoDeEmision =
  | 'listo'
  | 'emitiendo'
  | 'emitido'
  | 'inhabilitado'

export interface PropsDePieTotal {
  readonly total: Centimos
  readonly numeroDeLineas: number
  readonly medioPago: string
  readonly onCambiarMedioPago: (medio: string) => void
  readonly estado: EstadoDeEmision
  /** Por qué no se puede emitir. Se muestra tal cual, en rojo. */
  readonly motivoDeBloqueo: string | null
  readonly onEmitir: () => void
  /** Cuando el proveedor no responde, emitir deja la venta en espera. */
  readonly proveedorCaido?: boolean
}

const MEDIOS = ['efectivo', 'yape', 'plin', 'transferencia', 'tarjeta'] as const

export function PieTotal({
  total,
  numeroDeLineas,
  medioPago,
  onCambiarMedioPago,
  estado,
  motivoDeBloqueo,
  onEmitir,
  proveedorCaido = false,
}: PropsDePieTotal) {
  const bloqueado = estado === 'inhabilitado' || motivoDeBloqueo !== null
  const enVuelo = estado === 'emitiendo'

  return (
    <div className="sticky bottom-0 z-20 w-full border-t-2 border-tinta bg-mesa">
      {motivoDeBloqueo !== null && (
        <p
          role="status"
          className="mx-auto w-full max-w-5xl border-b border-aviso px-3 py-1.5 text-cuerpo font-bold text-aviso"
        >
          {motivoDeBloqueo}
        </p>
      )}

      {proveedorCaido && motivoDeBloqueo === null && (
        <p
          role="status"
          className="mx-auto w-full max-w-5xl border-b border-aviso px-3 py-1.5 text-cuerpo text-aviso"
        >
          El servicio de emisión no responde. Al emitir, la venta queda en espera
          y se imprime un documento interno para el cliente.
        </p>
      )}

      <div className="mx-auto flex w-full max-w-5xl items-center gap-4 px-3 py-3">
        <p className="font-mono text-etiqueta uppercase text-desvaida">
          {numeroDeLineas === 1 ? '1 línea' : `${numeroDeLineas} líneas`}
        </p>

        <label className="flex items-center gap-2">
          <span className="font-mono text-etiqueta uppercase text-desvaida">
            Pago
          </span>
          <select
            value={medioPago}
            onChange={(evento) => onCambiarMedioPago(evento.target.value)}
            className={[
              'min-h-11 border-2 border-tinta bg-papel px-2 text-cuerpo text-tinta',
              'focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-tinta',
            ].join(' ')}
          >
            {MEDIOS.map((medio) => (
              <option key={medio} value={medio}>
                {medio}
              </option>
            ))}
          </select>
        </label>

        <div className="ml-auto flex items-baseline gap-3">
          <span className="font-mono text-etiqueta uppercase text-desvaida">
            Total
          </span>
          {/* La cifra más grande de la pantalla. Se comprueba sin buscarla. */}
          <output
            aria-label="Total del pedido"
            className="font-mono tabular-nums text-total font-bold leading-none text-tinta"
          >
            {formatearImporte(total)}
          </output>
        </div>

        <button
          type="button"
          onClick={onEmitir}
          // Se deshabilita en el instante de la pulsación. `enVuelo` lo pone el
          // manejador antes de cualquier espera, así que la segunda pulsación de
          // un doble clic ya encuentra el botón inerte.
          disabled={bloqueado || enVuelo || estado === 'emitido'}
          aria-describedby={
            motivoDeBloqueo !== null ? 'motivo-de-bloqueo' : undefined
          }
          className={[
            'min-h-14 shrink-0 border-2 px-8 text-entrada font-bold uppercase',
            'focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-tinta',
            'disabled:cursor-not-allowed',
            bloqueado || enVuelo || estado === 'emitido'
              ? 'border-desvaida bg-mesa text-desvaida'
              : 'border-tinta bg-tinta text-papel hover:bg-tinta/90',
          ].join(' ')}
        >
          {enVuelo
            ? 'Emitiendo…'
            : estado === 'emitido'
              ? 'Emitido'
              : proveedorCaido
                ? 'Emitir en espera'
                : 'Emitir'}
        </button>
      </div>
    </div>
  )
}
