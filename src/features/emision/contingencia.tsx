import { useState } from 'react'
import { Printer } from 'lucide-react'
import { formatearImporte  } from '../../domain/totales/calculo.ts'
import type {LineaCalculada} from '../../domain/totales/calculo.ts';
import { etiquetaDeAdvertencia } from '../../domain/documentos/tipos.ts'
import type { TipoElegible } from '../../domain/documentos/tipos.ts'
import { PapeletaContexto } from '../../ui/componentes/PapeletaContexto.tsx'
import { Boton, Campo, Etiqueta } from '../../ui/componentes/primitivas.tsx'

/**
 * La recogida de contacto y el documento interno de contingencia (FR-050a).
 *
 * ## Por qué se pide el teléfono y no es opcional en la práctica
 *
 * Cuando el proveedor no responde, el cliente se va con la mercadería y sin
 * comprobante. El teléfono es **la única forma de cerrar esa venta**: sin él, el
 * comprobante se emitirá al restablecerse el servicio y no habrá modo de
 * entregarlo. Se puede continuar sin darlo, porque un cliente puede negarse y la
 * venta no se puede detener por eso, pero la pantalla dice qué se pierde.
 *
 * ## Por qué el documento se marca dos veces
 *
 * Lleva la etiqueta perfilada en rojo y además el texto impreso. La razón es que
 * este papel va a acabar en manos de alguien que cree que tiene un comprobante, y
 * la confusión tiene consecuencias: si lo presenta en su contabilidad como si
 * valiera, el problema aparece meses después. Que se distinga «sin margen de duda»
 * de una factura real es un requisito, no una preferencia estética.
 */

export interface PropsDeContingencia {
  readonly abierta: boolean
  readonly lineas: readonly LineaCalculada[]
  readonly total: number
  readonly tipoDeseado: TipoElegible
  readonly onConfirmar: (contacto: { telefono: string }) => void
  readonly onImprimirInterno: () => void
}

export function RecogerContacto({
  abierta,
  lineas,
  total,
  tipoDeseado,
  onConfirmar,
  onImprimirInterno,
}: PropsDeContingencia) {
  const [telefono, setTelefono] = useState('')

  return (
    <PapeletaContexto
      abierta={abierta}
      noSeCierraSola
      alCambiar={() => undefined}
      titulo="Toma el contacto del cliente"
      descripcion="El comprobante se emitirá en cuanto vuelva el servicio y hay que poder hacérselo llegar."
    >
      <div className="space-y-4">
        <div>
          <Etiqueta htmlFor="telefono-de-contacto">Teléfono</Etiqueta>
          <Campo
            id="telefono-de-contacto"
            value={telefono}
            onChange={(evento) => setTelefono(evento.target.value)}
            inputMode="tel"
            autoComplete="tel"
            placeholder="999 888 777"
            className="mt-1"
          />
          <p className="mt-1 text-cuerpo text-desvaida">
            Sin teléfono, el comprobante se emitirá igual pero no habrá cómo
            entregárselo.
          </p>
        </div>

        <div className="border-2 border-tinta">
          <div className="flex items-center justify-between border-b-2 border-tinta px-3 py-2">
            <p className="font-mono text-etiqueta uppercase text-desvaida">
              Documento interno · {tipoDeseado} pendiente
            </p>
            <span className="inline-block border-2 border-aviso px-2 py-0.5 font-mono text-etiqueta font-bold uppercase text-aviso">
              {etiquetaDeAdvertencia('interno_contingencia')}
            </span>
          </div>
          <ul className="max-h-40 overflow-y-auto px-3 py-1">
            {lineas.map((linea, indice) => (
              <li
                key={`${linea.codigo}-${indice}`}
                className="flex items-baseline justify-between gap-3 py-0.5"
              >
                <span className="min-w-0 truncate text-cuerpo text-tinta">
                  {linea.cantidad} × {linea.descripcion}
                </span>
                <span className="font-mono tabular-nums text-cuerpo text-tinta">
                  {formatearImporte(linea.importe)}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex items-baseline justify-between border-t-2 border-tinta px-3 py-2">
            <span className="font-mono text-etiqueta uppercase text-desvaida">
              Total
            </span>
            <span className="font-mono tabular-nums text-cabecera font-bold text-tinta">
              {formatearImporte(total)}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Boton
            variante="principal"
            onClick={() => onConfirmar({ telefono: telefono.trim() })}
          >
            Guardar y continuar
          </Boton>
          <Boton onClick={onImprimirInterno}>
            <Printer className="size-5" aria-hidden />
            Imprimir documento interno
          </Boton>
        </div>
      </div>
    </PapeletaContexto>
  )
}
