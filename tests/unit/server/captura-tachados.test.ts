import { describe, expect, it, afterEach } from 'vitest'
import { interpretarCaptura } from '../../../src/server/asistencia/interpretar.ts'
import { fijarModoSimulado } from '../../../src/server/asistencia/simulado.ts'

describe('renglones tachados / no interpretados (T130)', () => {
  afterEach(() => {
    fijarModoSimulado('exito')
  })

  it('marca pendientes los renglones no interpretados y no descarta ninguno', async () => {
    fijarModoSimulado('con_pendientes')

    const resultado = await interpretarCaptura(
      {
        tipo: 'imagen',
        medioUrl: 'capturas/v1/guia.jpg',
        candidatos: [
          { codigo: 'C1', descripcion: 'CODO FG 1/2', unidad: 'NIU' },
          { codigo: 'T1', descripcion: 'TEE FG 1/2', unidad: 'NIU' },
        ],
        vendedorId: 'v1',
      },
      {
        forzarSimulado: true,
        leerMedio: async () => ({
          mimeType: 'image/jpeg',
          dataBase64: 'Z3VpYQ==',
        }),
        persistir: async () => {},
        idCaptura: () => 'cap-test-1',
      },
    )

    expect(resultado.lineas.length).toBe(2)
    expect(resultado.lineas[0]?.estadoLinea).toBe('resuelta')
    expect(resultado.lineas[1]?.estadoLinea).toBe('pendiente')
    expect(resultado.lineas[1]?.textoOriginal).toContain('ilegible')
    // Ninguno omitido: ambos renglones del modelo están presentes.
    expect(resultado.lineas.every((l) => l.textoOriginal.length > 0)).toBe(true)
  })
})
