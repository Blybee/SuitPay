import { describe, expect, it } from 'vitest'
import { esquemaDeBuscarCliente } from '../../../src/mcp/herramientas/consultas.ts'

describe('buscar_cliente', () => {
  it('rechaza un límite mayor que diez', () => {
    expect(esquemaDeBuscarCliente.safeParse({ termino: 'acme', limite: 10 }).success).toBe(
      true,
    )
    expect(esquemaDeBuscarCliente.safeParse({ termino: 'acme', limite: 11 }).success).toBe(
      false,
    )
  })
})
