import { UserPlus } from 'lucide-react'
import {
  REGLAS,
  TIPOS_ELEGIBLES
  
} from '../../domain/documentos/tipos.ts'
import type {TipoElegible} from '../../domain/documentos/tipos.ts';
import { formatearImporte  } from '../../domain/totales/calculo.ts'
import type {Centimos} from '../../domain/totales/calculo.ts';
import { EtiquetaSinValor } from './EtiquetaSinValor.tsx'
import { Boton } from './primitivas.tsx'

/**
 * La cabecera del documento: tipo, serie y cliente.
 *
 * ## Cambiar de tipo no toca el pedido
 *
 * FR-014, y es un requisito nacido de una escena concreta: el vendedor arma
 * catorce líneas para una boleta y al final el cliente pide factura. Si el cambio
 * vaciara el pedido, habría que teclearlo otra vez con el cliente delante. De ahí
 * que el selector solo cambie el tipo, y que el almacén del pedido conserve las
 * líneas al hacerlo.
 *
 * Lo único que se invalida al cambiar es la clave de idempotencia, y eso es
 * correcto: una boleta y una factura del mismo pedido son **dos ventas distintas**
 * y no pueden compartir clave.
 *
 * ## Por qué no se desplaza fuera de vista
 *
 * Confundir una boleta con una factura es el error más caro que se puede cometer
 * sin darse cuenta: se descubre cuando el cliente vuelve pidiendo la factura que
 * necesitaba para su contabilidad, y entonces la corrección es una nota de crédito
 * y un documento nuevo. Con catorce líneas en pantalla, una cabecera que se
 * desplaza es una cabecera que no está cuando se pulsa emitir.
 */

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
  /** Total actual, para poder decir por qué se exige identificar al comprador. */
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
        'sticky top-0 z-10 border-b-2 bg-papel px-3 py-2',
        // El rojo no es la única señal: abajo se escribe el motivo con el importe
        // y el umbral a la vista, para que se entienda por qué.
        exigeCliente ? 'border-aviso' : 'border-tinta',
      ].join(' ')}
    >
      <div className="flex flex-wrap items-center gap-3">
        <div
          role="radiogroup"
          aria-label="Tipo de documento"
          className="flex items-stretch"
        >
          {TIPOS_ELEGIBLES.map((cada) => (
            <button
              key={cada}
              type="button"
              role="radio"
              aria-checked={cada === tipo}
              onClick={() => onCambiarTipo(cada)}
              className={[
                'min-h-11 border-2 px-3 font-bold',
                '-ml-0.5 first:ml-0',
                'focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-tinta',
                cada === tipo
                  ? 'z-10 border-tinta bg-tinta text-papel'
                  : 'border-desvaida bg-papel text-desvaida hover:border-tinta hover:text-tinta',
              ].join(' ')}
            >
              {REGLAS[cada].nombre}
            </button>
          ))}
        </div>

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
