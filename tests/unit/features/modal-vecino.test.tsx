import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ModalDeVecino } from '../../../src/features/vecinos/modal.tsx'
import type { Cotizacion } from '../../../src/features/cotizaciones/tipos.ts'

const { persistirDatosDeVecino } = vi.hoisted(() => ({
  persistirDatosDeVecino: vi.fn(),
}))

vi.mock('../../../src/features/vecinos/datos.ts', () => ({
  persistirDatosDeVecino,
  eliminarCotizacionVecino: vi.fn(),
}))

function vecinoDePrueba(): Cotizacion {
  return {
    id: 'cot-wilmer',
    numero: 12,
    estado: 'pendiente',
    canal: 'vecino',
    aliasVecino: 'wilmer',
    telefonoVecino: '987654321',
    cliente: {
      tipoDocumento: 'RUC',
      numeroDocumento: '20123456789',
      denominacion: 'Ferretería Wilmer',
    },
    lineas: [],
    total: 0,
    creadoPor: 'u1',
    creadoEn: new Date('2026-08-27T12:00:00Z'),
    actualizadoEn: null,
  }
}

beforeAll(() => {
  if (typeof HTMLDialogElement.prototype.showModal !== 'function') {
    HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
      this.setAttribute('open', '')
    }
    HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
      this.removeAttribute('open')
    }
  }
})

describe('ModalDeVecino', () => {
  beforeEach(() => {
    persistirDatosDeVecino.mockReset()
    persistirDatosDeVecino.mockResolvedValue({ ok: true })
  })
  it('en Editar vecino muestra DNI/RUC y guarda el teléfono sin reasignar cliente', async () => {
    const usuario = userEvent.setup()
    const onCrear = vi.fn()

    render(
      <ModalDeVecino
        abierta
        onCerrar={() => undefined}
        vecinos={[vecinoDePrueba()]}
        creando={false}
        onCrear={onCrear}
        onRefrescar={() => undefined}
      />,
    )

    await usuario.click(screen.getByRole('button', { name: 'Ver todos' }))
    await usuario.click(screen.getByRole('button', { name: 'Editar wilmer' }))

    expect(screen.getByRole('textbox', { name: 'RUC' })).toHaveValue(
      '20123456789',
    )
    expect(screen.getByRole('combobox', { name: 'Documento' })).toHaveValue(
      'RUC',
    )

    const telefono = screen.getByRole('textbox', { name: 'Teléfono' })
    await usuario.clear(telefono)
    await usuario.type(telefono, '912345678')
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(onCrear).not.toHaveBeenCalled()
    expect(persistirDatosDeVecino).toHaveBeenCalledWith({
      cotizacionId: 'cot-wilmer',
      alias: 'wilmer',
      telefono: '912345678',
    })
  })

  it('si cambia el RUC pide reasignar el cliente en lugar de persistir solo', async () => {
    const usuario = userEvent.setup()
    const onCrear = vi.fn()

    render(
      <ModalDeVecino
        abierta
        onCerrar={() => undefined}
        vecinos={[vecinoDePrueba()]}
        creando={false}
        onCrear={onCrear}
        onRefrescar={() => undefined}
      />,
    )

    await usuario.click(screen.getByRole('button', { name: 'Ver todos' }))
    await usuario.click(screen.getByRole('button', { name: 'Editar wilmer' }))

    const ruc = screen.getByRole('textbox', { name: 'RUC' })
    await usuario.clear(ruc)
    await usuario.type(ruc, '20987654321')
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(persistirDatosDeVecino).not.toHaveBeenCalled()
    expect(onCrear).toHaveBeenCalledWith({
      alias: 'wilmer',
      numeroDocumento: '20987654321',
      tipoDocumento: 'RUC',
      cotizacionId: 'cot-wilmer',
      telefono: '987654321',
    })
  })
})
