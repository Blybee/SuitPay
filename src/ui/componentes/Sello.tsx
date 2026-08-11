import type { EstadoDeComprobante } from '../../domain/documentos/tipos.ts'

/**
 * El sello y las marcas de estado.
 *
 * ## La regla del sello
 *
 * El sello violeta marca un comprobante que **ya existe en el proveedor** (se
 * puede entregar e imprimir). El texto distingue el matiz:
 * - **REGISTRADO** (`enviado`): firmado/tramitado; la autoridad aún no confirma.
 * - **ACEPTADO** (`aceptado`): confirmado por la autoridad.
 *
 * Nunca sobre la hoja de trabajo ni un pedido en curso. No hay verde: rojo y
 * verde es el peor par para deficiencia rojo-verde, donde "no definitivo" y
 * "validado" no pueden confundirse.
 *
 * La rotación ligera y la tinta desigual —una opacidad por debajo de uno— son lo
 * que lo hace leer como algo estampado y no como una insignia de interfaz.
 */
export function Sello({ children }: { readonly children: string }) {
  return (
    <span
      className={[
        'inline-block -rotate-[7deg] rounded-full border-2 border-sello px-4 py-1',
        'font-mono text-cabecera font-bold uppercase tracking-widest text-sello',
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
        'inline-block -rotate-[3deg] rounded-full border-2 border-aviso px-4 py-1',
        'font-mono text-cabecera font-bold uppercase tracking-widest text-aviso',
        'opacity-85',
      ].join(' ')}
    >
      {children}
    </span>
  )
}

const TEXTOS: Partial<Record<EstadoDeComprobante, string>> = {
  // Ambos llevan sello violeta (el documento existe y se puede entregar), pero
  // el texto no miente: REGISTRADO ≠ ACEPTADO ante la autoridad.
  enviado: 'REGISTRADO',
  aceptado: 'ACEPTADO',
  anulado: 'ANULADO',
  rechazado: 'RECHAZADO',
  pendiente: 'PENDIENTE DE COMPROBANTE',
  indeterminado: 'EN VERIFICACIÓN',
  requiere_intervencion: 'REQUIERE REVISIÓN',
}

/**
 * La marca que corresponde a un estado. `reclamado` no lleva ninguna: es el
 * instante en que el correlativo está consumido y el proveedor aún no ha
 * contestado, y estampar algo ahí sería afirmar lo que todavía no se sabe.
 */
export function MarcaDeEstado({
  estado,
}: {
  readonly estado: EstadoDeComprobante
}) {
  const texto = TEXTOS[estado]
  if (texto === undefined) return null

  if (estado === 'aceptado' || estado === 'enviado') return <Sello>{texto}</Sello>
  return <MarcaEstado>{texto}</MarcaEstado>
}
