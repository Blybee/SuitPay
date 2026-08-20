import { PapeletaContexto } from '../../ui/componentes/PapeletaContexto.tsx'
import { Boton } from '../../ui/componentes/primitivas.tsx'
import { formatearImporte } from '../../domain/totales/calculo.ts'
import type { ComprobanteResumido } from './comprobantes-cliente.ts'
import type { Cotizacion } from '../cotizaciones/tipos.ts'
import { CATALOGO_DE_COMANDOS } from './pistas.ts'

export type ResultadoDeComando =
  | {
      readonly tipo: 'comprobantes'
      readonly cliente: string
      readonly items: readonly ComprobanteResumido[]
    }
  | {
      readonly tipo: 'cotizacion'
      readonly cotizacion: Cotizacion | null
    }
  | { readonly tipo: 'ayuda' }
  | { readonly tipo: 'mensaje'; readonly texto: string }

/**
 * Presenta el resultado de una consulta sin abandonar el mostrador (FR-047).
 */
export function ResultadosDeComando({
  resultado,
  onCerrar,
}: {
  readonly resultado: ResultadoDeComando | null
  readonly onCerrar: () => void
}) {
  if (resultado === null) return null

  return (
    <PapeletaContexto
      abierta
      alCambiar={(abierta) => {
        if (!abierta) onCerrar()
      }}
      titulo={tituloDe(resultado)}
      pie={
        <Boton variante="principal" onClick={onCerrar}>
          Cerrar
        </Boton>
      }
    >
      {resultado.tipo === 'comprobantes' ? (
        resultado.items.length === 0 ? (
          <p className="text-cuerpo text-desvaida">
            No hay comprobantes recientes de {resultado.cliente}.
          </p>
        ) : (
          <ul className="space-y-2 text-cuerpo">
            {resultado.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-4">
                <span className="uppercase">
                  {item.tipoDocumento} {item.serie}-{item.numero} · {item.estado}
                </span>
                <span className="font-mono tabular-nums">
                  {formatearImporte(item.total)}
                </span>
              </li>
            ))}
          </ul>
        )
      ) : null}

      {resultado.tipo === 'cotizacion' ? (
        resultado.cotizacion === null ? (
          <p className="text-cuerpo text-desvaida">No existe esa cotización.</p>
        ) : (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-cuerpo">
            <dt className="text-desvaida">Número</dt>
            <dd className="font-mono font-bold">{resultado.cotizacion.numero}</dd>
            <dt className="text-desvaida">Total</dt>
            <dd className="font-mono">
              {formatearImporte(resultado.cotizacion.total)}
            </dd>
            <dt className="text-desvaida">Líneas</dt>
            <dd>{resultado.cotizacion.lineas.length}</dd>
          </dl>
        )
      ) : null}

      {resultado.tipo === 'ayuda' ? (
        <ul className="space-y-1 font-mono text-cuerpo">
          {CATALOGO_DE_COMANDOS.map((comando) => (
            <li key={comando.id}>
              {comando.prefijo}
              {comando.parametros.length > 0
                ? ` ${comando.parametros.join(' ')}`
                : ''}
              <span className="ml-2 font-sans text-desvaida">
                {comando.descripcion}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {resultado.tipo === 'mensaje' ? (
        <p className="text-cuerpo text-tinta">{resultado.texto}</p>
      ) : null}
    </PapeletaContexto>
  )
}

function tituloDe(resultado: ResultadoDeComando): string {
  switch (resultado.tipo) {
    case 'comprobantes':
      return 'Comprobantes del cliente'
    case 'cotizacion':
      return 'Cotización'
    case 'ayuda':
      return 'Comandos'
    case 'mensaje':
      return 'Instrucción'
  }
}
