import { useEffect, useState } from 'react'
import { Loader2, UserPlus, UserRoundPen } from 'lucide-react'
import { REGLAS } from '../../domain/documentos/tipos.ts'
import type { TipoElegible } from '../../domain/documentos/tipos.ts'
import { formatearImporte } from '../../domain/totales/calculo.ts'
import type { Centimos } from '../../domain/totales/calculo.ts'
import type { ModoCampoCliente } from '../../features/clientes/compatibilidad-documento.ts'
import { esClientePorNombre } from '../../features/clientes/documento-marcador.ts'
import { Boton, Campo } from './primitivas.tsx'
import { Selector } from './Selector.tsx'

/**
 * Cabecera del documento: tipo (con serie en la etiqueta) y cliente.
 *
 * Un campo infiere DNI/RUC/nombre según el tipo fiscal y lo tecleado (sin
 * conmutador). Enter confirma; el «+» abre Buscar o Agregar. Con nombre, «Usar»
 * aplica la denominación.
 */

export type ModoDeCabecera =
  | TipoElegible
  | 'cotizacion'
  | 'boleta_guia'
  | 'factura_guia'

export type ModoDeCampoCliente = ModoCampoCliente

export interface SeriesEnCabecera {
  readonly boleta: string | null
  readonly factura: string | null
  readonly guia: string | null
  readonly notaVenta: string | null
}

/** Los modos compuestos no son tipos fiscales: emiten boleta o factura. */
export function tipoFiscalDeModo(
  modo: ModoDeCabecera,
): TipoElegible | 'cotizacion' {
  if (modo === 'boleta_guia') return 'boleta'
  if (modo === 'factura_guia') return 'factura'
  return modo
}

export function modoEncadenaGuia(modo: ModoDeCabecera): boolean {
  return modo === 'boleta_guia' || modo === 'factura_guia'
}

function esIntentoDeDocumento(texto: string): boolean {
  return texto.length === 0 || /^[\d\s]*$/.test(texto)
}

/** DNI/RUC/nombre a partir del tipo fiscal y de lo tecleado. */
export function clasificarEntradaCliente(
  fiscal: TipoElegible | 'cotizacion',
  texto: string,
): ModoCampoCliente | null {
  if (fiscal === 'nota_venta') return null
  if (fiscal === 'factura') return 'ruc'
  if (esIntentoDeDocumento(texto)) {
    if (fiscal === 'boleta') return 'dni'
    const digitos = texto.replace(/\D/g, '')
    if (digitos.length > 8) return 'ruc'
    if (digitos.length > 0) return 'dni'
    return 'nombre'
  }
  if (fiscal === 'boleta' || fiscal === 'cotizacion') return 'nombre'
  return null
}

export function sanitizarCampoCliente(
  fiscal: TipoElegible | 'cotizacion',
  valor: string,
): string {
  if (fiscal === 'nota_venta') return ''
  if (fiscal === 'factura') return valor.replace(/\D/g, '').slice(0, 11)
  if (esIntentoDeDocumento(valor)) {
    const max = fiscal === 'boleta' ? 8 : 11
    return valor.replace(/\D/g, '').slice(0, max)
  }
  return valor.slice(0, 120)
}

function placeholderCampoCliente(
  fiscal: TipoElegible | 'cotizacion',
): string {
  if (fiscal === 'factura') return 'RUC'
  if (fiscal === 'boleta') return 'DNI o Nombre'
  return 'DNI, RUC o Nombre'
}

function ariaLabelCampoCliente(fiscal: TipoElegible | 'cotizacion'): string {
  if (fiscal === 'factura') return 'RUC del cliente'
  if (fiscal === 'boleta') return 'DNI o nombre del cliente'
  return 'DNI, RUC o nombre del cliente'
}

export function mensajeValidacionCampo(
  modoCampo: ModoDeCampoCliente,
  texto: string,
): string | null {
  const trimmed = texto.trim()
  if (modoCampo === 'nombre') {
    if (trimmed.length < 2) return 'Escribe al menos 2 caracteres del nombre.'
    return null
  }
  const digitos = trimmed.replace(/\D/g, '')
  if (modoCampo === 'dni') {
    if (digitos.length !== 8) return 'El DNI debe tener exactamente 8 dígitos.'
    return null
  }
  if (digitos.length !== 11) return 'El RUC debe tener exactamente 11 dígitos.'
  return null
}

function etiquetaDeOpcionTipo(
  modo: ModoDeCabecera,
  series: SeriesEnCabecera,
): string {
  if (modo === 'boleta') {
    return `Boleta · ${series.boleta ?? 'sin asignar'}`
  }
  if (modo === 'boleta_guia') {
    return `Bol + Guía R · ${series.boleta ?? 'sin asignar'}`
  }
  if (modo === 'factura') {
    return `Factura · ${series.factura ?? 'sin asignar'}`
  }
  if (modo === 'factura_guia') {
    return `Fact + Guía R · ${series.factura ?? 'sin asignar'}`
  }
  if (modo === 'nota_venta') {
    return 'Nota de venta'
  }
  return 'Cotización'
}

