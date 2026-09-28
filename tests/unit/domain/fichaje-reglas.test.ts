import { describe, expect, it } from 'vitest'
import {
  armarMes,
  convertirTardanzas,
  esDomingoEnLima,
  estadoPorHoraDeEntrada,
  instanteDesdeFechaHoraLima,
  minutosDelDiaEnLima,
  nombreParaMostrar,
  totalesDeCeldas,
} from '#/domain/fichaje/reglas.ts'

describe('ventana de entrada en Lima', () => {
  it('las 10:15 siguen siendo presente y las 10:16 ya son tardanza', () => {
    const enPunto = new Date('2026-09-26T15:00:00Z')
    const limite = new Date('2026-09-26T15:15:00Z')
    const tarde = new Date('2026-09-26T15:16:00Z')

    expect(minutosDelDiaEnLima(enPunto)).toBe(10 * 60)
    expect(estadoPorHoraDeEntrada(enPunto)).toBe('presente')
    expect(estadoPorHoraDeEntrada(limite)).toBe('presente')
    expect(estadoPorHoraDeEntrada(tarde)).toBe('tardanza')
  })

  it('una hora de la madrugada, antes de la tolerancia, es presente', () => {
    expect(estadoPorHoraDeEntrada(new Date('2026-09-26T11:00:00Z'))).toBe(
      'presente',
    )
  })
})

describe('semana laboral lunes a sábado', () => {
  it('el domingo 27 de septiembre de 2026 es el único día libre de ese fin de semana', () => {
    expect(esDomingoEnLima('2026-09-26')).toBe(false)
    expect(esDomingoEnLima('2026-09-27')).toBe(true)
  })
})

describe('conversión de tardanzas', () => {
  it('cada 3 tardanzas se vuelven 1 falta y el resto sigue como tardanza', () => {
    expect(convertirTardanzas(0, 1)).toEqual({ tardanzas: 0, faltas: 1 })
    expect(convertirTardanzas(2, 0)).toEqual({ tardanzas: 2, faltas: 0 })
    expect(convertirTardanzas(3, 0)).toEqual({ tardanzas: 0, faltas: 1 })
    expect(convertirTardanzas(4, 1)).toEqual({ tardanzas: 1, faltas: 2 })
    expect(convertirTardanzas(6, 0)).toEqual({ tardanzas: 0, faltas: 2 })
  })
})

describe('nombre completo', () => {
  it('acepta nombre y apellido y rechaza una sola palabra o dígitos', () => {
    expect(nombreParaMostrar('  maría   lópez ')).toBe('maría lópez')
    expect(nombreParaMostrar('Ana')).toBeNull()
    expect(nombreParaMostrar('Juan 2 Pérez')).toBeNull()
  })
})

describe('calendario del mes', () => {
  it('el sábado pasado sin marca es falta y el domingo queda en gris', () => {
    const celdas = armarMes({
      anio: 2026,
      mes: 9,
      hoy: '2026-09-27',
      marcas: { 24: 'presente' },
    })
    const porDia = new Map(celdas.map((celda) => [celda.dia, celda.clase]))

    expect(porDia.get(24)).toBe('presente')
    expect(porDia.get(26)).toBe('falta')
    expect(porDia.get(27)).toBe('domingo')
    expect(porDia.get(28)).toBe('proximo')
    expect(porDia.get(6)).toBe('domingo')
  })

  it('hoy sábado sin marca todavía no es falta', () => {
    const celdas = armarMes({
      anio: 2026,
      mes: 9,
      hoy: '2026-09-26',
      marcas: { 25: 'tardanza' },
    })
    const porDia = new Map(celdas.map((celda) => [celda.dia, celda.clase]))
    expect(porDia.get(26)).toBe('proximo')
    expect(porDia.get(25)).toBe('tardanza')
  })

  it('tres tardanzas del mes bajan el porcentaje como una falta', () => {
    const celdas = armarMes({
      anio: 2026,
      mes: 9,
      hoy: '2026-09-03',
      marcas: { 1: 'tardanza', 2: 'tardanza', 3: 'tardanza' },
    })
    const totales = totalesDeCeldas(celdas)
    expect(totales.tardanzas).toBe(0)
    expect(totales.faltas).toBe(1)
    expect(totales.porcentaje).toBe(0)
  })
})

describe('fecha y hora elegidas en Lima', () => {
  it('las 10:20 del 26 de septiembre siguen siendo ese día y cuentan como tardanza', () => {
    const instante = instanteDesdeFechaHoraLima('2026-09-26', '10:20')
    expect(instante).not.toBeNull()
    expect(estadoPorHoraDeEntrada(instante ?? new Date(0))).toBe('tardanza')
  })
})
