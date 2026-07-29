import { describe, expect, it } from 'vitest'
import {
  diaEnLima,
  esElMismoDiaEnLima,
  estaDentroDeLaVentanaDeAnulacion,
  milisegundosRestantesDeVentana,
} from '#/domain/anulacion/ventana.ts'

/**
 * Lima va cinco horas por detrás de UTC, así que las horas de la tarde en Lima
 * caen en el día siguiente en UTC. Todo lo que se prueba aquí sale de esa
 * diferencia.
 */

describe('el día civil en Lima', () => {
  it('las 19:00 de Lima siguen siendo el mismo día, aunque en UTC ya sea otro', () => {
    // 2026-07-28 19:00 en Lima es 2026-07-29 00:00 en UTC.
    const emision = new Date('2026-07-29T00:00:00Z')
    expect(diaEnLima(emision)).toBe('2026-07-28')
  })

  it('la medianoche de Lima cambia de día', () => {
    // 2026-07-29 00:00 en Lima es 2026-07-29 05:00 en UTC.
    expect(diaEnLima(new Date('2026-07-29T04:59:59Z'))).toBe('2026-07-28')
    expect(diaEnLima(new Date('2026-07-29T05:00:00Z'))).toBe('2026-07-29')
  })
})

describe('ventana de anulación (FR-037, FR-038)', () => {
  it('EL CASO DE LAS 19:00: una venta de la tarde sigue anulable minutos después', () => {
    // Éste es el caso que motiva todo el módulo. Una venta a las 19:00 de Lima
    // ocurre a las 00:00 UTC del día siguiente. Comparando días en UTC, esta
    // venta quedaría inanulable a los diez minutos de emitirse, en plena hora
    // punta del mostrador y por un error de impresión recién cometido.
    const emision = new Date('2026-07-29T00:00:00Z') // 28/07 19:00 en Lima
    const diezMinutosDespues = new Date('2026-07-29T00:10:00Z') // 28/07 19:10

    const resultado = estaDentroDeLaVentanaDeAnulacion(
      emision,
      diezMinutosDespues,
    )

    expect(resultado.dentroDeVentana).toBe(true)
    expect(resultado.diaDeEmision).toBe('2026-07-28')
    expect(resultado.diaActual).toBe('2026-07-28')
  })

  it('sigue anulable hasta el último minuto antes de medianoche en Lima', () => {
    const emision = new Date('2026-07-29T00:00:00Z') // 28/07 19:00
    const casiMedianoche = new Date('2026-07-29T04:59:00Z') // 28/07 23:59

    expect(
      estaDentroDeLaVentanaDeAnulacion(emision, casiMedianoche).dentroDeVentana,
    ).toBe(true)
  })

  it('deja de ser anulable pasada la medianoche de Lima', () => {
    const emision = new Date('2026-07-29T00:00:00Z') // 28/07 19:00
    const pasadaMedianoche = new Date('2026-07-29T05:00:00Z') // 29/07 00:00

    const resultado = estaDentroDeLaVentanaDeAnulacion(
      emision,
      pasadaMedianoche,
    )

    expect(resultado.dentroDeVentana).toBe(false)
    expect(resultado.diaDeEmision).toBe('2026-07-28')
    expect(resultado.diaActual).toBe('2026-07-29')
  })

  it('EL CASO INVERSO: una venta de anoche no es anulable hoy por la tarde', () => {
    // 20:00 del martes en Lima. Sin la zona horaria fijada, un cálculo ingenuo
    // podría considerarla "de hace menos de 24 horas" el miércoles a las 18:00 y
    // permitir anular fuera de plazo algo que la autoridad ya considera cerrado.
    const emision = new Date('2026-07-29T01:00:00Z') // 28/07 20:00 en Lima
    const hoyPorLaTarde = new Date('2026-07-29T23:00:00Z') // 29/07 18:00 en Lima

    expect(
      estaDentroDeLaVentanaDeAnulacion(emision, hoyPorLaTarde).dentroDeVentana,
    ).toBe(false)
  })

  it('una venta de la mañana es anulable por la tarde del mismo día', () => {
    const emision = new Date('2026-07-28T14:00:00Z') // 28/07 09:00 en Lima
    const porLaTarde = new Date('2026-07-28T22:00:00Z') // 28/07 17:00 en Lima

    expect(
      estaDentroDeLaVentanaDeAnulacion(emision, porLaTarde).dentroDeVentana,
    ).toBe(true)
  })

  it('compara días, no una diferencia de horas', () => {
    // Estas dos emisiones distan una hora, pero caen en días distintos de Lima.
    const antesDeMedianoche = new Date('2026-07-29T04:30:00Z') // 28/07 23:30
    const despuesDeMedianoche = new Date('2026-07-29T05:30:00Z') // 29/07 00:30

    expect(esElMismoDiaEnLima(antesDeMedianoche, despuesDeMedianoche)).toBe(
      false,
    )
  })
})

describe('cuánto queda de ventana', () => {
  it('calcula lo que falta hasta la medianoche de Lima', () => {
    const emision = new Date('2026-07-29T00:00:00Z') // 28/07 19:00 en Lima
    const ahora = new Date('2026-07-29T02:00:00Z') // 28/07 21:00 en Lima

    // De las 21:00 a las 24:00 de Lima quedan tres horas.
    expect(milisegundosRestantesDeVentana(emision, ahora)).toBe(
      3 * 60 * 60 * 1000,
    )
  })

  it('devuelve cero cuando la ventana ya se cerró', () => {
    const emision = new Date('2026-07-28T14:00:00Z')
    const alDiaSiguiente = new Date('2026-07-29T14:00:00Z')

    expect(milisegundosRestantesDeVentana(emision, alDiaSiguiente)).toBe(0)
  })
})
