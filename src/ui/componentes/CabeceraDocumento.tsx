import { useEffect, useState } from 'react'
import { UserPlus } from 'lucide-react'
import {
  REGLAS,
  TIPOS_ELEGIBLES,
} from '../../domain/documentos/tipos.ts'
import type { TipoElegible } from '../../domain/documentos/tipos.ts'
import { formatearImporte } from '../../domain/totales/calculo.ts'
import type { Centimos } from '../../domain/totales/calculo.ts'
import { EtiquetaSinValor } from './EtiquetaSinValor.tsx'
import { Boton, Campo } from './primitivas.tsx'
import { Selector } from './Selector.tsx'

/**
 * Cabecera del documento: tipo (Selector), serie y cliente.
 *
 * - El input RUC/DNI busca clientes **ya registrados**.
 * - El icon-button agrega un cliente nuevo; si el documento del input no está
 *   registrado, morph a «Agregar» y consulta el padrón.
 * - Antes de fijar el cliente, el vendedor confirma razón social y dirección.
 * - «Cotización» es modo de cabecera (no documento tributario): el pie guarda.
 */

export type ModoDeCabecera = TipoElegible | 'cotizacion'

export interface ClienteParaConfirmar {
  readonly tipoDocumento: 'DNI' | 'RUC'
  readonly numeroDocumento: string
  readonly denominacion: string
  readonly direccion?: string
  readonly condicion?: string
  readonly noHabido?: boolean
  readonly origen: 'registrado' | 'consulta'
}

const OPCIONES_TIPO: readonly { valor: ModoDeCabecera; etiqueta: string }[] = [
  ...TIPOS_ELEGIBLES.map((cada) => ({
    valor: cada as ModoDeCabecera,
    etiqueta: REGLAS[cada].nombre,
  })),
  { valor: 'cotizacion', etiqueta: 'Cotización' },
]

type CampoDeDocumento =
  | { readonly etiqueta: 'RUC'; readonly longitud: 11; readonly tipoDocumento: 'RUC' }
  | { readonly etiqueta: 'DNI'; readonly longitud: 8; readonly tipoDocumento: 'DNI' }

function campoSegunModo(modo: ModoDeCabecera): CampoDeDocumento | null {
  if (modo === 'factura') {
    return { etiqueta: 'RUC', longitud: 11, tipoDocumento: 'RUC' }
  }
  if (modo === 'boleta') {
    return { etiqueta: 'DNI', longitud: 8, tipoDocumento: 'DNI' }
  }
  return null
}

export interface PropsDeCabecera {
  readonly modo: ModoDeCabecera
  readonly onCambiarModo: (modo: ModoDeCabecera) => void
  readonly serie: string | null
  readonly cliente: {
    readonly denominacion: string
    readonly numeroDocumento: string
    readonly direccion?: string
  } | null
  /** Abre el alta manual / búsqueda por razón social (cliente nuevo). */
  readonly onAgregarClienteNuevo: () => void
  readonly onQuitarCliente: () => void
  /** Documento completo en el input: el padre busca en registrados. */
  readonly onDocumentoCompleto?: (datos: {
    readonly tipoDocumento: 'RUC' | 'DNI'
    readonly numeroDocumento: string
  }) => void
  /** El documento dejó de estar completo: limpia morph / confirmación. */
  readonly onDocumentoIncompleto?: () => void
  /**
   * Si el documento del input no está registrado, el icon-button morph a
   * «Agregar» y este callback lanza la consulta al padrón.
   */
  readonly documentoNoRegistrado?: string | null
  readonly onConsultarNoRegistrado?: () => void
  readonly consultandoPadron?: boolean
  /** Datos a confirmar (registrado o resultado de consulta). */
  readonly clienteParaConfirmar?: ClienteParaConfirmar | null
  readonly onConfirmarCliente?: () => void
  readonly onCancelarConfirmacion?: () => void
  readonly total: Centimos
  readonly umbral: Centimos
}

