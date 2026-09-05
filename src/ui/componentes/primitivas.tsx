import { Slot } from '@radix-ui/react-slot'
import * as RadixLabel from '@radix-ui/react-label'
import * as RadixCheckbox from '@radix-ui/react-checkbox'
import * as RadixSeparator from '@radix-ui/react-separator'
import { Check } from 'lucide-react'
import {
  useLayoutEffect,
  useRef,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from 'react'

/**
 * Primitivas Soft-Pill: cápsulas en controles, bordes sutiles, sin brutalismo.
 * Objetivos ≥ 44px de alto (vendedor de pie).
 */

function unir(...clases: readonly (string | false | undefined)[]): string {
  return clases.filter((cada) => typeof cada === 'string').join(' ')
}

// --- Botón ------------------------------------------------------------------

export type VarianteDeBoton =
  'principal' | 'secundario' | 'peligro' | 'discreto'
export type TamanoDeBoton = 'normal' | 'grande'

const ESTILOS_DE_BOTON: Record<VarianteDeBoton, string> = {
  principal:
    'border-tinta bg-tinta text-papel shadow-sm hover:bg-tinta/90 hover:shadow-md disabled:border-borde disabled:bg-borde disabled:text-desvaida',
  secundario:
    'border-borde bg-papel text-tinta shadow-sm hover:border-tinta/40 hover:bg-mesa hover:shadow-md disabled:bg-mesa disabled:text-desvaida',
  peligro:
    'border-aviso bg-papel text-aviso shadow-sm hover:bg-aviso hover:text-papel hover:shadow-md disabled:border-borde disabled:bg-mesa disabled:text-desvaida',
  discreto:
    'border-borde bg-papel text-desvaida shadow-sm hover:border-tinta/40 hover:bg-mesa hover:text-tinta hover:shadow-md disabled:bg-mesa',
}

export interface PropsDeBoton extends ComponentPropsWithoutRef<'button'> {
  readonly variante?: VarianteDeBoton
  readonly tamano?: TamanoDeBoton
  readonly asChild?: boolean
}

export function Boton({
  variante = 'secundario',
  tamano = 'normal',
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
        'inline-flex items-center justify-center gap-2 rounded-full border font-bold',
        'transition-[color,background-color,border-color,box-shadow,transform] duration-rapida ease-salida',
        'hover:-translate-y-0.5 active:translate-y-px active:shadow-none',
        'focus-visible:outline-none focus-visible:border-tinta focus-visible:ring-2 focus-visible:ring-tinta/10',
        'disabled:cursor-not-allowed disabled:opacity-70 disabled:shadow-none disabled:hover:translate-y-0 disabled:active:translate-y-0',
        'motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:translate-y-0',
        tamano === 'grande'
          ? 'min-h-11 px-4 text-cuerpo md:min-h-14 md:px-8 md:text-entrada'
          : 'min-h-11 px-5',
        ESTILOS_DE_BOTON[variante],
        className,
      )}
      {...resto}
    />
  )
}

// --- Campo ------------------------------------------------------------------

export type VarianteDeCampo = 'formulario' | 'en-linea'
export type AlineacionDeCampo = 'izquierda' | 'centro' | 'derecha'

export interface PropsDeCampo extends ComponentPropsWithoutRef<'input'> {
  readonly invalido?: boolean
  readonly numerico?: boolean
  readonly variante?: VarianteDeCampo
  readonly alineacion?: AlineacionDeCampo
  readonly superficie?: 'mesa' | 'papel'
}

export interface PropsDeCampoArea
  extends ComponentPropsWithoutRef<'textarea'> {
  readonly invalido?: boolean
  readonly variante?: VarianteDeCampo
  readonly superficie?: 'mesa' | 'papel'
}

function clasesDeCampo({
  className,
  invalido,
  numerico,
  variante,
  alineacion,
  superficie,
}: {
  readonly className?: string
  readonly invalido: boolean
  readonly numerico: boolean
  readonly variante: VarianteDeCampo
  readonly alineacion?: AlineacionDeCampo
  readonly superficie: 'mesa' | 'papel'
}): string {
  const alineacionResuelta = alineacion ?? (numerico ? 'derecha' : 'izquierda')
  return unir(
    'min-h-11 w-full border text-tinta',
    'transition-[color,background-color,border-color,box-shadow] duration-rapida ease-salida',
    'placeholder:text-desvaida',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tinta/10',
    'disabled:cursor-not-allowed disabled:bg-mesa disabled:text-desvaida',
    'motion-reduce:transition-none',
    variante === 'en-linea'
      ? 'rounded-xl px-2 md:px-3'
      : 'rounded-full px-4 shadow-sm',
    variante === 'en-linea'
      ? invalido
        ? 'border-aviso bg-aviso/5 text-aviso focus-visible:border-aviso focus-visible:ring-aviso/10'
        : superficie === 'papel'
          ? 'border-transparent bg-papel shadow-sm hover:border-borde focus-visible:border-tinta focus-visible:shadow-md'
          : 'border-transparent bg-mesa hover:border-borde hover:bg-papel focus-visible:border-tinta focus-visible:bg-papel focus-visible:shadow-sm'
      : invalido
        ? 'border-aviso bg-papel focus-visible:border-aviso focus-visible:ring-aviso/10'
        : 'border-borde bg-papel hover:border-tinta/40 focus-visible:border-tinta',
    numerico && 'font-mono tabular-nums',
    alineacionResuelta === 'centro' && 'text-center',
    alineacionResuelta === 'derecha' && 'text-right',
    className,
  )
}

export function Campo({
  className,
  invalido = false,
  numerico = false,
  variante = 'formulario',
  alineacion,
  superficie = 'mesa',
  ...resto
}: PropsDeCampo) {
  return (
    <input
      aria-invalid={invalido || undefined}
      className={clasesDeCampo({
        className,
        invalido,
        numerico,
        variante,
        alineacion,
        superficie,
      })}
      {...resto}
    />
  )
}

/** Texto largo en grilla: envuelve y crece. Un `<input>` no puede partir líneas. */
export function CampoArea({
  className,
  invalido = false,
  variante = 'formulario',
  superficie = 'mesa',
  value,
  onChange,
  ...resto
}: PropsDeCampoArea) {
  const area = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const el = area.current
    if (el === null) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(el.scrollHeight, 44)}px`
  }, [value])

  return (
    <textarea
      {...resto}
      ref={area}
      aria-invalid={invalido || undefined}
      rows={1}
      value={value}
      className={unir(
        clasesDeCampo({
          className,
          invalido,
          numerico: false,
          variante,
          superficie,
        }),
        'resize-none overflow-hidden py-2 leading-snug break-words whitespace-pre-wrap',
      )}
      onChange={(evento) => {
        const el = evento.currentTarget
        el.style.height = 'auto'
        el.style.height = `${Math.max(el.scrollHeight, 44)}px`
        onChange?.(evento)
      }}
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
