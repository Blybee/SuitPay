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
 * Cambiar de tipo no toca las líneas del pedido (FR-014).
 *
 * Factura muestra input de RUC; boleta muestra input de DNI.
 * Al completar la longitud esperada se dispara la identificación.
 */

const OPCIONES_TIPO = TIPOS_ELEGIBLES.map((cada) => ({
  valor: cada,
  etiqueta: REGLAS[cada].nombre,
}))

type CampoDeDocumento =
  | { readonly etiqueta: 'RUC'; readonly longitud: 11; readonly tipoDocumento: 'RUC' }
  | { readonly etiqueta: 'DNI'; readonly longitud: 8; readonly tipoDocumento: 'DNI' }

function campoSegunTipo(tipo: TipoElegible): CampoDeDocumento | null {
  if (tipo === 'factura') {
    return { etiqueta: 'RUC', longitud: 11, tipoDocumento: 'RUC' }
  }
  if (tipo === 'boleta') {
    return { etiqueta: 'DNI', longitud: 8, tipoDocumento: 'DNI' }
  }
  return null
}

export interface PropsDeCabecera {
  readonly tipo: TipoElegible
  readonly onCambiarTipo: (tipo: TipoElegible) => void
  readonly serie: string | null
  readonly cliente: {
    readonly denominacion: string
    readonly numeroDocumento: string
  } | null
  readonly onElegirCliente: () => void
  readonly onQuitarCliente: () => void
  /** Se dispara al completar RUC (11) o DNI (8) en el campo inline. */
  readonly onDocumentoCompleto?: (datos: {
    readonly tipoDocumento: 'RUC' | 'DNI'
    readonly numeroDocumento: string
  }) => void
  readonly total: Centimos
  readonly umbral: Centimos
}

export function CabeceraDocumento({
  tipo,
  onCambiarTipo,
  serie,
  cliente,
  onElegirCliente,
  onQuitarCliente,
  onDocumentoCompleto,
  total,
  umbral,
}: PropsDeCabecera) {
  const reglas = REGLAS[tipo]
  const campo = campoSegunTipo(tipo)
  const [numeroDocumento, setNumeroDocumento] = useState('')

  useEffect(() => {
    setNumeroDocumento('')
  }, [tipo, cliente])

  const exigeCliente =
    cliente === null &&
    (reglas.exigeClienteIdentificado ||
      (reglas.sujetoAUmbralDeIdentificacion && total > umbral))

  function alCambiarDocumento(valor: string): void {
    if (campo === null) return
    const soloDigitos = valor.replace(/\D/g, '').slice(0, campo.longitud)
    setNumeroDocumento(soloDigitos)
    if (
      soloDigitos.length === campo.longitud &&
      onDocumentoCompleto !== undefined
    ) {
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
          valor={tipo}
          onCambiar={onCambiarTipo}
          opciones={OPCIONES_TIPO}
        />

        <EtiquetaSinValor tipo={tipo} />

        {reglas.consumeSerieRegulada && (
          <p className="font-mono text-cuerpo text-tinta">
            <span className="text-etiqueta uppercase text-desvaida">Serie </span>
            {serie ?? (
              <span className="font-bold text-aviso">sin asignar</span>
            )}
          </p>
        )}

        {cliente === null && campo !== null && (
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
              placeholder={campo.etiqueta === 'RUC' ? '20123456789' : '12345678'}
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
          {cliente === null ? (
            <Boton
              variante={exigeCliente && campo === null ? 'peligro' : 'secundario'}
              onClick={onElegirCliente}
            >
              <UserPlus className="size-5" aria-hidden />
              Identificar cliente
            </Boton>
          ) : (
            <>
              <span className="text-right">
                <span className="block max-w-xs truncate text-cuerpo text-tinta">
                  {cliente.denominacion}
                </span>
                <span className="block font-mono text-etiqueta text-desvaida">
                  {cliente.numeroDocumento}
                </span>
              </span>
              <Boton variante="discreto" onClick={onQuitarCliente}>
                Cambiar
              </Boton>
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
