import { beforeAll, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GrillaRevision } from '../../../src/features/catalogo/grilla-revision.tsx'
import type { Producto } from '../../../src/domain/esquemas/comunes.ts'

const balance = {
  reconocidos: 2,
  nuevos: 2,
  cambiados: 0,
  desaparecen: 0,
  version: null,
  publicado: false,
}

function producto(
  parcial: Partial<Producto> & Pick<Producto, 'codigo'>,
): Producto {
  return {
    descripcion: parcial.descripcion ?? `Producto ${parcial.codigo}`,
    unidad: parcial.unidad ?? 'NIU',
    precio: parcial.precio ?? 100,
    activo: parcial.activo ?? true,
    marca: parcial.marca ?? 'AB',
    codigo: parcial.codigo,
  }
}

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  )
})

describe('GrillaRevision', () => {
  it('pinta la fila con problema y el callout; el filtro deja solo esas filas', async () => {
    const usuario = userEvent.setup()
    render(
      <GrillaRevision
        productos={[
          producto({ codigo: 'OK-1', descripcion: 'Llave allen', unidad: 'NIU' }),
          producto({
            codigo: 'MAL-1',
            descripcion: 'Rollo suelto',
            unidad: 'ROLLO',
          }),
        ]}
        categorias={[]}
        balance={balance}
        onProductos={vi.fn()}
        onCategorias={vi.fn()}
      />,
    )

    expect(screen.getByText('reconocidos')).toBeInTheDocument()
    expect(screen.getByText('con problema')).toBeInTheDocument()
    expect(screen.getByText('Unidad «ROLLO» no reconocida.')).toBeInTheDocument()
    expect(screen.getByLabelText('Código OK-1')).toBeInTheDocument()

    const filtro = screen.getByRole('button', { name: /Con problemas/ })
    expect(filtro).toHaveAttribute('aria-pressed', 'false')
    await usuario.click(filtro)

    expect(filtro).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByLabelText('Código OK-1')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Código MAL-1')).toBeInTheDocument()
    expect(screen.getByText('Unidad «ROLLO» no reconocida.')).toBeInTheDocument()
  })
})
