import { describe, expect, it } from 'vitest'
import {
  anonimizarNotas,
  anonimizarTexto,
  compactarCatalogo,
} from '../../../src/domain/aprendizaje/compacto.ts'

describe('compactarCatalogo', () => {
  it('omite inactivos y no incluye precio', () => {
    const compacto = compactarCatalogo(
      [
        { codigo: 'C1', descripcion: 'CODO 1/2', activo: true, marca: 'Pavco' },
        { codigo: 'X1', descripcion: 'BAJA', activo: false },
      ],
      { C1: { aliases: ['codo media'], etiquetas: ['economico'] } },
    )
    expect(compacto).toEqual([
      { id: 'C1', n: 'CODO 1/2', m: 'Pavco', a: ['codo media'], e: ['economico'] },
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

describe('anonimizarTexto', () => {
  it('quita teléfono, correo, documento, dirección y nombres, y deja códigos y cantidades', () => {
    const texto = anonimizarTexto(
      'Sr. Juan Pérez pide 12 codo PVC 1/2 TUB-PVC-12 a Ferretería El Sol S.A.C. Av. Arequipa 1234 correo juan@sol.pe cel +51 987654321 y 987654321 DNI 12345678',
      ['Ferretería El Sol S.A.C.'],
    )
    expect(texto).not.toMatch(/Juan/)
    expect(texto).not.toMatch(/Ferretería El Sol/)
    expect(texto).not.toMatch(/Arequipa/)
    expect(texto).not.toMatch(/juan@sol\.pe/)
    expect(texto).not.toMatch(/987654321/)
    expect(texto).not.toMatch(/12345678/)
    expect(texto).toContain('12 codo PVC 1/2')
    expect(texto).toContain('TUB-PVC-12')
  })

  it('un pedido sin datos de cliente sale igual, incluido un código con ocho dígitos pegados', () => {
    const pedido = '12 codo PVC 1/2 codigo TUB-PVC-12 y SKU-12345678 x2'
    expect(anonimizarTexto(pedido, ['Inca'])).toBe(pedido)
  })

  it('reconoce celular de nueve dígitos y Jr. o Mz./Lt. como dirección', () => {
    const texto = anonimizarTexto(
      'cliente María Quispe deja en Jr. Lima 450 Mz. B Lt. 4 cel 912345678',
      [],
    )
    expect(texto).not.toMatch(/María/)
    expect(texto).not.toMatch(/Lima 450/)
    expect(texto).not.toMatch(/912345678/)
    expect(texto).toMatch(/\[tel\]/)
    expect(texto).toMatch(/\[dir\]/)
  })
})
