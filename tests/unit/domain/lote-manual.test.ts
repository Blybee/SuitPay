import { describe, expect, it } from 'vitest'
import { planificarLoteManual } from '#/domain/fichaje/lote-manual.ts'

const JUEVES = new Date('2026-08-27T15:00:00-05:00')
const SEMANA = [
  '2026-08-24',
  '2026-08-25',
  '2026-08-26',
  '2026-08-27',
  '2026-08-28',
  '2026-08-29',
] as const
const DOMINGO = '2026-08-30'

describe('lote manual de la semana laboral', () => {
  it('escribe varios días de la semana y no incluye el domingo', () => {
    const decision = planificarLoteManual({
      ahora: JUEVES,
      fechas: [...SEMANA],
      ocupadas: new Set(),
    })

    expect(decision).toEqual({
      tipo: 'escribir',
      fechas: [...SEMANA],
      omitidas: [],
      mensaje:
        'Registrado: lunes, martes, miércoles, jueves, viernes y sábado.',
    })
  })

  it('salta el día que ya tiene entrada y registra el resto', () => {
    expect(
      planificarLoteManual({
        ahora: JUEVES,
        fechas: ['2026-08-26', '2026-08-24', '2026-08-25'],
        ocupadas: new Set(['2026-08-25']),
      }),
    ).toEqual({
      tipo: 'escribir',
      fechas: ['2026-08-24', '2026-08-26'],
      omitidas: ['2026-08-25'],
      mensaje: 'Registrado: lunes y miércoles. Ya tenía entrada: martes.',
    })
  })

  it('no escribe el domingo ni el resto del pedido si el domingo viene incluido', () => {
    expect(
      planificarLoteManual({
        ahora: JUEVES,
        fechas: ['2026-08-28', DOMINGO],
        ocupadas: new Set(),
      }),
    ).toEqual({
      tipo: 'rechazar',
      codigo: 'peticion_invalida',
      mensaje: 'Esos días no pertenecen a esta semana laboral.',
    })
  })

  it('si ningún día está libre, es un error y no un lote vacío', () => {
    expect(
      planificarLoteManual({
        ahora: JUEVES,
        fechas: ['2026-08-24', '2026-08-26'],
        ocupadas: new Set(['2026-08-24', '2026-08-26']),
      }),
    ).toEqual({
      tipo: 'rechazar',
      codigo: 'entrada_ya_registrada',
      mensaje: 'Ya tenían entrada: lunes y miércoles.',
    })
  })
})
