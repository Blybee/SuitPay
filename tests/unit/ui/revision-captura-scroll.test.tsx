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

  it('marca la línea ambigua sin lavado rojo y con candidatos cápsula', () => {
    usarCaptura.setState({
      fase: 'revision',
      tipo: 'imagen',
      capturaId: 'c1',
      medioUrl: '',
      medioObjectUrl: null,
      lineas: [
        {
          textoOriginal: 'codo',
          candidatos: [
            {
              codigo: 'C001',
              descripcion: 'CODO FG 1/2',
              unidad: 'NIU',
              cantidad: 1,
              grado: 'aproximada',
            },
          ],
          seleccion: null,
          estadoLinea: 'ambigua',
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
    const fila = screen.getByTestId('linea-captura-0')
    expect(fila.className).toMatch(/border-l-aviso/)
    expect(fila.className).not.toMatch(/bg-aviso/)
    expect(screen.getByText('Elige un candidato')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Buscar otro producto' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Quitar codo de la revisión' }),
    ).toBeInTheDocument()
    const candidato = screen.getByRole('button', { name: /CODO FG 1\/2/ })
    expect(candidato.className).toMatch(/rounded-2xl/)
    expect(candidato.className).toMatch(/bg-papel/)
    expect(candidato.className).not.toMatch(/text-aviso/)
  })
})
