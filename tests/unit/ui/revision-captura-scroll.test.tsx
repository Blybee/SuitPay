import { afterEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RevisionCaptura } from '../../../src/ui/componentes/RevisionCaptura.tsx'
import { usarCaptura } from '../../../src/features/captura/estado.ts'

describe('RevisionCaptura layout', () => {
  afterEach(() => {
    usarCaptura.getState().cancelar()
  })
  it('el bloque de revisión es un flex scrolleable', () => {
    usarCaptura.setState({
      fase: 'revision',
      tipo: 'imagen',
      capturaId: 'c1',
      medioUrl: '',
      medioObjectUrl: null,
      lineas: [
        {
          textoOriginal: 'codo',
          candidatos: [],
          seleccion: null,
          estadoLinea: 'pendiente',
          cantidad: 1,
        },
      ],
      clientePropuesto: null,
      mensajeError: null,
      motivoIlegible: null,
    })
    render(
      <RevisionCaptura
        onAprobada={() => undefined}
        onDescartar={() => undefined}
      />,
    )
    const bloque = screen.getByTestId('revision-captura')
    expect(bloque.className).toMatch(/flex-1/)
    expect(bloque.className).toMatch(/min-h-0/)
  })
})
