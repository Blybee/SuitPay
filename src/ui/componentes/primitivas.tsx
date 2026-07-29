import { Slot } from '@radix-ui/react-slot'
import * as RadixLabel from '@radix-ui/react-label'
import * as RadixCheckbox from '@radix-ui/react-checkbox'
import * as RadixSeparator from '@radix-ui/react-separator'
import { Check } from 'lucide-react'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'

/**
 * Las primitivas del sistema de diseño.
 *
 * Radio cero y sin sombra en todo, salvo en las superposiciones reales. Esas dos
 * reglas no dependen de la disciplina de quien escriba aquí: los espacios de
 * nombres `--radius-*` y `--shadow-*` de Tailwind están vaciados en
 * `src/ui/tokens/tema.css`, así que `rounded-lg` y `shadow-md` **no existen**
 * como clases. La única sombra disponible es la de la papeleta.
 *
 * Sobre los tamaños: todo lo que se pulsa mide al menos 44 píxeles de alto. No es
 * el mínimo recomendado por cumplir, es la escena: un vendedor de pie, con prisa,
 * y a veces con la mano ocupada.
 */

function unir(...clases: readonly (string | false | undefined)[]): string {
  return clases.filter((cada) => typeof cada === 'string').join(' ')
}

// --- Botón ------------------------------------------------------------------

type VarianteDeBoton = 'principal' | 'secundario' | 'peligro' | 'discreto'

const ESTILOS_DE_BOTON: Record<VarianteDeBoton, string> = {
  // El compromiso. Tinta plena sobre papel: es lo más contrastado que hay.
  principal:
    'bg-tinta text-papel border-2 border-tinta hover:bg-tinta/90 disabled:bg-desvaida disabled:border-desvaida',
  secundario:
    'bg-papel text-tinta border-2 border-tinta hover:bg-mesa disabled:text-desvaida disabled:border-desvaida',
  // Rojo de aviso: dice que algo no es definitivo o está mal. Anular vive aquí.
  peligro:
    'bg-papel text-aviso border-2 border-aviso hover:bg-aviso hover:text-papel disabled:text-desvaida disabled:border-desvaida',
  discreto:
    'bg-transparent text-desvaida border-2 border-transparent hover:text-tinta hover:border-desvaida',
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
        'inline-flex min-h-11 items-center justify-center gap-2 px-4 font-bold',
        'transition-colors',
        // El foco tiene que verse a distancia y de pie.
        'focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-tinta',
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
        'min-h-11 w-full border-2 bg-papel px-3 text-tinta',
        'placeholder:text-desvaida',
        'focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-tinta',
        // Todo número comparable en cifras tabulares y a la derecha. Un importe
        // que baila entre filas obliga a leerlo en lugar de verlo.
        numerico && 'font-mono tabular-nums text-right',
        invalido ? 'border-aviso' : 'border-tinta',
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
        'flex size-6 shrink-0 items-center justify-center border-2 border-tinta bg-papel',
        'focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-tinta',
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

/**
 * Las secciones se separan con reglas finas en tinta desvaída y no con espacio
 * en blanco generoso: la densidad es una virtud cuando hay que ver catorce
 * líneas a la vez.
 */
export function Regla({
  className,
  ...resto
}: ComponentPropsWithoutRef<typeof RadixSeparator.Root>) {
  return (
    <RadixSeparator.Root
      className={unir(
        'shrink-0 bg-desvaida data-[orientation=horizontal]:h-px data-[orientation=vertical]:w-px',
        className,
      )}
      {...resto}
    />
  )
}

// --- Etiqueta de estado en texto -------------------------------------------

/**
 * Ningún estado se distingue solo por color: hay vendedores con la vista cansada
 * y una parte nada pequeña de los hombres no distingue rojo de verde. Esta
 * etiqueta es la segunda señal que acompaña al color.
 */
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
    aviso: 'border-aviso text-aviso',
    sello: 'border-sello text-sello',
    desvaida: 'border-desvaida text-desvaida',
  } as const

  return (
    <span
      className={unir(
        'inline-block border-2 px-2 py-0.5 font-mono text-etiqueta font-bold uppercase',
        tonos[tono],
        className,
      )}
    >
      {children}
    </span>
  )
}
