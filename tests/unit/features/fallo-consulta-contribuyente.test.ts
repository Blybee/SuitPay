import { describe, expect, it } from 'vitest'
import { respuestaDeFalloDeConsulta } from '../../../src/features/clientes/fallo-consulta.ts'
import { ErrorDeSuitPay } from '../../../src/server/errores.ts'

describe('respuestaDeFalloDeConsulta', () => {
  it('propaga ErrorDeSuitPay sin convertirlo en 500 lógico', () => {
    const error = new ErrorDeSuitPay('servicio_no_disponible')
    const respuesta = respuestaDeFalloDeConsulta(error)
    expect(respuesta.ok).toBe(false)
    expect(respuesta.error?.codigo).toBe('servicio_no_disponible')
  })

  it('mapea token/URL ausentes a servicio_no_disponible', () => {
    const respuesta = respuestaDeFalloDeConsulta(
      new Error('Falta PROVEEDOR_TOKEN'),
    )
    expect(respuesta.ok).toBe(false)
    expect(respuesta.error?.codigo).toBe('servicio_no_disponible')
  })

  it('mapea fallos inesperados de consulta a servicio_no_disponible (FR-026)', () => {
    const respuesta = respuestaDeFalloDeConsulta(new TypeError('Failed to fetch'))
    expect(respuesta.ok).toBe(false)
    expect(respuesta.error?.codigo).toBe('servicio_no_disponible')
  })

  it('credenciales rechazadas siguen siendo servicio_no_disponible', () => {
    const respuesta = respuestaDeFalloDeConsulta(
      new ErrorDeSuitPay('servicio_no_disponible'),
    )
    expect(respuesta.error?.reintentable).toBe(true)
  })
})
