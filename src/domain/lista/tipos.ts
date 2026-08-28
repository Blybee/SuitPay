export type UrgenciaDeRequerimiento = 'normal' | 'urgente'

export interface LineaDeRequerimiento {
  readonly id: string
  readonly codigo: string
  readonly descripcion: string
  readonly cantidad: number
  readonly urgencia: UrgenciaDeRequerimiento
}

export const VIDA_LISTA_MS = 7 * 24 * 60 * 60 * 1000

/** Colección raíz. Un documento de vendedor agrupa los días. */
export const COLECCION_LISTAS_REQUERIMIENTO = 'listasRequerimiento'

/**
 * Subcolección por día. El id es propio (`diasLista`, no `dias`) para que el
 * TTL de Firestore no cubra otros grupos de colecciones homónimos.
 */
export const SUBCOLECCION_DIAS_LISTA = 'diasLista'

export function caminoDiaLista(uid: string, fecha: string): string {
  return `${COLECCION_LISTAS_REQUERIMIENTO}/${uid}/${SUBCOLECCION_DIAS_LISTA}/${fecha}`
}
