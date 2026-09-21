import { describe, expect, it } from 'vitest'
import { textoPedidoVisible } from '../../../src/features/aprendizaje/entrenar.tsx'

describe('textoPedidoVisible', () => {
  it('cambia el guion inicial por el texto limpio', () => {
    expect(textoPedidoVisible('- Brida corta coflex')).toBe(
      'Brida corta coflex',
    )
    expect(textoPedidoVisible('• llave de paso')).toBe('llave de paso')
    expect(textoPedidoVisible('codo de media')).toBe('codo de media')
  })
})
