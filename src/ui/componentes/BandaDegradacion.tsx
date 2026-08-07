import { AlertTriangle } from 'lucide-react'
import type { Degradacion } from '../../features/degradacion/estado.ts'

/**
 * La banda de degradación.
 *
 * Tres propiedades que no son estéticas:
 *
 * **Persiste hasta que la causa se resuelve.** No es una notificación que se
 * desvanece, y FR-051 lo exige. La razón está en la escena: un local ruidoso con
 * un vendedor de pie que aparta la vista a cada rato para sacar mercadería. Un
 * aviso de cuatro segundos es un aviso que nadie ve, y perderse que el proveedor
 * está caído significa cobrar una venta creyendo que se emitió.
 *
 * **No se descarta a ciegas.** No hay "cerrar" genérico: ocultar el aviso no
 * arregla la causa. Para asistencia (fallos transitorios del modelo o del
 * servidor de dev) sí hay **Reintentar**, porque si no los botones quedan
 * inertes para siempre aunque el servicio ya haya vuelto.
 *
 * **Dice también qué sí funciona.** Un aviso que solo enumera lo perdido invita a
 * parar. La degradación más frecuente será la de la asistencia, y con ella se
 * puede vender con total normalidad escribiendo; si el vendedor no lo sabe, se
 * detiene sin motivo.
 */
export function BandaDegradacion({
  degradacion,
  onReintentarAsistencia,
}: {
  readonly degradacion: Degradacion | null
  readonly onReintentarAsistencia?: () => void
}) {
  if (degradacion === null) return null

  const puedeReintentar =
    degradacion.causa === 'asistencia' && onReintentarAsistencia != null

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex w-full items-start gap-3 border-b border-aviso bg-papel px-4 py-2 text-aviso"
    >
      <AlertTriangle className="mt-0.5 size-6 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-aviso font-bold">{degradacion.capacidadPerdida}</p>
        <p className="text-cuerpo text-tinta">{degradacion.loQueSiFunciona}</p>
      </div>
      {puedeReintentar ? (
        <button
          type="button"
          className="shrink-0 self-center rounded border border-aviso px-3 py-1.5 text-cuerpo font-bold text-aviso hover:bg-aviso/10"
          onClick={onReintentarAsistencia}
        >
          Reintentar
        </button>
      ) : null}
    </div>
  )
}
