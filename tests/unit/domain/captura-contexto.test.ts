import { describe, expect, it } from 'vitest'
import {
  extraerMencionDeVecino,
  resolverDestinoDeVecino,
} from '../../../src/domain/captura/mencion-vecino.ts'
import { esAudioDelDiaActual, horaEnLima } from '../../../src/domain/captura/hora-lima.ts'

const VECINOS = [
  { id: '1', alias: 'wilmer' },
  { id: '2', alias: 'ana' },
]

describe('mención de vecino en el dictado', () => {
  it('asigna al alias mencionado', () => {
    expect(
      extraerMencionDeVecino(['10 codo para wilmer'], VECINOS)?.id,
    ).toBe('1')
    expect(
      extraerMencionDeVecino(['vecino ana pegamento'], VECINOS)?.id,
    ).toBe('2')
  })

  it('no confunde un alias corto dentro de otra palabra', () => {
    expect(extraerMencionDeVecino(['manzana verde'], VECINOS)).toBeNull()
  })

  it('sin mención usa el pill activo', () => {
    expect(
      resolverDestinoDeVecino({
        textos: ['10 codo fg'],
        vecinos: VECINOS,
        activoId: '2',
      }),
    ).toBe('2')
  })
})

describe('filtro de audios del día en Lima', () => {
  it('acepta una grabación del mismo día civil', () => {
    const ahora = new Date('2026-08-27T20:00:00-05:00')
    const manana = new Date('2026-08-27T08:15:00-05:00')
    expect(esAudioDelDiaActual(manana, ahora)).toBe(true)
  })

  it('rechaza una grabación del día anterior aunque falten pocas horas', () => {
    const ahora = new Date('2026-08-27T01:00:00-05:00')
    const ayer = new Date('2026-08-26T23:30:00-05:00')
    expect(esAudioDelDiaActual(ayer, ahora)).toBe(false)
  })

  it('formatea la hora en zona Lima', () => {
    expect(horaEnLima(new Date('2026-08-27T15:05:00-05:00'))).toMatch(/15:05/)
  })
})
