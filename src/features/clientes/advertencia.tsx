/**
 * Advertencia visible de contribuyente no habido (FR-024).
 * No bloquea: la decisión queda al vendedor.
 */
export function AdvertenciaNoHabido({
  condicion,
}: {
  readonly condicion: string | undefined
}) {
  return (
    <p
      role="alert"
      className="rounded-2xl border border-aviso bg-papel px-4 py-3 text-cuerpo font-bold text-aviso"
    >
      El registro oficial señala a este contribuyente como no habido
      {condicion ? ` (${condicion})` : ''}. Puedes continuar si el vendedor lo
      decide.
    </p>
  )
}
