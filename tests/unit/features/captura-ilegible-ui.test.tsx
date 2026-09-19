import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EstadoIlegible } from '../../../src/features/captura/ilegible.tsx'

describe('EstadoIlegible', () => {
  it('expone Otra foto y Escribir como botones', async () => {
    const usuario = userEvent.setup()
    const onReintentar = vi.fn()
    const onCerrar = vi.fn()
    render(
      <EstadoIlegible
        motivo="No se pudo leer la captura."
        onReintentar={onReintentar}
        onCerrar={onCerrar}
      />,
    )

    await usuario.click(screen.getByRole('button', { name: 'Otra foto' }))
    await usuario.click(screen.getByRole('button', { name: 'Escribir' }))
    expect(onReintentar).toHaveBeenCalledTimes(1)
    expect(onCerrar).toHaveBeenCalledTimes(1)
  })
})
