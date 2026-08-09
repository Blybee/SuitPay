import { Check, Info, X, XCircle } from 'lucide-react'
import {
  usarNotificaciones,
  type Notificacion,
  type TonoDeNotificacion,
} from '../../features/notificaciones/almacen.ts'

/**
 * Host de toasts tipo Dynamic Island / morphing pill (top-center).
 * Montar una sola vez en la raíz. API: `usarNotificaciones().mostrar(…)`.
 * Ver docs/UI-NOTIFICACIONES-Y-MIGAS.md.
 *
 * Posición `fixed` (no popover top-layer) para apilar en el centro superior
 * de forma fiable; el morph usa opacidad/escala + allow-discrete vía CSS.
 */

function iconoDe(tono: TonoDeNotificacion) {
  if (tono === 'exito') return Check
  if (tono === 'error') return XCircle
  return Info
}

function clasesDeTono(tono: TonoDeNotificacion): string {
  if (tono === 'exito') {
    return 'border-tinta/20 bg-tinta text-papel'
  }
  if (tono === 'error') {
    return 'border-aviso/40 bg-papel text-aviso shadow-md'
  }
  return 'border-borde bg-papel text-tinta shadow-md'
}

function Pastilla({
  notificacion,
  onCerrar,
}: {
  readonly notificacion: Notificacion
  readonly onCerrar: () => void
}) {
  const Icono = iconoDe(notificacion.tono)

  return (
    <div
      role={notificacion.tono === 'error' ? 'alert' : 'status'}
      aria-live={notificacion.tono === 'error' ? 'assertive' : 'polite'}
      className={[
        'notificacion-isla-pastilla',
        'pointer-events-auto flex max-w-[min(28rem,calc(100vw-2rem))] items-start gap-3',
        'rounded-full border px-4 py-3',
        clasesDeTono(notificacion.tono),
      ].join(' ')}
    >
      <Icono className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 pr-1">
        {notificacion.titulo !== undefined ? (
          <p className="truncate text-cuerpo font-bold">{notificacion.titulo}</p>
        ) : null}
        <p
          className={[
            'text-cuerpo',
            notificacion.titulo !== undefined ? 'opacity-90' : 'font-bold',
          ].join(' ')}
        >
          {notificacion.mensaje}
        </p>
      </div>
      <button
        type="button"
        aria-label="Cerrar notificación"
        onClick={onCerrar}
        className={[
          'flex size-8 shrink-0 items-center justify-center rounded-full',
          'focus-visible:outline-none focus-visible:border focus-visible:border-current',
          notificacion.tono === 'exito'
            ? 'hover:bg-papel/15'
            : 'hover:bg-mesa',
        ].join(' ')}
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  )
}

export function NotificacionIsla() {
  const activas = usarNotificaciones((s) => s.activas)
  const descartar = usarNotificaciones((s) => s.descartar)

  if (activas.length === 0) return null

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-3 z-[80] flex flex-col items-center gap-2 px-4"
      aria-label="Notificaciones"
    >
      {activas.map((cada) => (
        <Pastilla
          key={cada.id}
          notificacion={cada}
          onCerrar={() => descartar(cada.id)}
        />
      ))}
    </div>
  )
}
