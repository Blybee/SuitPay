import { FileText, Trash2, X } from 'lucide-react'
import { formatearImporte } from '../../domain/totales/calculo.ts'
import { Boton } from '../../ui/componentes/primitivas.tsx'
import type { DiferenciaDeCotizacion } from './diferencias.ts'
import type { Cotizacion } from './tipos.ts'

export function DetalleDeCotizacion({
  cotizacion,
  diferencias,
  onAbrirPedido,
  onEliminar,
  onPdf,
  onCerrar,
  compacto = false,
}: {
  readonly cotizacion: Cotizacion
  readonly diferencias: readonly DiferenciaDeCotizacion[]
  readonly onAbrirPedido: () => void
  readonly onEliminar: () => void
  readonly onPdf: () => void
  readonly onCerrar?: () => void
  readonly compacto?: boolean
}) {
  return (
    <article
      className={[
        'rounded-3xl border bg-papel p-5 shadow-sm',
        compacto ? 'border-sello' : 'border-borde',
      ].join(' ')}
    >
      <header className="mb-3 flex flex-nowrap items-center justify-between gap-2">
        <h3 className="min-w-0 truncate text-entrada font-bold text-tinta">
          {compacto
            ? `Coti ${cotizacion.numero}`
            : `Cotización ${cotizacion.numero}`}
        </h3>
        <div className="flex shrink-0 items-center gap-2">
          <Boton
            variante="principal"
            onClick={onAbrirPedido}
            aria-label="Abrir en el pedido"
          >
            {compacto ? 'Abrir' : 'Abrir en el pedido'}
          </Boton>
          <Boton
            variante="discreto"
            tamano="icono"
            aria-label={`Abrir PDF de la cotización ${cotizacion.numero}`}
            title="Abrir PDF"
            onClick={onPdf}
          >
            <FileText className="size-5" aria-hidden />
          </Boton>
          <Boton
            variante="discreto"
            tamano="icono"
            aria-label="Eliminar cotización"
            className="hover:border-aviso/40 hover:bg-aviso/10 hover:text-aviso"
            onClick={onEliminar}
          >
            <Trash2 className="size-5" aria-hidden />
          </Boton>
          {onCerrar !== undefined ? (
            <Boton
              variante="discreto"
              tamano="icono"
              aria-label="Cerrar cotización"
              onClick={onCerrar}
            >
              <X className="size-5" aria-hidden />
            </Boton>
          ) : null}
        </div>
      </header>

      {diferencias.length > 0 ? (
        <div
          className="mb-3 rounded-2xl border border-aviso px-3 py-2"
          role="status"
        >
          <p className="text-cuerpo font-bold text-aviso">
            Hay cambios respecto al catálogo actual
          </p>
          <ul className="mt-1 list-disc pl-5 text-cuerpo text-tinta">
            {diferencias.map((cada) => (
              <li key={`${cada.codigo}-${cada.indice}`}>
                {cada.clase === 'producto_desaparecido'
                  ? `${cada.descripcion} (${cada.codigo}) ya no está en el catálogo.`
                  : `${cada.descripcion}: precio guardado ${formatearImporte(cada.precioGuardado)}, actual ${formatearImporte(cada.precioActual ?? 0)}.`}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <ul className="mb-3">
        {cotizacion.lineas.map((linea, indice) => (
          <li
            key={`${linea.codigo}-${indice}`}
            className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-1 py-1 text-cuerpo text-tinta"
          >
            <span className="font-mono tabular-nums">{linea.cantidad}</span>
            <span className="min-w-0 break-words">{linea.descripcion}</span>
            <span className="font-mono tabular-nums">
              {formatearImporte(linea.precio)}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-right font-mono tabular-nums text-cuerpo font-bold text-tinta">
        {formatearImporte(cotizacion.total)}
      </p>
    </article>
  )
}
