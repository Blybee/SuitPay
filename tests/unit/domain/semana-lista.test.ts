import { describe, expect, it } from 'vitest'
import {
  diaPorDefecto,
  semanaLaboralEnLima,
} from '../../../src/domain/lista/semana.ts'

describe('semana laboral de la lista de requerimiento', () => {
  it('arma lunes a sábado de la semana del día en Lima', () => {
    // Jueves 27/08/2026 en Lima.
    const semana = semanaLaboralEnLima(new Date('2026-08-27T15:00:00-05:00'))
    expect(semana.map((d) => d.fecha)).toEqual([
      '2026-08-24',
      '2026-08-25',
      '2026-08-26',
      '2026-08-27',
      '2026-08-28',
      '2026-08-29',
    ])
    expect(semana.map((d) => d.etiqueta)).toEqual([
      'Lun',
      'Mar',
      'Mié',
      'Jue',
      'Vie',
      'Sáb',
    ])
    expect(semana[0]?.corta).toBe('24/08')
  })

  it('usa el día civil de Lima, no el de UTC', () => {
    // 23:30 del miércoles en Lima = 04:30 del jueves en UTC.
    const semana = semanaLaboralEnLima(new Date('2026-08-27T04:30:00Z'))
    expect(diaPorDefecto(semana, new Date('2026-08-27T04:30:00Z'))).toBe(
      '2026-08-26',
    )
  })

  it('cruza el fin de mes sin romper las fechas', () => {
    // Martes 01/09/2026: el lunes es 31/08.
    const semana = semanaLaboralEnLima(new Date('2026-09-01T12:00:00-05:00'))
    expect(semana[0]?.fecha).toBe('2026-08-31')
    expect(semana[1]?.fecha).toBe('2026-09-01')
  })

  it('por defecto abre el día actual; el domingo, el sábado', () => {
    const jueves = new Date('2026-08-27T15:00:00-05:00')
    expect(diaPorDefecto(semanaLaboralEnLima(jueves), jueves)).toBe(
      '2026-08-27',
    )
    const domingo = new Date('2026-08-30T10:00:00-05:00')
    expect(diaPorDefecto(semanaLaboralEnLima(domingo), domingo)).toBe(
      '2026-08-29',
    )
  })
})
