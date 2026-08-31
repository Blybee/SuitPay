import { describe, expect, it } from 'vitest'
import {
  anonimizarNotas,
  compactarCatalogo,
} from '../../../src/domain/aprendizaje/compacto.ts'

describe('compactarCatalogo', () => {
  it('omite inactivos y no incluye precio', () => {
    const compacto = compactarCatalogo(
      [
        { codigo: 'C1', descripcion: 'CODO 1/2', activo: true },
        { codigo: 'X1', descripcion: 'BAJA', activo: false },
      ],
      { C1: { aliases: ['codo media'], etiquetas: ['economico'] } },
    )
    expect(compacto).toEqual([
      { id: 'C1', n: 'CODO 1/2', a: ['codo media'], e: ['economico'] },
    ])
    expect(JSON.stringify(compacto)).not.toMatch(/precio/)
    expect(JSON.stringify(compacto)).not.toMatch(/stock/)
  })
})

describe('anonimizarNotas', () => {
  it('sustituye documentos de 8 a 11 dígitos', () => {
    expect(anonimizarNotas(['Prefiere RUC 20123456789 y DNI 12345678'])).toEqual([
      'Prefiere RUC [doc] y DNI [doc]',
    ])
  })
})
