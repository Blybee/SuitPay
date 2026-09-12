import type { CandidatoDeLinea } from './tipos.ts'

/**
 * Presenta opciones para una línea ambigua; no escoge por el vendedor (T123).
 */
export function OpcionesAmbiguas({
  candidatos,
  onElegir,
}: {
  readonly candidatos: readonly CandidatoDeLinea[]
  readonly onElegir: (codigo: string) => void
}) {
  if (candidatos.length === 0) {
    return (
      <p className="text-cuerpo text-desvaida">
        Sin candidatos. Corrige el texto o escribe el producto a mano.
      </p>
    )
  }

  return (
    <ul className="mt-2 flex flex-col gap-1.5" data-testid="opciones-ambiguas">
      {candidatos.map((c) => (
        <li key={c.codigo}>
          <button
            type="button"
            onClick={() => onElegir(c.codigo)}
            className={[
              'w-full rounded-2xl border border-borde bg-papel px-3 py-2.5 text-left',
              'transition-[color,background-color,border-color,box-shadow] duration-rapida ease-salida',
              'hover:border-tinta/40 hover:bg-mesa hover:shadow-sm',
              'focus-visible:outline-none focus-visible:border-tinta focus-visible:ring-2 focus-visible:ring-tinta/10',
              'motion-reduce:transition-none',
            ].join(' ')}
          >
            <span className="block text-cuerpo font-bold text-tinta">
              {c.descripcion}
            </span>
            <span className="mt-0.5 block font-mono text-etiqueta text-desvaida">
              {c.codigo} · ×{c.cantidad}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
