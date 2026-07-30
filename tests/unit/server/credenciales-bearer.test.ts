import { describe, expect, it } from 'vitest'
import { credencialesDesdeEncabezados } from '../../../src/server/auth/verificar.ts'

describe('credencialesDesdeEncabezados', () => {
  it('extrae el token Bearer', () => {
    const encabezados = new Headers({
      Authorization: 'Bearer token-de-prueba',
    })
    expect(credencialesDesdeEncabezados(encabezados).tokenDeSesion).toBe(
      'token-de-prueba',
    )
  })

  it('acepta authorization en minúsculas', () => {
    const encabezados = new Headers({
      authorization: 'bearer otro-token',
    })
    expect(credencialesDesdeEncabezados(encabezados).tokenDeSesion).toBe(
      'otro-token',
    )
  })

  it('sin encabezado deja el token ausente', () => {
    expect(credencialesDesdeEncabezados(new Headers()).tokenDeSesion).toBe(
      undefined,
    )
  })

  it('Bearer vacío se trata como ausente', () => {
    const encabezados = new Headers({ Authorization: 'Bearer ' })
    expect(credencialesDesdeEncabezados(encabezados).tokenDeSesion).toBe(
      undefined,
    )
  })
})
