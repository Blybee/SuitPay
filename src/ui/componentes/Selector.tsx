import * as RadixSelect from '@radix-ui/react-select'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import { useId } from 'react'

/**
 * Select personalizado Soft-Pill sobre Radix Select.
 * El trigger, el listbox, el foco y la navegación por teclado pertenecen al
 * sistema UI: ningún navegador abre el picker visual del sistema operativo.
 */

export interface OpcionDeSelector<T extends string = string> {
  readonly valor: T
  readonly etiqueta: string
  readonly deshabilitada?: boolean
}

export type VarianteDeSelector = 'campo' | 'compacto' | 'miga'

export interface PropsDeSelector<T extends string = string> {
  readonly valor: T
  readonly onCambiar: (valor: T) => void
  readonly opciones: readonly OpcionDeSelector<T>[]
  readonly etiqueta: string
  readonly ocultarEtiqueta?: boolean
  readonly disposicion?: 'fila' | 'columna'
  readonly variante?: VarianteDeSelector
  readonly id?: string
  readonly className?: string
  readonly contenedorClassName?: string
  readonly disabled?: boolean
  readonly required?: boolean
  readonly name?: string
  readonly 'aria-describedby'?: string
  readonly 'aria-invalid'?: boolean
  readonly 'aria-current'?: 'page'
}

function unir(...clases: readonly (string | false | undefined)[]): string {
  return clases.filter((cada) => typeof cada === 'string').join(' ')
}

const VALOR_VACIO = '__suitpay_selector_vacio__'

const ESTILOS_TRIGGER: Record<VarianteDeSelector, string> = {
  campo:
    'min-h-11 min-w-40 w-full border-borde bg-papel px-4 text-cuerpo shadow-sm hover:border-tinta/40',
  compacto:
    'min-h-11 min-w-0 w-full border-borde bg-papel px-3 text-cuerpo shadow-sm hover:border-tinta/40 md:w-auto md:min-w-40',
  miga: 'min-h-8 w-auto max-w-full border-transparent bg-transparent px-2 py-1 font-bold hover:border-borde hover:bg-papel',
}

export function Selector<T extends string>({
  valor,
  onCambiar,
  opciones,
  etiqueta,
  ocultarEtiqueta = false,
  disposicion = 'fila',
  variante = 'campo',
  id,
  className,
  contenedorClassName,
  disabled,
  required,
  name,
  'aria-describedby': ariaDescribedby,
  'aria-invalid': ariaInvalid,
  'aria-current': ariaCurrent,
}: PropsDeSelector<T>) {
  const generado = useId()
  const idCampo = id ?? generado
  const valorRadix = valor.length === 0 ? VALOR_VACIO : valor

  return (
    <div
      className={unir(
        'flex min-w-0 gap-1',
        disposicion === 'columna' ? 'flex-col' : 'items-center gap-2',
        contenedorClassName,
      )}
    >
      {ocultarEtiqueta ? null : (
        <label
          htmlFor={idCampo}
          className="shrink-0 font-mono text-etiqueta uppercase text-desvaida"
        >
          {etiqueta}
        </label>
      )}
      <RadixSelect.Root
        value={valorRadix}
        disabled={disabled}
        required={required}
        onValueChange={(siguiente) =>
          onCambiar((siguiente === VALOR_VACIO ? '' : siguiente) as T)
        }
      >
        <RadixSelect.Trigger
          id={idCampo}
          value={valor}
          aria-label={ocultarEtiqueta ? etiqueta : undefined}
          aria-describedby={ariaDescribedby}
          aria-invalid={ariaInvalid}
          aria-current={ariaCurrent}
          className={unir(
            'group inline-flex min-w-0 items-center justify-between gap-3 rounded-full border text-left text-tinta',
            'transition-[color,background-color,border-color,box-shadow,transform] duration-rapida ease-salida',
            'focus-visible:border-tinta focus-visible:ring-2 focus-visible:ring-tinta/10',
            'data-[state=open]:border-tinta data-[state=open]:shadow-md active:translate-y-px',
            'disabled:cursor-not-allowed disabled:border-borde disabled:bg-mesa disabled:text-desvaida disabled:shadow-none disabled:active:translate-y-0',
            'motion-reduce:transition-none motion-reduce:active:translate-y-0',
            ESTILOS_TRIGGER[variante],
            className,
          )}
        >
          <RadixSelect.Value />
          <RadixSelect.Icon asChild>
            <ChevronDown
              className="size-4 shrink-0 text-desvaida transition-transform duration-rapida ease-salida group-data-[state=open]:rotate-180 motion-reduce:transition-none"
              strokeWidth={2.25}
              aria-hidden
            />
          </RadixSelect.Icon>
        </RadixSelect.Trigger>

        <RadixSelect.Portal>
          <RadixSelect.Content
            position="popper"
            sideOffset={8}
            collisionPadding={12}
            className="selector-suitpay-contenido z-50 max-h-[var(--radix-select-content-available-height)] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-2xl border border-borde bg-papel text-cuerpo text-tinta shadow-md"
          >
            <RadixSelect.ScrollUpButton className="flex h-7 cursor-default items-center justify-center bg-papel text-desvaida">
              <ChevronUp className="size-4" aria-hidden />
            </RadixSelect.ScrollUpButton>
            <RadixSelect.Viewport className="p-1">
              {opciones.map((opcion) => {
                const valorOpcion =
                  opcion.valor.length === 0 ? VALOR_VACIO : opcion.valor
                return (
                  <RadixSelect.Item
                    key={valorOpcion}
                    value={valorOpcion}
                    disabled={opcion.deshabilitada}
                    className={unir(
                      'relative flex min-h-10 cursor-default select-none items-center rounded-xl py-2 pr-9 pl-3 outline-none',
                      'data-[highlighted]:bg-mesa data-[highlighted]:text-tinta',
                      'data-[state=checked]:bg-tinta data-[state=checked]:font-bold data-[state=checked]:text-papel',
                      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
                    )}
                  >
                    <RadixSelect.ItemText>
                      {opcion.etiqueta}
                    </RadixSelect.ItemText>
                    <RadixSelect.ItemIndicator className="absolute right-3 inline-flex items-center">
                      <Check
                        className="size-4"
                        strokeWidth={2.75}
                        aria-hidden
                      />
                    </RadixSelect.ItemIndicator>
                  </RadixSelect.Item>
                )
              })}
            </RadixSelect.Viewport>
            <RadixSelect.ScrollDownButton className="flex h-7 cursor-default items-center justify-center bg-papel text-desvaida">
              <ChevronDown className="size-4" aria-hidden />
            </RadixSelect.ScrollDownButton>
          </RadixSelect.Content>
        </RadixSelect.Portal>
      </RadixSelect.Root>
      {name !== undefined ? (
        <input type="hidden" name={name} value={valor} />
      ) : null}
    </div>
  )
}