export function CabeceraDocumento({
  modo,
  onCambiarModo,
  serie,
  cliente,
  onAgregarClienteNuevo,
  onQuitarCliente,
  onDocumentoCompleto,
  onDocumentoIncompleto,
  documentoNoRegistrado = null,
  onConsultarNoRegistrado,
  consultandoPadron = false,
  clienteParaConfirmar = null,
  onConfirmarCliente,
  onCancelarConfirmacion,
  total,
  umbral,
}: PropsDeCabecera) {
  const esCotizacion = modo === 'cotizacion'
  const reglas = esCotizacion ? null : REGLAS[modo]
  const campo = campoSegunModo(modo)
  const [numeroDocumento, setNumeroDocumento] = useState('')

  useEffect(() => {
    setNumeroDocumento('')
  }, [modo, cliente])

  const exigeCliente =
    !esCotizacion &&
    cliente === null &&
    clienteParaConfirmar === null &&
    reglas !== null &&
    (reglas.exigeClienteIdentificado ||
      (reglas.sujetoAUmbralDeIdentificacion && total > umbral))

  const morphAgregar =
    cliente === null &&
    clienteParaConfirmar === null &&
    documentoNoRegistrado !== null &&
    documentoNoRegistrado.length > 0

  function alCambiarDocumento(valor: string): void {
    if (campo === null) return
    const soloDigitos = valor.replace(/\D/g, '').slice(0, campo.longitud)
    setNumeroDocumento(soloDigitos)
    if (soloDigitos.length < campo.longitud) {
      onDocumentoIncompleto?.()
      return
    }
    if (onDocumentoCompleto !== undefined) {
      onDocumentoCompleto({
        tipoDocumento: campo.tipoDocumento,
        numeroDocumento: soloDigitos,
      })
    }
  }

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
          opciones={OPCIONES_TIPO}
        />

        {esCotizacion ? (
          <span
            role="status"
            className="inline-block shrink-0 rounded-full border border-borde px-3 py-1 font-mono text-etiqueta font-bold uppercase tracking-wide text-desvaida"
          >
            Borrador
          </span>
        ) : (
          <EtiquetaSinValor tipo={modo} />
        )}

        {!esCotizacion && reglas?.consumeSerieRegulada ? (
          <p className="font-mono text-cuerpo text-tinta">
            <span className="text-etiqueta uppercase text-desvaida">Serie </span>
            {serie ?? (
              <span className="font-bold text-aviso">sin asignar</span>
            )}
          </p>
        ) : null}

        {cliente === null &&
          clienteParaConfirmar === null &&
          campo !== null && (
            <div className="flex min-w-[12rem] flex-1 items-center gap-2 sm:max-w-xs">
              <label
                htmlFor="documento-cliente-inline"
                className="shrink-0 font-mono text-etiqueta uppercase text-desvaida"
              >
                {campo.etiqueta}
              </label>
              <Campo
                id="documento-cliente-inline"
                inputMode="numeric"
                autoComplete="off"
                placeholder={
                  campo.etiqueta === 'RUC' ? '20123456789' : '12345678'
                }
                maxLength={campo.longitud}
                value={numeroDocumento}
                onChange={(evento) => alCambiarDocumento(evento.target.value)}
                aria-label={`${campo.etiqueta} del cliente`}
                invalido={exigeCliente && numeroDocumento.length === 0}
                className="font-mono tabular-nums tracking-wide"
              />
            </div>
          )}

        <div className="ml-auto flex items-center gap-2">
          {cliente !== null ? (
            <>
              <span className="text-right">
                <span className="block max-w-xs truncate text-cuerpo text-tinta">
                  {cliente.denominacion}
                </span>
                <span className="block font-mono text-etiqueta text-desvaida">
                  {cliente.numeroDocumento}
                </span>
                {cliente.direccion ? (
                  <span className="block max-w-xs truncate font-mono text-etiqueta text-desvaida">
                    {cliente.direccion}
                  </span>
                ) : null}
              </span>
              <Boton variante="discreto" onClick={onQuitarCliente}>
                Cambiar
              </Boton>
            </>
          ) : clienteParaConfirmar === null ? (
            <button
              type="button"
              onClick={() => {
                if (morphAgregar && onConsultarNoRegistrado) {
                  onConsultarNoRegistrado()
                  return
                }
                onAgregarClienteNuevo()
              }}
              disabled={consultandoPadron}
              title={
                morphAgregar
                  ? 'Consultar y agregar cliente no registrado'
                  : 'Agregar cliente nuevo'
              }
              aria-label={
                morphAgregar
                  ? 'Agregar cliente no registrado'
                  : 'Agregar cliente nuevo'
              }
              className={[
                'inline-flex min-h-11 items-center justify-center gap-2 font-bold transition-all',
                'focus-visible:outline-none focus-visible:border-tinta',
                'disabled:cursor-not-allowed disabled:opacity-60',
                morphAgregar
                  ? 'rounded-full border border-tinta bg-tinta px-5 text-papel'
                  : [
                      'size-11 rounded-full border',
                      exigeCliente && campo === null
                        ? 'border-aviso text-aviso'
                        : 'border-borde bg-papel text-tinta hover:bg-mesa',
                    ].join(' '),
              ].join(' ')}
            >
              <UserPlus className="size-5 shrink-0" aria-hidden />
              {morphAgregar ? (
                <span>{consultandoPadron ? 'Consultando…' : 'Agregar'}</span>
              ) : null}
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
