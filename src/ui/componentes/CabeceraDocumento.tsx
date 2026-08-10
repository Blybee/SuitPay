import { useEffect, useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  UserPlus,
  UserRoundPen,
} from 'lucide-react'
import {
  REGLAS,
  TIPOS_ELEGIBLES,
} from '../../domain/documentos/tipos.ts'
import type { TipoElegible } from '../../domain/documentos/tipos.ts'
import { formatearImporte } from '../../domain/totales/calculo.ts'
import type { Centimos } from '../../domain/totales/calculo.ts'
import { modosCampoClientePermitidos } from '../../features/clientes/compatibilidad-documento.ts'
import type { ModoCampoCliente } from '../../features/clientes/compatibilidad-documento.ts'
import { esClientePorNombre } from '../../features/clientes/documento-marcador.ts'
import { EtiquetaSinValor } from './EtiquetaSinValor.tsx'
import { Boton, Campo } from './primitivas.tsx'
import { Selector } from './Selector.tsx'

/**
 * Cabecera del documento: tipo (con serie en la etiqueta) y cliente.
 *
 * Campo inline RUC/DNI/Nombre con chevrons. La búsqueda/validación del documento
 * es manual con Enter; el «+» abre el modal Buscar o Agregar (no confirma el
 * campo). En modo Nombre, «Usar» aplica la denominación.
 */

export type ModoDeCabecera = TipoElegible | 'cotizacion'

export type ModoDeCampoCliente = ModoCampoCliente

export interface SeriesEnCabecera {
  readonly boleta: string | null
  readonly factura: string | null
}

const ETIQUETA_CAMPO: Record<ModoDeCampoCliente, string> = {
  ruc: 'RUC',
  dni: 'DNI',
  nombre: 'Nombre',
}

function modoCampoPorDefecto(modo: ModoDeCabecera): ModoDeCampoCliente | null {
  const permitidos = modosCampoClientePermitidos(modo)
  return permitidos[0] ?? null
}

