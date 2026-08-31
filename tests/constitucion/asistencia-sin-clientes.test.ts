import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  construirPayloadDeAsistencia,
  payloadContieneDatosDeCliente,
} from '../../src/server/asistencia/payload.ts'

/**
 * T153 / SC-012 / principio IV: la única función que habla con asistencia
 * no incluye datos identificatorios de cliente.
 */

const RAIZ = join(import.meta.dirname, '../..')

describe('principio IV — asistencia sin clientes', () => {
  it('el payload construido no lleva PII de cliente', () => {
    const payload = construirPayloadDeAsistencia({
      tipo: 'audio',
      medio: { mimeType: 'audio/webm', dataBase64: 'YWJj' },
      candidatos: [
        { codigo: 'C1', descripcion: 'CODO FG 1/2', unidad: 'NIU' },
      ],
    })

    expect(payloadContieneDatosDeCliente(payload)).toBe(false)
    const serializado = JSON.stringify(payload)
    for (const prohibido of [
      'razonSocial',
      'numeroDocumento',
      'denominacion',
      'telefono',
      'correo',
      'historial',
    ]) {
      expect(serializado).not.toContain(prohibido)
    }
  })

  it('interpretar.ts no reenvía campos de cliente al modelo', () => {
    const fuente = readFileSync(
      join(RAIZ, 'src/server/asistencia/interpretar.ts'),
      'utf8',
    )
    expect(fuente).toMatch(/construirPayloadDeAsistencia/)
    expect(fuente).not.toMatch(/razonSocial/)
    expect(fuente).not.toMatch(/numeroDocumento/)
    expect(fuente).not.toMatch(/peticion\.cliente/)
  })

  it('extraer-pdf no envía colección clientes ni precios', () => {
    const fuente = readFileSync(
      join(RAIZ, 'src/server/asistencia/extraer-pdf.ts'),
      'utf8',
    )
    expect(fuente).not.toMatch(/COLECCIONES\.clientes/)
    expect(fuente).not.toMatch(/\bprecio\b/)
    expect(fuente).toMatch(/application\/pdf/)
    expect(fuente).toMatch(/catalogo-compacto/)
  })

  it('el catálogo compacto no lleva precio ni ficha de cliente', () => {
    const fuente = readFileSync(
      join(RAIZ, 'src/domain/aprendizaje/compacto.ts'),
      'utf8',
    )
    expect(fuente).not.toMatch(/readonly precio/)
    expect(fuente).not.toMatch(/razonSocial/)
    expect(fuente).not.toMatch(/COLECCIONES\.clientes/)
  })

  it('el requerimiento anonimiza notas y no manda razón social al modelo', () => {
    const fuente = readFileSync(
      join(RAIZ, 'src/server/asistencia/requerimiento.ts'),
      'utf8',
    )
    expect(fuente).toMatch(/anonimizarNotas/)
    expect(fuente).not.toMatch(/razonSocial/)
    expect(fuente).not.toMatch(/denominacion/)
  })
})