/** Trigger en móvil: abreviatura, sin serie. */
export function etiquetaCortaDeModo(modo: ModoDeCabecera): string {
  if (modo === 'boleta') return 'Bol'
  if (modo === 'boleta_guia') return 'Bol + GR'
  if (modo === 'factura') return 'Fact'
  if (modo === 'factura_guia') return 'Fact + GR'
  if (modo === 'nota_venta') return 'Nota'
  return 'Coti'
}

export interface PropsDeCabecera {
  readonly modo: ModoDeCabecera
  readonly onCambiarModo: (modo: ModoDeCabecera) => void
  readonly series: SeriesEnCabecera
  readonly cliente: {
    readonly denominacion: string
    readonly numeroDocumento: string
    readonly direccion?: string
  } | null
  readonly onAgregarClienteNuevo: () => void
  readonly onQuitarCliente: () => void
  readonly onDocumentoCompleto?: (datos: {
    readonly tipoDocumento: 'RUC' | 'DNI'
    readonly numeroDocumento: string
  }) => void
  readonly onNombreListo?: (nombre: string) => void
  readonly consultandoPadron?: boolean
  readonly total: Centimos
  readonly umbral: Centimos
}

export function CabeceraDocumento({
  modo,
  onCambiarModo,
  series,
  cliente,
  onAgregarClienteNuevo,
  onQuitarCliente,
  onDocumentoCompleto,
  onNombreListo,
  consultandoPadron = false,
  total,
  umbral,
}: PropsDeCabecera) {
  const tipoFiscal = tipoFiscalDeModo(modo)
  const esCotizacion = tipoFiscal === 'cotizacion'
  const reglas = esCotizacion ? null : REGLAS[tipoFiscal]
  const [textoCampo, setTextoCampo] = useState('')
  /** Solo borde rojo; sin mensaje de texto (pedido de polish). */
  const [campoMarcadoInvalido, setCampoMarcadoInvalido] = useState(false)

  useEffect(() => {
    setTextoCampo('')
    setCampoMarcadoInvalido(false)
  }, [modo, cliente])

  const modoCampo = clasificarEntradaCliente(tipoFiscal, textoCampo)

  const opcionesTipo: readonly {
    valor: ModoDeCabecera
    etiqueta: string
    etiquetaCorta: string
  }[] = [
    {
      valor: 'boleta',
      etiqueta: etiquetaDeOpcionTipo('boleta', series),
      etiquetaCorta: etiquetaCortaDeModo('boleta'),
    },
    {
      valor: 'boleta_guia',
      etiqueta: etiquetaDeOpcionTipo('boleta_guia', series),
      etiquetaCorta: etiquetaCortaDeModo('boleta_guia'),
    },
    {
      valor: 'factura',
      etiqueta: etiquetaDeOpcionTipo('factura', series),
      etiquetaCorta: etiquetaCortaDeModo('factura'),
    },
    {
      valor: 'factura_guia',
      etiqueta: etiquetaDeOpcionTipo('factura_guia', series),
      etiquetaCorta: etiquetaCortaDeModo('factura_guia'),
    },
    {
      valor: 'nota_venta',
      etiqueta: etiquetaDeOpcionTipo('nota_venta', series),
      etiquetaCorta: etiquetaCortaDeModo('nota_venta'),
    },
    {
      valor: 'cotizacion',
      etiqueta: etiquetaDeOpcionTipo('cotizacion', series),
      etiquetaCorta: etiquetaCortaDeModo('cotizacion'),
    },
  ]

  const exigeCliente =
    !esCotizacion &&
    cliente === null &&
    reglas !== null &&
    (reglas.exigeClienteIdentificado ||
      (reglas.sujetoAUmbralDeIdentificacion && total > umbral))

  const nombreTrim = textoCampo.trim()
  const morphUsarNombre =
    cliente === null &&
    modoCampo === 'nombre' &&
    nombreTrim.length >= 2 &&
    onNombreListo !== undefined

  function alCambiarTexto(valor: string): void {
    setCampoMarcadoInvalido(false)
    setTextoCampo(sanitizarCampoCliente(tipoFiscal, valor))
  }

  function confirmarCampo(): void {
    if (modoCampo === null) return
    if (mensajeValidacionCampo(modoCampo, textoCampo) !== null) {
      setCampoMarcadoInvalido(true)
      return
    }
    setCampoMarcadoInvalido(false)

    if (modoCampo === 'nombre') {
      onNombreListo?.(textoCampo.trim())
      return
    }

    const digitos = textoCampo.replace(/\D/g, '')
    onDocumentoCompleto?.({
      tipoDocumento: modoCampo === 'ruc' ? 'RUC' : 'DNI',
      numeroDocumento: digitos,
    })
  }

  function alTeclaCampo(evento: React.KeyboardEvent<HTMLInputElement>): void {
    if (evento.key !== 'Enter') return
    evento.preventDefault()
    confirmarCampo()
  }

  const mostrarCampo = cliente === null && modoCampo !== null
  const esDocumento = modoCampo === 'ruc' || modoCampo === 'dni'

  return (
    <header
      className={[
        'z-10 border-b bg-papel px-3 py-2 md:px-4 md:py-3',
        exigeCliente ? 'border-aviso' : 'border-borde',
      ].join(' ')}
    >
      <div className="flex flex-wrap items-center gap-2 md:gap-3">
        <Selector
          etiqueta="Tipo de documento"
          ocultarEtiqueta
          variante="compacto"
          valor={modo}
          onCambiar={onCambiarModo}
          opciones={opcionesTipo}
        />

        {mostrarCampo ? (
          <div className="flex min-w-[12rem] flex-1 flex-col gap-1 sm:max-w-xs">
            <div className="relative min-w-0">
              <Campo
                id="documento-cliente-inline"
                inputMode={tipoFiscal === 'factura' ? 'numeric' : 'text'}
                autoComplete="off"
                placeholder={placeholderCampoCliente(tipoFiscal)}
                maxLength={tipoFiscal === 'factura' ? 11 : 120}
                value={textoCampo}
                onChange={(evento) => alCambiarTexto(evento.target.value)}
                onKeyDown={alTeclaCampo}
                disabled={consultandoPadron}
                aria-busy={consultandoPadron || undefined}
                aria-label={ariaLabelCampoCliente(tipoFiscal)}
                aria-invalid={
                  campoMarcadoInvalido ||
                  (exigeCliente && textoCampo.length === 0)
                }
                invalido={
                  campoMarcadoInvalido ||
                  (exigeCliente && textoCampo.length === 0)
                }
                className={[
                  esDocumento
                    ? 'font-mono tabular-nums tracking-wide'
                    : 'tracking-normal',
                  consultandoPadron ? 'pr-11' : '',
                ].join(' ')}
              />
              {consultandoPadron ? (
                <Loader2
                  className="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 animate-spin text-desvaida"
                  aria-hidden
                />
              ) : null}
            </div>
            {consultandoPadron ? (
              <p className="font-mono text-etiqueta text-desvaida">
                Consultando padrón…
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          {cliente !== null ? (
            <>
              <span className="text-right">
                <span className="block max-w-xs truncate text-cuerpo text-tinta">
                  {cliente.denominacion}
                </span>
                {!esClientePorNombre(cliente.numeroDocumento) ? (
                  <span className="block font-mono text-etiqueta text-desvaida">
                    {cliente.numeroDocumento}
                  </span>
                ) : null}
                {cliente.direccion ? (
                  <span className="block max-w-xs truncate font-mono text-etiqueta text-desvaida">
                    {cliente.direccion}
                  </span>
                ) : null}
              </span>
              <button
                type="button"
                onClick={onQuitarCliente}
                title="Cambiar cliente"
                aria-label="Cambiar cliente"
                className={[
                  'inline-flex size-11 shrink-0 items-center justify-center rounded-full border',
                  'border-borde bg-papel text-tinta transition-colors hover:bg-mesa',
                  'focus-visible:outline-none focus-visible:border-tinta',
                ].join(' ')}
              >
                <UserRoundPen className="size-5" aria-hidden />
              </button>
            </>
          ) : (
            <>
              {morphUsarNombre ? (
                <Boton
                  variante="principal"
                  onClick={() => confirmarCampo()}
                  title="Usar este nombre en el documento"
                  aria-label="Usar nombre del cliente"
                >
                  Usar
                </Boton>
              ) : null}
              <button
                type="button"
                onClick={onAgregarClienteNuevo}
                disabled={consultandoPadron}
                title="Buscar o agregar cliente"
                aria-label="Buscar o agregar cliente"
                className={[
                  'inline-flex size-11 shrink-0 items-center justify-center rounded-full border font-bold transition-colors',
                  'focus-visible:outline-none focus-visible:border-tinta',
                  'disabled:cursor-not-allowed disabled:opacity-60',
                  exigeCliente && !mostrarCampo
                    ? 'border-aviso text-aviso'
                    : 'border-borde bg-papel text-tinta hover:bg-mesa',
                ].join(' ')}
              >
                <UserPlus className="size-5" aria-hidden />
              </button>
            </>
          )}
        </div>
      </div>

      {exigeCliente && (
        <p className="mt-1.5 text-cuerpo font-bold text-aviso">
          {reglas.exigeClienteIdentificado
            ? 'Una factura necesita el RUC del cliente.'
            : `Este importe (${formatearImporte(total)}) supera el umbral de ${formatearImporte(umbral)} y obliga a identificar al cliente.`}
        </p>
      )}
    </header>
  )
}
