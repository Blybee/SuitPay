import { describe, expect, it } from 'vitest'
import {
  TIPOS_DE_DOCUMENTO,
  TIPOS_ELEGIBLES,
  consumeSerieRegulada,
  estadoEsAnulable,
  etiquetaDeAdvertencia,
  serieEsValida,
  tieneValorTributario,
} from '#/domain/documentos/tipos.ts'

describe('valor tributario', () => {
  it('boleta y factura existen ante la autoridad', () => {
    expect(tieneValorTributario('boleta')).toBe(true)
    expect(tieneValorTributario('factura')).toBe(true)
  })

  it('nota de venta y documento interno no', () => {
    expect(tieneValorTributario('nota_venta')).toBe(false)
    expect(tieneValorTributario('interno_contingencia')).toBe(false)
  })
})

describe('todo documento sin valor tributario lo declara', () => {
  it('los que sí valen no llevan etiqueta', () => {
    expect(etiquetaDeAdvertencia('boleta')).toBeNull()
    expect(etiquetaDeAdvertencia('factura')).toBeNull()
  })

  it('los que no valen llevan siempre una etiqueta', () => {
    // La etiqueta viaja con el tipo y no la decide cada pantalla, para que no
    // haya ninguna superficie donde alguien olvide ponerla. La especificación
    // exige que estos documentos se distingan sin margen de duda de una factura.
    for (const tipo of TIPOS_DE_DOCUMENTO) {
      if (!tieneValorTributario(tipo)) {
        expect(etiquetaDeAdvertencia(tipo)).toBeTruthy()
      }
    }
  })

  it('el documento interno además anuncia que falta el comprobante', () => {
    expect(etiquetaDeAdvertencia('interno_contingencia')).toContain('PENDIENTE')
  })
})

describe('consumo de series reguladas', () => {
  it('solo consumen serie los documentos con valor tributario', () => {
    for (const tipo of TIPOS_DE_DOCUMENTO) {
      if (consumeSerieRegulada(tipo)) {
        expect(tieneValorTributario(tipo)).toBe(true)
      }
    }
  })

  it('el documento interno NO consume correlativo regulado', () => {
    // Gastar numeración regulada en un papel que no existe ante SUNAT abriría un
    // hueco en la secuencia que después habría que justificar.
    expect(consumeSerieRegulada('interno_contingencia')).toBe(false)
  })
})

describe('validez de la serie', () => {
  it('exige el prefijo del tipo', () => {
    expect(serieEsValida('boleta', 'B001')).toBe(true)
    expect(serieEsValida('boleta', 'F001')).toBe(false)
    expect(serieEsValida('factura', 'F001')).toBe(true)
    expect(serieEsValida('factura', 'B001')).toBe(false)
  })

  it('no admite más de cuatro caracteres', () => {
    expect(serieEsValida('boleta', 'B0001')).toBe(false)
  })

  it('no admite serie vacía en un documento que la exige', () => {
    expect(serieEsValida('boleta', '')).toBe(false)
  })

  it('exige serie vacía en un documento que no la consume', () => {
    expect(serieEsValida('interno_contingencia', '')).toBe(true)
    expect(serieEsValida('interno_contingencia', 'B001')).toBe(false)
  })
})

describe('lo que el vendedor puede elegir', () => {
  it('el documento interno no se elige, lo ofrece el sistema', () => {
    // No es una omisión: aparece cuando el proveedor no responde, y ofrecerlo
    // como opción normal invitaría a usarlo para evitar el comprobante real.
    expect(TIPOS_ELEGIBLES).not.toContain('interno_contingencia')
  })
})

describe('qué estados admiten anulación', () => {
  it('solo un comprobante aceptado', () => {
    expect(estadoEsAnulable('aceptado')).toBe(true)
  })

  it('ninguno de los demás', () => {
    for (const estado of [
      'reclamado',
      'enviado',
      'rechazado',
      'indeterminado',
      'pendiente',
      'anulado',
      'requiere_intervencion',
    ] as const) {
      expect(estadoEsAnulable(estado)).toBe(false)
    }
  })
})
