import { describe, expect, it } from 'vitest'
import { reconocer } from '../../../src/features/comandos/reconocer.ts'
import { OPERACIONES_DE_CONSULTA } from '../../../src/features/comandos/catalogo.ts'

/**
 * T144 / FR-048 / principio I: ninguna instrucción en lenguaje natural puede
 * crear, modificar, anular o dar de baja un comprobante. El intento indica
 * dónde se realiza esa operación.
 */

describe('frontera de comandos de solo consulta', () => {
  it('rechaza anular, emitir, eliminar y dar de baja un comprobante', () => {
    const casos = [
      '/anular F001-12',
      '/emitir',
      '/eliminar comprobante',
      '/dar de baja B001-1',
      'anula la boleta de hoy',
      'emite la factura',
      'eliminar el comprobante',
    ]

    for (const escrito of casos) {
      const resultado = reconocer(escrito)
      expect(resultado.tipo, escrito).toBe('escritura_prohibida')
      if (resultado.tipo === 'escritura_prohibida') {
        expect(resultado.donde.length).toBeGreaterThan(8)
        expect(resultado.mensaje).toMatch(/no se hace con una instrucción/i)
      }
    }
  })

  it('no incluye operaciones de comprobante en el catálogo de consulta', () => {
    const ids = OPERACIONES_DE_CONSULTA.map((o) => o.id)
    expect(ids).not.toContain('anular')
    expect(ids).not.toContain('emitir')
    expect(ids).not.toContain('crear-vecino')
  })

  it('reconoce consultas cerradas', () => {
    expect(reconocer('/cliente 20123456789').tipo).toBe('consulta')
    expect(reconocer('/cotizacion 12').tipo).toBe('consulta')
    expect(reconocer('/ayuda').tipo).toBe('consulta')
  })

  it('pide lo que falta en lugar de ejecutar', () => {
    const incompleto = reconocer('/cliente')
    expect(incompleto.tipo).toBe('incompleto')
    if (incompleto.tipo === 'incompleto') {
      expect(incompleto.faltantes).toEqual(['{DNI/RUC}'])
    }
  })
})
