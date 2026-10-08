import { describe, expect, it } from 'vitest'
import { mensajeDeFalloAlGuardar } from '../../../src/features/catalogo/mensaje-guardado.ts'

describe('mensajeDeFalloAlGuardar', () => {
  it('agrega el motivo del detalle', () => {
    expect(
      mensajeDeFalloAlGuardar({
        mensaje: 'No se pudo interpretar el archivo. Revisa su formato.',
        detalle: {
          motivo: 'precio: Los importes se manejan en céntimos enteros',
        },
      }),
    ).toBe(
      'No se pudo interpretar el archivo. Revisa su formato. Motivo: precio: Los importes se manejan en céntimos enteros.',
    )
  })

  it('sin motivo deja el mensaje', () => {
    expect(mensajeDeFalloAlGuardar({ mensaje: 'Ocurrió un fallo.' })).toBe(
      'Ocurrió un fallo.',
    )
  })
})