function longitudEsperada(modoCampo: ModoDeCampoCliente): number | null {
  if (modoCampo === 'ruc') return 11
  if (modoCampo === 'dni') return 8
  return null
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
  if (modo === 'factura') {
    return `Factura · ${series.factura ?? 'sin asignar'}`
  }
  if (modo === 'nota_venta') return REGLAS.nota_venta.nombre
  return 'Cotización'
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
  const esCotizacion = modo === 'cotizacion'
  const reglas = esCotizacion ? null : REGLAS[modo]
  const permitidos = modosCampoClientePermitidos(modo)
  const [modoCampo, setModoCampo] = useState<ModoDeCampoCliente | null>(
    modoCampoPorDefecto(modo),
  )
  const [textoCampo, setTextoCampo] = useState('')
  /** Solo borde rojo; sin mensaje de texto (pedido de polish). */
  const [campoMarcadoInvalido, setCampoMarcadoInvalido] = useState(false)

  useEffect(() => {
    setTextoCampo('')
    setCampoMarcadoInvalido(false)
    setModoCampo(modoCampoPorDefecto(modo))
  }, [modo, cliente])

  const opcionesTipo: readonly { valor: ModoDeCabecera; etiqueta: string }[] = [
    ...TIPOS_ELEGIBLES.map((cada) => ({
      valor: cada as ModoDeCabecera,
      etiqueta: etiquetaDeOpcionTipo(cada, series),
    })),
    {
      valor: 'cotizacion' as const,
      etiqueta: etiquetaDeOpcionTipo('cotizacion', series),
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

  function ciclarModoCampo(delta: 1 | -1): void {
    if (permitidos.length < 2 || modoCampo === null) return
    const idx = permitidos.indexOf(modoCampo)
    const siguiente =
      permitidos[(idx + delta + permitidos.length) % permitidos.length]!
    setModoCampo(siguiente)
    setTextoCampo('')
    setCampoMarcadoInvalido(false)
  }

  function alCambiarTexto(valor: string): void {
    if (modoCampo === null) return
    setCampoMarcadoInvalido(false)

    if (modoCampo === 'nombre') {
      setTextoCampo(valor.slice(0, 120))
      return
    }

    const max = longitudEsperada(modoCampo) ?? 11
    setTextoCampo(valor.replace(/\D/g, '').slice(0, max))
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

  return (
    <header
      className={[
        'z-10 border-b bg-papel px-4 py-3',
        exigeCliente ? 'border-aviso' : 'border-borde',
      ].join(' ')}
    >
      <div className="flex flex-wrap items-center gap-3">
        <Selector
          etiqueta="Tipo de documento"
          ocultarEtiqueta
          valor={modo}
          onCambiar={(valor) => onCambiarModo(valor as ModoDeCabecera)}
          opciones={opcionesTipo}
        />

        {!esCotizacion ? <EtiquetaSinValor tipo={modo} /> : null}

        {mostrarCampo ? (
          <div className="flex min-w-[12rem] flex-1 flex-col gap-1 sm:max-w-xs">
            <div className="flex items-center gap-2">
              <div className="flex shrink-0 flex-col items-center">
                {permitidos.length > 1 ? (
                  <button
                    type="button"
                    aria-label="Modo de campo anterior"
                    className="flex size-5 items-center justify-center text-desvaida hover:text-tinta"
                    onClick={() => ciclarModoCampo(-1)}
                  >
                    <ChevronUp className="size-3.5" aria-hidden />
                  </button>
                ) : (
                  <span className="size-5" aria-hidden />
                )}
                <label
                  htmlFor="documento-cliente-inline"
                  className="font-mono text-etiqueta uppercase text-desvaida"
                >
                  {ETIQUETA_CAMPO[modoCampo]}
                </label>
                {permitidos.length > 1 ? (
                  <button
                    type="button"
                    aria-label="Modo de campo siguiente"
                    className="flex size-5 items-center justify-center text-desvaida hover:text-tinta"
                    onClick={() => ciclarModoCampo(1)}
                  >
                    <ChevronDown className="size-3.5" aria-hidden />
                  </button>
                ) : (
                  <span className="size-5" aria-hidden />
                )}
              </div>
              <div className="relative min-w-0 flex-1">
                <Campo
                  id="documento-cliente-inline"
                  inputMode={modoCampo === 'nombre' ? 'text' : 'numeric'}
                  autoComplete="off"
                  placeholder={
                    modoCampo === 'ruc'
                      ? '20123456789'
                      : modoCampo === 'dni'
                        ? '12345678'
                        : 'Nombre del cliente'
                  }
                  maxLength={
                    modoCampo === 'nombre' ? 120 : modoCampo === 'ruc' ? 11 : 8
                  }
                  value={textoCampo}
                  onChange={(evento) => alCambiarTexto(evento.target.value)}
                  onKeyDown={alTeclaCampo}
                  disabled={consultandoPadron}
                  aria-busy={consultandoPadron || undefined}
                  aria-label={`${ETIQUETA_CAMPO[modoCampo]} del cliente`}
                  aria-invalid={
                    campoMarcadoInvalido ||
                    (exigeCliente && textoCampo.length === 0)
                  }
                  invalido={
                    campoMarcadoInvalido ||
                    (exigeCliente && textoCampo.length === 0)
                  }
                  className={[
                    modoCampo === 'nombre'
                      ? 'tracking-normal'
                      : 'font-mono tabular-nums tracking-wide',
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
            </div>
            {consultandoPadron ? (
              <p className="pl-12 font-mono text-etiqueta text-desvaida">
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
          {reglas?.exigeClienteIdentificado
            ? 'Una factura necesita el RUC del cliente.'
            : `Este importe (${formatearImporte(total)}) supera el umbral de ${formatearImporte(umbral)} y obliga a identificar al cliente.`}
        </p>
      )}
    </header>
  )
}
