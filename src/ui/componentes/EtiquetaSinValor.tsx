import type { TipoDeDocumento } from '../../domain/documentos/tipos.ts'
import { etiquetaDeAdvertencia } from '../../domain/documentos/tipos.ts'

/**
 * La etiqueta **SIN VALOR TRIBUTARIO** (FR-036).
 *
 * ## Por qué el componente decide por el tipo y no por una prop
 *
 * Podría haber recibido un booleano `mostrar`. No lo hace, y la diferencia
 * importa: con un booleano, cada pantalla que muestre un tipo de documento tendría
 * que acordarse de calcularlo, y bastaría un olvido en una sola superficie para
 * que una nota de venta pasara por una boleta. Recibiendo el tipo, la decisión la
 * toma el dominio en `etiquetaDeAdvertencia` y **no hay forma de equivocarse por
 * omisión**.
 *
 * La consecuencia buscada: la ausencia de la etiqueta es la señal de que el
 * documento sí está regulado, y esa señal ya no depende de que alguien la recuerde.
 *
 * ## Por qué no es solo color
 *
 * Perfilada en rojo, sí, pero lo que dice está escrito. Un vendedor que no
 * distingue el rojo tiene que poder saberlo igual, y en un documento tributario
 * esto no es una concesión: es la diferencia entre entregar un papel que vale y
 * otro que no.
 */
export function EtiquetaSinValor({
  tipo,
}: {
  readonly tipo: TipoDeDocumento
}) {
  const texto = etiquetaDeAdvertencia(tipo)
  if (texto === null) return null

  return (
    <span
      // `status` y no `alert`: es una condición permanente del documento, no algo
      // que acaba de ocurrir. Un `alert` lo anunciaría cada vez que se repinta.
      role="status"
      className={[
        'inline-block shrink-0 rounded-full border border-aviso px-3 py-1',
        'font-mono text-etiqueta font-bold uppercase tracking-wide text-aviso',
      ].join(' ')}
    >
      {texto}
    </span>
  )
}
