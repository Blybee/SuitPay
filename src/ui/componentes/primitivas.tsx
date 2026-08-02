import { Slot } from '@radix-ui/react-slot'
import * as RadixLabel from '@radix-ui/react-label'
import * as RadixCheckbox from '@radix-ui/react-checkbox'
import * as RadixSeparator from '@radix-ui/react-separator'
import { Check } from 'lucide-react'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'

/**
 * Primitivas Soft-Pill: cápsulas en controles, bordes sutiles, sin brutalismo.
 * Objetivos ≥ 44px de alto (vendedor de pie).
 */

function unir(...clases: readonly (string | false | undefined)[]): string {
  return clases.filter((cada) => typeof cada === 'string').join(' ')
}

// --- Botón ------------------------------------------------------------------

type VarianteDeBoton = 'principal' | 'secundario' | 'peligro' | 'discreto'

const ESTILOS_DE_BOTON: Record<VarianteDeBoton, string> = {
  principal:
    'rounded-full bg-tinta text-papel border border-tinta hover:bg-tinta/90 disabled:bg-desvaida disabled:border-desvaida',
  secundario:
    'rounded-full bg-papel text-tinta border border-borde hover:bg-mesa disabled:text-desvaida disabled:border-desvaida',
  peligro:
    'rounded-full bg-papel text-aviso border border-aviso hover:bg-aviso hover:text-papel disabled:text-desvaida disabled:border-desvaida',
  discreto:
    'rounded-full bg-transparent text-desvaida border border-transparent hover:text-tinta hover:border-borde',
}

export interface PropsDeBoton extends ComponentPropsWithoutRef<'button'> {
  readonly variante?: VarianteDeBoton
  readonly asChild?: boolean
}

export function Boton({
  variante = 'secundario',
  asChild = false,
  className,
  type = 'button',
  ...resto
}: PropsDeBoton) {
  const Componente = asChild ? Slot : 'button'
  return (
    <Componente
      type={type}
      className={unir(
        'inline-flex min-h-11 items-center justify-center gap-2 px-5 font-bold',
        'transition-colors',
        'focus-visible:outline-none focus-visible:border-tinta',
        'disabled:cursor-not-allowed',
        ESTILOS_DE_BOTON[variante],
        className,
      )}
      {...resto}
    />
  )
}

// --- Campo ------------------------------------------------------------------

export interface PropsDeCampo extends ComponentPropsWithoutRef<'input'> {
  readonly invalido?: boolean
  readonly numerico?: boolean
}

export function Campo({
  className,
  invalido = false,
  numerico = false,
  ...resto
}: PropsDeCampo) {
  return (
    <input
      aria-invalid={invalido || undefined}
      className={unir(
        'min-h-11 w-full rounded-full border bg-papel px-4 text-tinta',
        'placeholder:text-desvaida',
        'focus-visible:outline-none focus-visible:border-tinta',
        numerico && 'font-mono tabular-nums text-right',
        invalido ? 'border-aviso' : 'border-borde',
        className,
      )}
      {...resto}
    />
  )
}

// --- Etiqueta ---------------------------------------------------------------

export function Etiqueta({
  className,
  ...resto
}: ComponentPropsWithoutRef<typeof RadixLabel.Root>) {
  return (
    <RadixLabel.Root
      className={unir(
        'block font-mono text-etiqueta uppercase text-desvaida',
        className,
      )}
      {...resto}
    />
  )
}

// --- Casilla ----------------------------------------------------------------

export function Casilla({
  className,
  ...resto
}: ComponentPropsWithoutRef<typeof RadixCheckbox.Root>) {
  return (
    <RadixCheckbox.Root
      className={unir(
        'flex size-6 shrink-0 items-center justify-center rounded-full border border-borde bg-papel',
        'focus-visible:outline-none focus-visible:border-tinta',
        className,
      )}
      {...resto}
    >
      <RadixCheckbox.Indicator>
        <Check className="size-5 text-tinta" strokeWidth={3} aria-hidden />
      </RadixCheckbox.Indicator>
    </RadixCheckbox.Root>
  )
}

// --- Regla separadora -------------------------------------------------------

export function Regla({
  className,
  ...resto
}: ComponentPropsWithoutRef<typeof RadixSeparator.Root>) {
  return (
    <RadixSeparator.Root
      className={unir(
        'shrink-0 bg-borde data-[orientation=horizontal]:h-px data-[orientation=vertical]:w-px',
        className,
      )}
      {...resto}
    />
  )
}

// --- Distintivo (badge cápsula) ---------------------------------------------

export function Distintivo({
  children,
  tono = 'aviso',
  className,
}: {
  readonly children: ReactNode
  readonly tono?: 'aviso' | 'sello' | 'desvaida'
  readonly className?: string
}) {
  const tonos = {
    aviso: 'border-aviso text-aviso bg-papel',
    sello: 'border-sello text-sello bg-papel',
    desvaida: 'border-borde text-desvaida bg-mesa',
  } as const

  return (
    <span
      className={unir(
        'inline-block rounded-full border px-3 py-0.5 font-mono text-etiqueta font-bold uppercase',
        tonos[tono],
        className,
      )}
    >
      {children}
    </span>
  )
}
