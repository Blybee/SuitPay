import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Package } from 'lucide-react'
import { Tarjeta } from '../../../src/ui/componentes/Tarjeta.tsx'

describe('Tarjeta', () => {
  it('muestra título, descripción e icono y no es un enlace', () => {
    const { container } = render(
      <Tarjeta
        titulo="Catálogo"
        descripcion="Importar productos."
        icono={Package}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Catálogo' })).toBeInTheDocument()
    expect(screen.getByText('Importar productos.')).toBeInTheDocument()
    expect(container.querySelector('svg')).not.toBeNull()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
