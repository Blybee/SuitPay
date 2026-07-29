/**
 * Marca SuitPay: isotipo Soft-Pill reutilizable (sidebar expandido y colapsado).
 * No es texto abreviado: es un sello tipográfico dibujado.
 */

export function MarcaSuitPay({
  className = 'size-9',
  titulo = 'SuitPay',
}: {
  readonly className?: string
  readonly titulo?: string
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 40 40"
      role="img"
      aria-label={titulo}
    >
      <title>{titulo}</title>
      {/* Cápsula de marca */}
      <rect
        x="1"
        y="1"
        width="38"
        height="38"
        rx="12"
        fill="currentColor"
        className="text-tinta"
      />
      {/* Sello interno: trazo de comprobante + tilde de cobro */}
      <g
        fill="none"
        stroke="var(--color-papel)"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="11" y="10" width="18" height="20" rx="3.5" />
        <path d="M15 16.5h10" />
        <path d="M15 21h7" />
        <path d="M15 25.5h5" />
        <path d="M22.5 27.5 25 30l4.5-5.5" />
      </g>
    </svg>
  )
}
