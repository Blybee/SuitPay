import type { EstadoDeComprobante } from '../../domain/documentos/tipos.ts'

/**
 * El sello y las marcas de estado.
 *
 * ## La regla del sello
 *
 * **Si tiene sello, existe ante SUNAT.** Es literal y es la única concesión que
 * el sistema hace a la estética del documento: el sello violeta aparece
 * únicamente sobre un comprobante ya emitido y aceptado, nunca sobre la hoja de
 * trabajo ni sobre un pedido en curso.
 *
 * Es también la razón de que el sistema no tenga verde. Un estado positivo no se
 * marca con color de éxito; se marca con el sello. Y no hay verde porque rojo y
 * verde es el peor par posible para el porcentaje nada pequeño de hombres con
 * deficiencia rojo-verde, en un sistema donde "no definitivo" y "validado" no
 * pueden confundirse nunca.
 *
 * La rotación ligera y la tinta desigual —una opacidad por debajo de uno— son lo
 * que lo hace leer como algo estampado y no como una insignia de interfaz.
 */
export function Sello({ children }: { readonly children: string }) {
  return (
    <span
      className={[
        'inline-block -rotate-[7deg] border-4 border-sello px-3 py-1',
        'font-mono text-cabecera font-bold uppercase tracking-widest text-sello',
        // Tinta desigual: un sello real nunca entinta parejo.
        'opacity-80',
      ].join(' ')}
    >
      {children}
    </span>
  )
}

/**
 * La marca de estado para lo que **no** es una validación: anulado, pendiente de
 * comprobante, rechazado. Siempre en rojo de aviso y siempre con palabras, nunca
 * solo con color.
 *
 * Nótese que no dice "eliminado" en ningún caso. FR-039 prohíbe la palabra
 * "eliminar" referida a un comprobante, en cualquier etiqueta, mensaje o ayuda:
 * un comprobante emitido no se elimina, se anula, y llamarlo de otro modo sugiere
 * que existe una operación que no existe.
 */
export function MarcaEstado({ children }: { readonly children: string }) {
  return (
    <span
      className={[
        'inline-block -rotate-[3deg] border-4 border-aviso px-3 py-1',
        'font-mono text-cabecera font-bold uppercase tracking-widest text-aviso',
        'opacity-85',
      ].join(' ')}
    >
      {children}
    </span>
  )
}

const TEXTOS: Partial<Record<EstadoDeComprobante, string>> = {
  aceptado: 'EMITIDO',
  anulado: 'ANULADO',
  rechazado: 'RECHAZADO',
  pendiente: 'PENDIENTE DE COMPROBANTE',
  indeterminado: 'EN VERIFICACIÓN',
  requiere_intervencion: 'REQUIERE REVISIÓN',
}

/**
 * La marca que corresponde a un estado. Los estados intermedios —`reclamado`,
 * `enviado`— no llevan ninguna: un comprobante en vuelo no es todavía nada, y
 * estamparle una marca sería afirmar algo que aún no se sabe.
 */
export function MarcaDeEstado({
  estado,
}: {
  readonly estado: EstadoDeComprobante
}) {
  const texto = TEXTOS[estado]
  if (texto === undefined) return null

  if (estado === 'aceptado') return <Sello>{texto}</Sello>
  return <MarcaEstado>{texto}</MarcaEstado>
}
