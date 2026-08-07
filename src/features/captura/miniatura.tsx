/**
 * Miniatura de la fotografía junto a la revisión (T134).
 */
export function MiniaturaCaptura({
  src,
  alt = 'Fotografía original de la guía',
}: {
  readonly src: string | null
  readonly alt?: string
}) {
  if (src === null) return null

  return (
    <a
      href={src}
      target="_blank"
      rel="noreferrer"
      className="block shrink-0 overflow-hidden rounded-lg border border-borde"
      data-testid="miniatura-captura"
    >
      <img
        src={src}
        alt={alt}
        className="h-28 w-24 object-cover object-top"
      />
    </a>
  )
}
