import { describe, expect, it } from 'vitest'
import {
  agruparConflictosPorCodigo,
  detectarConflictos,
  hayConflictosBloqueantes,
} from '../../../src/domain/catalogo/conflictos.ts'

describe('detectarConflictos', () => {
  it('acepta unidades ya mapeadas y señala las que no', () => {
    const conflictos = detectarConflictos([
      { codigo: 'A', descripcion: 'Juego de tanque', unidad: 'NIU' },
      { codigo: 'B', descripcion: 'Crucetas', unidad: 'BX' },
      { codigo: 'C', descripcion: 'Pieza', unidad: 'ROLLO' },
    ])

    expect(conflictos).toEqual([
      {
        tipo: 'unidad_desconocida',
        codigo: 'C',
        detalle: 'Unidad «ROLLO» no reconocida.',
      },
    ])
    expect(hayConflictosBloqueantes(conflictos)).toBe(true)
  })

  it('agrupa por código para pintar la fila', () => {
    const conflictos = detectarConflictos([
      { codigo: 'DUP', descripcion: 'Uno', unidad: 'NIU' },
      { codigo: 'DUP', descripcion: 'Dos', unidad: 'NIU' },
    ])
    const porCodigo = agruparConflictosPorCodigo(conflictos)
    expect(porCodigo.get('DUP')?.[0]?.tipo).toBe('codigo_duplicado')
  })
})
