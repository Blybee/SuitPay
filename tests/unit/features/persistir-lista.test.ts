import { describe, expect, it } from 'vitest'
import {
  COLECCION_LISTAS_REQUERIMIENTO,
  SUBCOLECCION_DIAS_LISTA,
  caminoDiaLista,
} from '../../../src/domain/lista/tipos.ts'

describe('camino de la lista de requerimiento', () => {
  it('usa diasLista, no un collection group genérico dias', () => {
    expect(SUBCOLECCION_DIAS_LISTA).toBe('diasLista')
    expect(COLECCION_LISTAS_REQUERIMIENTO).toBe('listasRequerimiento')
    expect(caminoDiaLista('uid-1', '2026-08-27')).toBe(
      'listasRequerimiento/uid-1/diasLista/2026-08-27',
    )
  })
})
