import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it } from 'vitest'
import { GrillaRevision } from '../../../src/features/catalogo/grilla-revision.tsx'
import type { Producto } from '../../../src/domain/esquemas/comunes.ts'

beforeAll(() => {
  Element.prototype.hasPointerCapture ??= () => false
  Element.prototype.setPointerCapture ??= () => undefined
  Element.prototype.releasePointerCapture ??= () => undefined
  Element.prototype.scrollIntoView ??= () => undefined
  class ObservadorFalso {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  globalThis.ResizeObserver = ObservadorFalso as unknown as typeof ResizeObserver
})

const categorias = [{ id: 'cat-valvulas', nombre: 'Válvulas' }] as const

function producto(
  cambios: Partial<Producto> & Pick<Producto, 'codigo'>,
): Producto {
  return {
    descripcion: 'CODO FG',
    unidad: 'NIU',
    precio: 100,
    activo: true,
    marca: 'Valmax',
    ...cambios,
  }
}

const BALANCE = {
  reconocidos: 2,
  nuevos: 0,
  cambiados: 0,
  desaparecen: 0,
  version: 1,
  publicado: true,
}

function GrillaMaestra({
  iniciales,
}: {
  readonly iniciales: readonly Producto[]
}) {
  const [productos, setProductos] = useState(iniciales)
  const [mostrarInactivos, setMostrarInactivos] = useState(false)
  return (
    <GrillaRevision
      productos={productos}
      categorias={categorias}
      balance={BALANCE}
      modo="maestro"
      mostrarInactivos={mostrarInactivos}
      onMostrarInactivos={setMostrarInactivos}
      onProductos={setProductos}
      onCategorias={() => undefined}
    />
  )
}

describe('GrillaRevision maestro', () => {
  it('filtra por marca en la lista maestra', async () => {
    const usuario = userEvent.setup()
    render(
      <GrillaMaestra
        iniciales={[
          producto({ codigo: 'A', marca: 'Valmax' }),
          producto({ codigo: 'B', marca: 'Fipalsa', descripcion: 'TEE FG' }),
        ]}
      />,
    )

    await usuario.click(screen.getByRole('combobox', { name: 'Filtrar marca' }))
    await usuario.click(screen.getByRole('option', { name: 'Valmax' }))

    expect(screen.getByLabelText('Código A')).toBeInTheDocument()
    expect(screen.queryByLabelText('Código B')).not.toBeInTheDocument()
  })

  it('la baja lógica oculta el producto hasta mostrar inactivos', async () => {
    const usuario = userEvent.setup()
    render(
      <GrillaMaestra
        iniciales={[
          producto({ codigo: 'A' }),
          producto({ codigo: 'B', descripcion: 'TEE FG' }),
        ]}
      />,
    )

    await usuario.click(screen.getByLabelText('Seleccionar A'))
    await usuario.click(screen.getByRole('button', { name: /Dar de baja/ }))

    expect(screen.queryByLabelText('Código A')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Código B')).toBeInTheDocument()

    await usuario.click(screen.getByLabelText('Mostrar inactivos'))
    expect(screen.getByLabelText('Código A')).toBeInTheDocument()
  })

  it('un código duplicado se marca en la fila', () => {
    render(
      <GrillaMaestra
        iniciales={[
          producto({ codigo: 'A' }),
          producto({ codigo: 'A', descripcion: 'OTRO' }),
        ]}
      />,
    )

    expect(screen.getAllByText(/aparece 2 veces/i).length).toBeGreaterThan(0)
  })

  it('muestra la descripción completa y no el distintivo de versión', () => {
    const descripcion =
      'AQUATO- DESAGUE P/LAVAT C/REBOSE 1 1/4" X 12" T/GRANDE'
    render(
      <GrillaMaestra
        iniciales={[producto({ codigo: 'AQ-25009', descripcion })]}
      />,
    )

    expect(screen.getByLabelText('Descripción AQ-25009')).toHaveValue(
      descripcion,
    )
    expect(screen.queryByText(/versión/i)).not.toBeInTheDocument()
  })

  it('el tacho saca el producto de la lista, no solo lo inactiva', async () => {
    const usuario = userEvent.setup()
    render(
      <GrillaMaestra
        iniciales={[
          producto({ codigo: 'A' }),
          producto({ codigo: 'B', descripcion: 'TEE FG' }),
        ]}
      />,
    )

    await usuario.click(screen.getByLabelText('Seleccionar A'))
    await usuario.click(
      screen.getByRole('button', { name: 'Eliminar 1 producto de la lista' }),
    )

    expect(screen.queryByLabelText('Código A')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Código B')).toBeInTheDocument()

    await usuario.click(screen.getByLabelText('Mostrar inactivos'))
    expect(screen.queryByLabelText('Código A')).not.toBeInTheDocument()
  })

  it('el tacho y la cantidad son círculos de 44px, no cápsulas', () => {
    render(
      <GrillaMaestra
        iniciales={[producto({ codigo: 'A', categoriaId: 'cat-valvulas' })]}
      />,
    )

    const tacho = screen.getByRole('button', {
      name: 'Eliminar 0 productos de la lista',
    })
    const cantidad = screen.getByRole('button', {
      name: 'Cantidad orientativa de A',
    })
    expect(tacho.className).toContain('size-11')
    expect(tacho.className).toContain('p-0')
    expect(cantidad.className).toContain('size-11')
    expect(cantidad.className).toContain('p-0')
    expect(screen.getByRole('columnheader', { name: 'Categoría' })).toBeInTheDocument()
  })
})
