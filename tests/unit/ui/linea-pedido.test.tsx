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
})
