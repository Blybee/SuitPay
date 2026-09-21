import { FileText, Trash2, X } from 'lucide-react'
import { formatearImporte } from '../../domain/totales/calculo.ts'
import { Boton } from '../../ui/componentes/primitivas.tsx'
import type { Cotizacion } from './tipos.ts'

export function DetalleDeCotizacion({
  cotizacion,
  onAbrirPedido,
  onEliminar,
  onPdf,
  onCerrar,
  compacto = false,
}: {
  readonly cotizacion: Cotizacion
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
