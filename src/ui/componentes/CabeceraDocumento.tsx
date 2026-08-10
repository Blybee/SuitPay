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
import { esClientePorNombre } from '../../features/clientes/documento-marcador.ts'
import { EtiquetaSinValor } from './EtiquetaSinValor.tsx'
import { Boton, Campo } from './primitivas.tsx'
import { Selector } from './Selector.tsx'

/**
 * Cabecera del documento: tipo (con serie en la etiqueta) y cliente.
 *
 * Campo inline RUC/DNI/Nombre con chevrons. La búsqueda/validación es manual
 * (Enter o morph Usar/Agregar): no se dispara al llegar a N dígitos.
 */

export type ModoDeCabecera = TipoElegible | 'cotizacion'

export type ModoDeCampoCliente = 'ruc' | 'dni' | 'nombre'

export interface ClienteParaConfirmar {
  readonly tipoDocumento: 'DNI' | 'RUC' | 'NOMBRE'
  readonly numeroDocumento: string
  readonly denominacion: string
  readonly direccion?: string
  readonly condicion?: string
  readonly noHabido?: boolean
  readonly origen: 'registrado' | 'consulta'
}

export interface SeriesEnCabecera {
  readonly boleta: string | null
  readonly factura: string | null
}

const ETIQUETA_CAMPO: Record<ModoDeCampoCliente, string> = {
  ruc: 'RUC',
  dni: 'DNI',
  nombre: 'Nombre',
}

function modosCampoPermitidos(modo: ModoDeCabecera): readonly ModoDeCampoCliente[] {
  if (modo === 'factura') return ['ruc']
  if (modo === 'boleta') return ['dni', 'nombre']
  // Cotización: Nombre primero (uso más frecuente al cotizar).
  if (modo === 'cotizacion') return ['nombre', 'dni', 'ruc']
  return []
}

function modoCampoPorDefecto(modo: ModoDeCabecera): ModoDeCampoCliente | null {
  const permitidos = modosCampoPermitidos(modo)
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
  readonly onDocumentoIncompleto?: () => void
  readonly onNombreListo?: (nombre: string) => void
  readonly consultandoPadron?: boolean
  readonly clienteParaConfirmar?: ClienteParaConfirmar | null
  readonly onConfirmarCliente?: () => void
  readonly onCancelarConfirmacion?: () => void
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
  onDocumentoIncompleto,
  onNombreListo,
  consultandoPadron = false,
  clienteParaConfirmar = null,
  onConfirmarCliente,
  onCancelarConfirmacion,
  total,
  umbral,
}: PropsDeCabecera) {
  const esCotizacion = modo === 'cotizacion'
  const reglas = esCotizacion ? null : REGLAS[modo]
  const permitidos = modosCampoPermitidos(modo)
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
    clienteParaConfirmar === null &&
    reglas !== null &&
    (reglas.exigeClienteIdentificado ||
      (reglas.sujetoAUmbralDeIdentificacion && total > umbral))

  const nombreTrim = textoCampo.trim()
  const morphUsarNombre =
    cliente === null &&
    clienteParaConfirmar === null &&
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
    onDocumentoIncompleto?.()
  }

  function alCambiarTexto(valor: string): void {
    if (modoCampo === null) return
    setCampoMarcadoInvalido(false)
    onDocumentoIncompleto?.()

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

  const mostrarCampo =
    cliente === null && clienteParaConfirmar === null && modoCampo !== null

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
          ) : clienteParaConfirmar === null ? (
            <button
              type="button"
              onClick={() => {
                if (modoCampo === 'nombre' && onNombreListo) {
                  confirmarCampo()
                  return
                }
                if (modoCampo === 'ruc' || modoCampo === 'dni') {
                  confirmarCampo()
                  return
                }
                onAgregarClienteNuevo()
              }}
              disabled={consultandoPadron}
              title={
                consultandoPadron
                  ? 'Consultando padrón…'
                  : morphUsarNombre
                    ? 'Usar este nombre en el documento'
                    : modoCampo === 'ruc' || modoCampo === 'dni'
                      ? 'Confirmar documento'
                      : 'Agregar cliente nuevo'
              }
              aria-label={
                consultandoPadron
                  ? 'Consultando padrón'
                  : morphUsarNombre
                    ? 'Usar nombre del cliente'
                    : modoCampo === 'ruc' || modoCampo === 'dni'
                      ? 'Confirmar documento del cliente'
                      : 'Agregar cliente nuevo'
              }
              className={[
                'inline-flex min-h-11 items-center justify-center gap-2 font-bold transition-all',
                'focus-visible:outline-none focus-visible:border-tinta',
                'disabled:cursor-not-allowed disabled:opacity-60',
                morphUsarNombre
                  ? 'rounded-full border border-tinta bg-tinta px-5 text-papel'
                  : [
                      'size-11 rounded-full border',
                      exigeCliente && !mostrarCampo
                        ? 'border-aviso text-aviso'
                        : 'border-borde bg-papel text-tinta hover:bg-mesa',
                    ].join(' '),
              ].join(' ')}
            >
              <UserPlus className="size-5 shrink-0" aria-hidden />
              {morphUsarNombre ? <span>Usar</span> : null}
            </button>
          ) : null}
        </div>
      </div>

      {clienteParaConfirmar !== null ? (
        <div
          className="mt-3 rounded-2xl border border-borde bg-mesa px-4 py-3"
          data-testid="confirmacion-cliente"
        >
          <p className="font-mono text-etiqueta uppercase text-desvaida">
            {clienteParaConfirmar.origen === 'registrado'
              ? 'Cliente registrado — confirma los datos'
              : 'Datos del padrón — confirma antes de usar'}
          </p>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-cuerpo">
            <dt className="font-mono text-etiqueta uppercase text-desvaida">
              Documento
            </dt>
            <dd className="font-mono text-tinta">
              {clienteParaConfirmar.tipoDocumento}{' '}
              {clienteParaConfirmar.numeroDocumento}
            </dd>
            <dt className="font-mono text-etiqueta uppercase text-desvaida">
              Razón social
            </dt>
            <dd className="text-tinta">{clienteParaConfirmar.denominacion}</dd>
            <dt className="font-mono text-etiqueta uppercase text-desvaida">
              Dirección
            </dt>
            <dd className="text-tinta">
              {clienteParaConfirmar.direccion?.trim()
                ? clienteParaConfirmar.direccion
                : '—'}
            </dd>
          </dl>
          {clienteParaConfirmar.noHabido ? (
            <p className="mt-2 text-cuerpo font-bold text-aviso">
              Condición: {clienteParaConfirmar.condicion ?? 'NO HABIDO'}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <Boton
              variante="discreto"
              onClick={onCancelarConfirmacion}
              disabled={consultandoPadron}
            >
              Cancelar
            </Boton>
            <Boton
              variante="principal"
              onClick={onConfirmarCliente}
              disabled={consultandoPadron}
            >
              Confirmar
            </Boton>
          </div>
        </div>
      ) : null}

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
