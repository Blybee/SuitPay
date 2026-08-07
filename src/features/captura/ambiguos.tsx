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
      <p className="text-cuerpo text-aviso">
        Sin candidatos. Corrige el texto o escribe el producto a mano.
      </p>
    )
  }

  return (
    <ul className="mt-1 flex flex-col gap-1" data-testid="opciones-ambiguas">
      {candidatos.map((c) => (
        <li key={c.codigo}>
          <button
            type="button"
            onClick={() => onElegir(c.codigo)}
            className={[
              'w-full rounded-lg border border-aviso/60 bg-aviso/10 px-3 py-2',
              'text-left text-cuerpo text-aviso',
              'hover:bg-aviso/20 focus-visible:outline-none focus-visible:border-aviso',
            ].join(' ')}
          >
            <span className="font-bold">{c.descripcion}</span>
            <span className="ml-2 font-mono text-etiqueta opacity-80">
              {c.codigo} · ×{c.cantidad}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
