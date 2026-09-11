import { describe, expect, it } from 'vitest'
import { textoDeCandidatosParaPrompt } from '../../../src/server/asistencia/payload.ts'
import { promptDeAsistencia, REGLAS_EMPAREJADO } from '../../../src/server/asistencia/prompts.ts'
import { promptDeListaPdf } from '../../../src/server/asistencia/prompts-pdf.ts'
import { parsearAlineaciones } from '../../../src/server/aprendizaje/entrenar-par.ts'
import { paresDesdePedido } from '../../../src/features/aprendizaje/registrar.ts'

describe('prompt de Cotizar / emparejado', () => {
  it('no pide normalizar medidas dentro de textoOriginal', () => {
    expect(REGLAS_EMPAREJADO).not.toMatch(/dentro de textoOriginal/i)
    expect(REGLAS_EMPAREJADO).toMatch(/TAL CUAL/)
    expect(promptDeListaPdf('{"id":"C1"}')).toMatch(REGLAS_EMPAREJADO)
  })

  it('el compacto serializa marca y el texto no finge foto', () => {
    const json = textoDeCandidatosParaPrompt([
      {
        codigo: 'C1',
        descripcion: 'CODO 1/2',
        unidad: 'NIU',
        marca: 'Pavco',
        aliases: ['codo media'],
      },
    ])
    expect(json).toContain('"m":"Pavco"')
    expect(json).not.toMatch(/precio/)
    const prompt = promptDeAsistencia('texto', [
      {
        codigo: 'C1',
        descripcion: 'CODO 1/2',
        unidad: 'NIU',
        marca: 'Pavco',
      },
    ])
    expect(prompt).toMatch(/texto de requerimiento/)
    expect(prompt).not.toMatch(/fotografía/)
  })
})

describe('parsearAlineaciones', () => {
  it('un codigo fuera del catálogo pasa a no_en_catalogo sin aliases', () => {
    const filas = parsearAlineaciones(
      {
        alineaciones: [
          {
            textoPedido: 'codo de media',
            codigo: 'NOEXISTE',
            estado: 'emparejado',
            aliases: ['codo'],
            etiquetas: [],
          },
        ],
      },
      new Set(['C1']),
    )
    expect(filas[0]?.estado).toBe('no_en_catalogo')
    expect(filas[0]?.codigo).toBe('')
    expect(filas[0]?.aliases).toEqual([])
  })
})

describe('paresDesdePedido', () => {
  it('usa textoOriginal y no la descripción de catálogo', () => {
    expect(
      paresDesdePedido([
        {
          codigo: 'C1',
          descripcion: 'CODO FG 1/2 PAVCO',
          unidad: 'NIU',
          cantidad: 10,
          precio: 150,
          textoOriginal: 'codo de media',
        },
      ]),
    ).toEqual([
      {
        textoOriginal: 'codo de media',
        codigoAprobado: 'C1',
        descripcionAprobada: 'CODO FG 1/2 PAVCO',
      },
    ])
  })
})
