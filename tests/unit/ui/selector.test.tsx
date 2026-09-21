import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it } from 'vitest'
import { Selector } from '../../../src/ui/componentes/Selector.tsx'

beforeAll(() => {
  Element.prototype.hasPointerCapture ??= () => false
  Element.prototype.setPointerCapture ??= () => undefined
  Element.prototype.releasePointerCapture ??= () => undefined
  Element.prototype.scrollIntoView ??= () => undefined
})

function SelectorDePrueba() {
  const [valor, setValor] = useState('')
  return (
    <Selector
      etiqueta="Marca"
      valor={valor}
      onCambiar={setValor}
      opciones={[
        { valor: '', etiqueta: 'Todas' },
        { valor: 'ACME', etiqueta: 'ACME' },
      ]}
    />
  )
}

describe('Selector', () => {
  it('abre el listbox y permite elegir con el control personalizado', async () => {
    const usuario = userEvent.setup()
    render(<SelectorDePrueba />)

    const trigger = screen.getByRole('combobox', { name: 'Marca' })
    expect(trigger).toHaveValue('')

    await usuario.click(trigger)
    await usuario.click(screen.getByRole('option', { name: 'ACME' }))

    expect(trigger).toHaveValue('ACME')
    expect(trigger).toHaveTextContent('ACME')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('el trigger usa etiquetaCorta debajo de md y la etiqueta larga en el listbox', async () => {
    const usuario = userEvent.setup()
    function ConCorta() {
      const [valor, setValor] = useState('factura')
      return (
        <Selector
          etiqueta="Tipo"
          ocultarEtiqueta
          valor={valor}
          onCambiar={setValor}
          opciones={[
            {
              valor: 'factura',
              etiqueta: 'Factura · F001',
              etiquetaCorta: 'Fact',
            },
          ]}
        />
      )
    }
    render(<ConCorta />)

    const trigger = screen.getByRole('combobox', { name: 'Tipo' })
    expect(screen.getByText('Fact')).toHaveClass('md:hidden')
    expect(screen.getByText('Factura · F001')).toHaveClass('hidden', 'md:inline')

    await usuario.click(trigger)
    expect(screen.getByRole('option', { name: 'Factura · F001' })).toBeVisible()
  })
})
