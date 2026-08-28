import { Children, type ReactNode } from 'react'
import { FileJson, FileText } from 'lucide-react'

/**
 * Callout Soft-Pill: no es una caja de info.
 * Aquí son papeletas de origen — el formato es el dato, el escritorio es el
 * nombre — para leerse dentro de una drop zone, no al lado.
 */

export function Nota({
  linea,
  children,
}: {
  readonly linea?: string
  readonly children?: ReactNode
}) {
  const destinos = Children.toArray(children)

  return (
    <aside role="note" className="flex w-full flex-col items-center gap-3">
      {linea !== undefined ? (
        <p className="text-center text-cuerpo text-desvaida">{linea}</p>
      ) : null}
      <ul className="flex flex-wrap items-stretch justify-center gap-2">
        {destinos.map((destino, indice) => (
          <li key={indice} className="flex items-center gap-2">
            {indice > 0 ? (
              <span
                className="font-mono text-etiqueta uppercase tracking-widest text-desvaida"
                aria-hidden
              >
                o
              </span>
            ) : null}
            {destino}
          </li>
        ))}
      </ul>
    </aside>
  )
}

export function DestinoDeNota({
  origen,
  formato,
}: {
  readonly origen: string
  readonly formato: 'JSON' | 'PDF'
}) {
  const Icono = formato === 'PDF' ? FileText : FileJson

  return (
    <div className="ficha-origen relative min-w-40 overflow-hidden rounded-2xl bg-papel px-4 py-3 shadow-sm">
      <span className="ficha-origen-pliegue" aria-hidden />
      <p className="flex items-center gap-2 font-mono text-etiqueta font-bold uppercase tracking-widest text-desvaida">
        <Icono className="size-3.5" strokeWidth={2.25} aria-hidden />
        {formato}
      </p>
      <p className="mt-1 text-cuerpo font-bold text-tinta">{origen}</p>
    </div>
  )
}
