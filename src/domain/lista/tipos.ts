export type UrgenciaDeRequerimiento = 'normal' | 'urgente'

export interface LineaDeRequerimiento {
  readonly id: string
  readonly codigo: string
  readonly descripcion: string
  readonly cantidad: number
  readonly urgencia: UrgenciaDeRequerimiento
}

export const VIDA_LISTA_MS = 7 * 24 * 60 * 60 * 1000
