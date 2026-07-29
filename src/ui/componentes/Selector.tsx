import { useId, type ComponentPropsWithoutRef } from 'react'

/**
 * Select personalizado Soft-Pill (reutilizable).
 *
 * Usa el `<select>` nativo con `appearance: base-select` (Modern Web Guidance /
 * Customizable Select) para conservar accesibilidad, teclado y envío de
 * formularios. En Chrome/Edge el picker es web-rendered (no el menú del SO);
 * en Firefox/Safari degrada al select del sistema sin perder función.
 *
 * @see https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Forms/Customizable_select
 */

export interface OpcionDeSelector<T extends string = string> {
  readonly valor: T
  readonly etiqueta: string
}

export interface PropsDeSelector<T extends string = string>
  extends Omit<
    ComponentPropsWithoutRef<'select'>,
    'value' | 'onChange' | 'children' | 'id'
  > {
  readonly valor: T
  readonly onCambiar: (valor: T) => void
  readonly opciones: readonly OpcionDeSelector<T>[]
  /** Etiqueta visible junto al control. */
  readonly etiqueta: string
  /** Oculta el texto de la etiqueta (sigue en aria-label). */
  readonly ocultarEtiqueta?: boolean
  readonly id?: string
}

function unir(...clases: readonly (string | false | undefined)[]): string {
  return clases.filter((cada) => typeof cada === 'string').join(' ')
}

export function Selector<T extends string>({
  valor,
  onCambiar,
  opciones,
  etiqueta,
  ocultarEtiqueta = false,
  id,
  className,
  disabled,
  ...resto
}: PropsDeSelector<T>) {
  const generado = useId()
  const idCampo = id ?? generado

  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor={idCampo}
        className={unir(
          'font-mono text-etiqueta uppercase text-desvaida',
          ocultarEtiqueta && 'sr-only',
        )}
      >
        {etiqueta}
      </label>
      <select
        id={idCampo}
        value={valor}
        disabled={disabled}
        aria-label={ocultarEtiqueta ? etiqueta : undefined}
        onChange={(evento) => onCambiar(evento.target.value as T)}
        className={unir('selector-suitpay', className)}
        {...resto}
      >
        {opciones.map((opcion) => (
          <option key={opcion.valor} value={opcion.valor}>
            {opcion.etiqueta}
          </option>
        ))}
      </select>
    </div>
  )
}
