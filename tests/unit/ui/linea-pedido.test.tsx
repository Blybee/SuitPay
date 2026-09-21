import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LineaPedido } from '../../../src/ui/componentes/LineaPedido.tsx'
import type { LineaDePedido } from '../../../src/domain/totales/calculo.ts'

const linea: LineaDePedido = {
  codigo: 'ABC',
  descripcion: 'Codo liviano',
  unidad: 'NIU',
  cantidad: 1,
  precio: 250,
}

describe('LineaPedido', () => {
  it('resalta la fila ya presente y lleva el scroll a la más cercana', () => {
    const scrollIntoView = vi.fn()
    HTMLElement.prototype.scrollIntoView = scrollIntoView

    render(
      <ul>
        <LineaPedido
          linea={linea}
          indice={0}
          precioDeCatalogo={250}
          onCambiarCantidad={() => undefined}
          onCambiarPrecio={() => undefined}
          onQuitar={() => undefined}
          resaltar
          senal={1}
        />
      </ul>,
    )

    expect(screen.getByRole('listitem')).toHaveClass('t-resalte-fila')
    expect(screen.getByText('Codo liviano')).toHaveClass('t-shimmer')
    expect(scrollIntoView).toHaveBeenCalledWith({
      block: 'nearest',
      inline: 'nearest',
    })
  })

  it('apaga el shimmer al terminar los barridos del texto', () => {
    vi.useFakeTimers()
    try {
      const onFinResalte = vi.fn()

      render(
        <ul>
          <LineaPedido
            linea={linea}
            indice={0}
            precioDeCatalogo={250}
            onCambiarCantidad={() => undefined}
            onCambiarPrecio={() => undefined}
            onQuitar={() => undefined}
            resaltar
            senal={1}
            onFinResalte={onFinResalte}
          />
        </ul>,
      )

      act(() => {
        vi.advanceTimersByTime(700 * 3)
      })
      expect(onFinResalte).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('enfoca cantidad al agregar un producto nuevo', () => {
    render(
      <ul>
        <LineaPedido
          linea={linea}
          indice={0}
          precioDeCatalogo={250}
          onCambiarCantidad={() => undefined}
          onCambiarPrecio={() => undefined}
          onQuitar={() => undefined}
          enfocarCantidad
          senal={1}
        />
      </ul>,
    )

    expect(screen.getByLabelText('Cantidad de Codo liviano')).toHaveFocus()
  })

  it('muestra el aviso orientativo sin bloquear la fila', () => {
    render(
      <ul>
        <LineaPedido
          linea={linea}
          indice={0}
          precioDeCatalogo={250}
          onCambiarCantidad={() => undefined}
          onCambiarPrecio={() => undefined}
          onQuitar={() => undefined}
          avisoInventario="Cifra orientativa en 0. Se puede emitir."
        />
      </ul>,
    )

    expect(
      screen.getByText('Cifra orientativa en 0. Se puede emitir.'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Cantidad de Codo liviano')).toBeEnabled()
  })

  it('marca como aviso un descuento dentro del 30 % sin invalidar el campo', () => {
    render(
      <ul>
        <LineaPedido
          linea={{ ...linea, precio: 200 }}
          indice={0}
          precioDeCatalogo={250}
          onCambiarCantidad={() => undefined}
          onCambiarPrecio={() => undefined}
          onQuitar={() => undefined}
        />
      </ul>,
    )

    expect(screen.getByText(/por debajo del mayorista/i)).toBeInTheDocument()
    expect(screen.getByRole('listitem')).toHaveClass('bg-aviso/5')
    expect(screen.getByLabelText('Precio de Codo liviano')).not.toHaveAttribute(
      'aria-invalid',
    )
  })

  it('invalida el campo si el descuento supera el 30 %', () => {
    render(
      <ul>
        <LineaPedido
          linea={{ ...linea, precio: 150 }}
          indice={0}
          precioDeCatalogo={250}
          onCambiarCantidad={() => undefined}
          onCambiarPrecio={() => undefined}
          onQuitar={() => undefined}
        />
      </ul>,
    )

    expect(screen.getByText(/por debajo del mayorista/i)).toBeInTheDocument()
    expect(
      screen.queryByText(/más de 30 % bajo el mayorista/i),
    ).not.toBeInTheDocument()
    expect(screen.getByLabelText('Precio de Codo liviano')).toHaveAttribute(
      'aria-invalid',
      'true',
    )
  })

  it('muestra el nombre completo sin truncar', () => {
    const largo =
      'AQUATO- DIAFRAGMA BLANCO AQ-22030 PARA TANQUE DE AGUA DE USO DOMESTICO'

    render(
      <ul>
        <LineaPedido
          linea={{ ...linea, descripcion: largo }}
          indice={0}
          precioDeCatalogo={250}
          onCambiarCantidad={() => undefined}
          onCambiarPrecio={() => undefined}
          onQuitar={() => undefined}
        />
      </ul>,
    )

    const nombre = screen.getByText(largo)
    expect(nombre).toBeInTheDocument()
    expect(nombre).not.toHaveClass('truncate')
    expect(nombre).toHaveClass('break-words')
    expect(screen.getByRole('listitem')).toHaveClass('items-center')
  })
})
