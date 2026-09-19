import { beforeAll, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Modal } from '../../../src/ui/componentes/Modal.tsx'

beforeAll(() => {
  if (typeof HTMLDialogElement.prototype.showModal !== 'function') {
    HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
      this.setAttribute('open', '')
    }
    HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
      this.removeAttribute('open')
      this.dispatchEvent(new Event('close'))
    }
  }
})

describe('Modal: icon button Cerrar', () => {
  it('muestra Cerrar y notifica al cerrar', async () => {
    const usuario = userEvent.setup()
    const alCambiar = vi.fn()
    render(
      <Modal abierta alCambiar={alCambiar} titulo="Fotografía original">
        <p>Guía</p>
      </Modal>,
    )

    const cerrar = screen.getByRole('button', { name: 'Cerrar' })
    await usuario.click(cerrar)
    expect(alCambiar).toHaveBeenCalledWith(false)
  })

  it('oculta Cerrar cuando no se cierra sola', () => {
    render(
      <Modal
        abierta
        alCambiar={() => undefined}
        titulo="Confirmar emisión"
        noSeCierraSola
      >
        <p>Elige</p>
      </Modal>,
    )

    expect(screen.queryByRole('button', { name: 'Cerrar' })).toBeNull()
  })
})
