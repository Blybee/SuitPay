import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DestinoDeNota, Nota } from '../../../src/ui/componentes/Nota.tsx'

describe('Nota', () => {
  it('presenta las papeletas de origen como nota, no como alerta', () => {
    render(
      <Nota linea="Encuentra los archivos en:">
        <DestinoDeNota origen="Tienda virtual" formato="JSON" />
        <DestinoDeNota origen="SICO" formato="PDF" />
      </Nota>,
    )

    expect(screen.getByRole('note')).toBeInTheDocument()
    expect(screen.getByText('Encuentra los archivos en:')).toBeInTheDocument()
    expect(screen.getByText('Tienda virtual')).toBeInTheDocument()
    expect(screen.getByText('SICO')).toBeInTheDocument()
    expect(screen.getByText('JSON')).toBeInTheDocument()
    expect(screen.getByText('PDF')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
