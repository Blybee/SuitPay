import { describe, expect, it } from 'vitest'
import {
  fusionarLineaDeRequerimiento,
  cambiarCantidadDeRequerimiento,
  cambiarUrgenciaDeRequerimiento,
  quitarLineaDeRequerimiento,
} from '../../../src/domain/lista/lineas.ts'
import { urgenciaDesdeTexto, alternarUrgencia } from '../../../src/domain/lista/urgencia.ts'
import { bytesDePdfDeRequerimiento } from '../../../src/domain/lista/pdf.ts'
import type { LineaDeRequerimiento } from '../../../src/domain/lista/tipos.ts'

describe('urgencia de lista de requerimiento', () => {
  it('por omisión es Normal', () => {
    expect(urgenciaDesdeTexto('10 codo fg de media')).toBe('normal')
    expect(urgenciaDesdeTexto('')).toBe('normal')
  })

  it('detecta urgente en lo oído', () => {
    expect(urgenciaDesdeTexto('codo fg urgente')).toBe('urgente')
    expect(urgenciaDesdeTexto('mándame pegamento con urgencia')).toBe('urgente')
  })

  it('alterna Normal y Urgente', () => {
    expect(alternarUrgencia('normal')).toBe('urgente')
    expect(alternarUrgencia('urgente')).toBe('normal')
  })
})

describe('fusión de líneas de requerimiento', () => {
  const base: LineaDeRequerimiento = {
    id: 'a',
    codigo: 'C01',
    descripcion: 'CODO FG 1/2',
    cantidad: 2,
    urgencia: 'normal',
  }

  it('usa cantidad 1 si no se especifica', () => {
    const lineas = fusionarLineaDeRequerimiento([], {
      id: 'n',
      codigo: 'C01',
      descripcion: 'CODO FG 1/2',
    })
    expect(lineas[0]?.cantidad).toBe(1)
    expect(lineas[0]?.urgencia).toBe('normal')
  })

  it('suma cantidad si el código ya está y urgente gana', () => {
    const lineas = fusionarLineaDeRequerimiento([base], {
      id: 'b',
      codigo: 'C01',
      descripcion: 'CODO FG 1/2',
      cantidad: 3,
      urgencia: 'urgente',
    })
    expect(lineas).toHaveLength(1)
    expect(lineas[0]?.cantidad).toBe(5)
    expect(lineas[0]?.urgencia).toBe('urgente')
  })

  it('cambia cantidad, urgencia y quita', () => {
    const conCantidad = cambiarCantidadDeRequerimiento([base], 'a', 8)
    expect(conCantidad[0]?.cantidad).toBe(8)
    const conUrgencia = cambiarUrgenciaDeRequerimiento(conCantidad, 'a', 'urgente')
    expect(conUrgencia[0]?.urgencia).toBe('urgente')
    expect(quitarLineaDeRequerimiento(conUrgencia, 'a')).toEqual([])
  })
})

describe('PDF interno de lista de requerimiento', () => {
  it('genera un PDF con las filas', () => {
    const bytes = bytesDePdfDeRequerimiento(
      [
        {
          id: '1',
          codigo: 'C01',
          descripcion: 'CODO FG 1/2',
          cantidad: 10,
          urgencia: 'urgente',
        },
      ],
      new Date('2026-08-27T15:00:00-05:00'),
    )
    const texto = new TextDecoder().decode(bytes)
    expect(texto.startsWith('%PDF-1.4')).toBe(true)
    expect(texto).toContain('Lista de requerimiento')
    expect(texto).toContain('CODO FG 1/2')
    expect(texto).toContain('Urgente')
    expect(texto).toContain('%%EOF')
  })
})
