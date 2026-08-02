import { UserPlus } from 'lucide-react'
import {
  REGLAS,
  TIPOS_ELEGIBLES,
} from '../../domain/documentos/tipos.ts'
import type { TipoElegible } from '../../domain/documentos/tipos.ts'
import { formatearImporte } from '../../domain/totales/calculo.ts'
import type { Centimos } from '../../domain/totales/calculo.ts'
import { EtiquetaSinValor } from './EtiquetaSinValor.tsx'
import { Boton } from './primitivas.tsx'
import { Selector } from './Selector.tsx'

/**
 * Cabecera del documento: tipo (Selector), serie y cliente.
 * Cambiar de tipo no toca las líneas del pedido (FR-014).
 */

const OPCIONES_TIPO = TIPOS_ELEGIBLES.map((cada) => ({
  valor: cada,
  etiqueta: REGLAS[cada].nombre,
}))

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
  total,
  umbral,
}: PropsDeCabecera) {
  const reglas = REGLAS[tipo]
  const exigeCliente =
    cliente === null &&
    (reglas.exigeClienteIdentificado ||
      (reglas.sujetoAUmbralDeIdentificacion && total > umbral))

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

        <div className="ml-auto flex items-center gap-2">
          {cliente === null ? (
            <Boton
              variante={exigeCliente ? 'peligro' : 'secundario'}
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
