import { describe, expect, it } from 'vitest'
import { textoDeCandidatosParaPrompt } from '../../../src/server/asistencia/payload.ts'
import { promptDeAsistencia, REGLAS_EMPAREJADO } from '../../../src/server/asistencia/prompts.ts'
import { promptDeListaPdf } from '../../../src/server/asistencia/prompts-pdf.ts'
import { parsearAlineaciones, exigirLado } from '../../../src/server/aprendizaje/entrenar-par.ts'
import { promptDeEntrenamiento } from '../../../src/server/aprendizaje/prompts-entrenamiento.ts'
import { MAX_MEDIOS_ENTRENAMIENTO } from '../../../src/domain/aprendizaje/medios.ts'
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

describe('exigirLado', () => {
  const jpeg = { mimeType: 'image/jpeg', dataBase64: 'YQ==' }

  it('acepta varias imágenes en el pedido', () => {
    expect(() =>
      exigirLado(
        {
          medios: [jpeg, { mimeType: 'image/png', dataBase64: 'Yg==' }],
        },
        'pedido',
      ),
    ).not.toThrow()
  })

  it('rechaza un lado sin texto ni archivos', () => {
    try {
      exigirLado({}, 'pedido')
      expect.unreachable()
    } catch (error) {
      expect(error).toMatchObject({
        codigo: 'peticion_invalida',
        detalle: { motivo: 'sin_pedido' },
      })
    }
  })

  it('rechaza más archivos que el techo', () => {
    const medios = Array.from({ length: MAX_MEDIOS_ENTRENAMIENTO + 1 }, () => jpeg)
    try {
      exigirLado({ medios }, 'pedido')
      expect.unreachable()
    } catch (error) {
      expect(error).toMatchObject({
        codigo: 'peticion_invalida',
        detalle: { motivo: 'demasiados_archivos' },
      })
    }
  })
})

describe('prompt de entrenamiento', () => {
  it('trata varias fotos como un mismo pedido', () => {
    const texto = promptDeEntrenamiento({
      catalogoJson: '[]',
      memoriaJson: '{}',
      prioresJson: '{}',
      archivosPedido: 3,
      archivosOro: 1,
    })
    expect(texto).toMatch(/varias fotos/)
    expect(texto).toMatch(/MISMO requerimiento/)
    expect(texto).toMatch(/PEDIDO \(3\)/)
    expect(texto).not.toMatch(/primer archivo\/imagen/)
  })
})
