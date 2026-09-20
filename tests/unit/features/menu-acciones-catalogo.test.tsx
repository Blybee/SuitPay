import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { MenuAccionesCatalogo } from '../../../src/features/catalogo/menu-acciones.tsx'

describe('MenuAccionesCatalogo', () => {
  it('abre el overflow menu y lista las acciones', async () => {
    const usuario = userEvent.setup()
    render(
      <MenuAccionesCatalogo>
        <button type="button">Importar</button>
        <button type="button">Compras</button>
      </MenuAccionesCatalogo>,
    )

    const panel = screen.getByTestId('menu-acciones-catalogo-panel')
    expect(panel.getAttribute('data-open')).toBeNull()
    await usuario.click(screen.getByTestId('menu-acciones-catalogo'))
    expect(panel.getAttribute('data-open')).toBe('true')
    expect(screen.getByRole('button', { name: 'Importar' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Compras' })).toBeTruthy()
  })
})
