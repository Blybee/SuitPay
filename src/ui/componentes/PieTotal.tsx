import { formatearImporte } from '../../domain/totales/calculo.ts'
import type { Centimos } from '../../domain/totales/calculo.ts'
import { Selector } from './Selector.tsx'

/**
 * Pie del total. Anclado abajo, Soft-Pill, a todo el ancho del área de trabajo.
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
  readonly motivoDeBloqueo: string | null
  readonly onEmitir: () => void
  readonly onGuardarCotizacion?: () => void
  readonly guardandoCotizacion?: boolean
  readonly proveedorCaido?: boolean
  readonly sinRed?: boolean
}

const OPCIONES_PAGO = [
  { valor: 'efectivo', etiqueta: 'efectivo' },
  { valor: 'yape', etiqueta: 'yape' },
  { valor: 'plin', etiqueta: 'plin' },
  { valor: 'transferencia', etiqueta: 'transferencia' },
  { valor: 'tarjeta', etiqueta: 'tarjeta' },
] as const

export function PieTotal({
  total,
  numeroDeLineas,
  medioPago,
  onCambiarMedioPago,
  estado,
  motivoDeBloqueo,
  onEmitir,
  onGuardarCotizacion,
  guardandoCotizacion = false,
  proveedorCaido = false,
  sinRed = false,
}: PropsDePieTotal) {
  const bloqueado = estado === 'inhabilitado' || motivoDeBloqueo !== null
  const enVuelo = estado === 'emitiendo'
  const puedeGuardar =
    onGuardarCotizacion !== undefined &&
    numeroDeLineas > 0 &&
    !guardandoCotizacion &&
    !sinRed &&
    !enVuelo

  return (
    <div className="sticky bottom-0 z-20 w-full border-t border-borde bg-papel shadow-md">
      {motivoDeBloqueo !== null && (
        <p
          role="status"
          className="w-full border-b border-aviso px-4 py-1.5 text-cuerpo font-bold text-aviso"
        >
          {motivoDeBloqueo}
        </p>
      )}

      {proveedorCaido && motivoDeBloqueo === null && (
        <p
          role="status"
          className="w-full border-b border-aviso px-4 py-1.5 text-cuerpo text-aviso"
        >
          El servicio de emisión no responde. Puedes armar el pedido; al emitir,
          si sigue caído, te pedirá reintentar más tarde.
        </p>
      )}

      <div className="flex w-full flex-wrap items-center gap-4 px-4 py-3">
        <p className="font-mono text-etiqueta uppercase text-desvaida">
          {numeroDeLineas === 1 ? '1 línea' : `${numeroDeLineas} líneas`}
        </p>

        <Selector
          etiqueta="Pago"
          valor={medioPago}
          onCambiar={onCambiarMedioPago}
          opciones={OPCIONES_PAGO}
        />

        <div className="ml-auto flex items-baseline gap-3">
          <span className="font-mono text-etiqueta uppercase text-desvaida">
            Total
          </span>
          <output
            aria-label="Total del pedido"
            className="font-mono tabular-nums text-total font-bold leading-none text-tinta"
          >
            {formatearImporte(total)}
          </output>
        </div>

        {onGuardarCotizacion !== undefined ? (
          <button
            type="button"
            onClick={onGuardarCotizacion}
            disabled={!puedeGuardar}
            className={[
              'min-h-14 shrink-0 rounded-full border px-5 text-entrada font-bold',
              'focus-visible:outline-none focus-visible:border-tinta',
              'disabled:cursor-not-allowed disabled:border-borde disabled:bg-mesa disabled:text-desvaida',
              puedeGuardar
                ? 'border-borde bg-papel text-tinta hover:bg-mesa'
                : '',
            ].join(' ')}
          >
            {guardandoCotizacion ? 'Guardando…' : 'Guardar cotización'}
          </button>
        ) : null}

        <button
          type="button"
          onClick={onEmitir}
          disabled={bloqueado || enVuelo || estado === 'emitido'}
          aria-describedby={
            motivoDeBloqueo !== null ? 'motivo-de-bloqueo' : undefined
          }
          className={[
            'min-h-14 shrink-0 rounded-full px-8 text-entrada font-bold uppercase',
            'focus-visible:outline-none focus-visible:border-tinta',
            'disabled:cursor-not-allowed',
            bloqueado || enVuelo || estado === 'emitido'
              ? 'border border-borde bg-mesa text-desvaida'
              : 'border border-tinta bg-tinta text-papel hover:bg-tinta/90',
          ].join(' ')}
        >
          {enVuelo
            ? 'Emitiendo…'
            : estado === 'emitido'
              ? 'Emitido'
              : 'Emitir'}
        </button>
      </div>
    </div>
  )
}
