import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  clasificarArchivo,
  formatearTamano,
  ZonaDeCarga,
} from '../../../src/ui/componentes/ZonaDeCarga.tsx'

describe('clasificarArchivo', () => {
  it('reconoce JSON por tipo o extensión', () => {
    expect(
      clasificarArchivo(
        new File(['{}'], 'tienda.json', { type: 'application/json' }),
      ),
    ).toBe('json')
    expect(
      clasificarArchivo(new File(['{}'], 'export.js', { type: '' })),
    ).toBe('json')
  })

  it('reconoce PDF por tipo o extensión', () => {
    expect(
      clasificarArchivo(
        new File(['%PDF'], 'lista.pdf', { type: 'application/pdf' }),
      ),
    ).toBe('pdf')
    expect(
      clasificarArchivo(new File(['%PDF'], 'precios.PDF', { type: '' })),
    ).toBe('pdf')
  })

  it('rechaza tipos ajenos', () => {
    expect(
      clasificarArchivo(
        new File(['x'], 'foto.png', { type: 'image/png' }),
      ),
    ).toBeNull()
  })
})

describe('formatearTamano', () => {
  it('usa B, KB y MB', () => {
    expect(formatearTamano(512)).toBe('512 B')
    expect(formatearTamano(2048)).toBe('2 KB')
    expect(formatearTamano(2.5 * 1024 * 1024)).toBe('2.5 MB')
  })
})

describe('ZonaDeCarga', () => {
  it('entrega el archivo elegido y anuncia el pozo vacío', async () => {
    const usuario = userEvent.setup()
    const onArchivo = vi.fn()
    render(
      <ZonaDeCarga
        titulo="Importar Productos"
        etiqueta="Archivo JSON o PDF"
        archivo={null}
        estado="vacio"
        mensaje={null}
        onArchivo={onArchivo}
        onQuitar={() => undefined}
      />,
    )

    expect(
      screen.getByRole('heading', { name: 'Importar Productos' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Elegir archivo' })).toBeInTheDocument()
    expect(screen.getByText('Suelta el JSON o el PDF')).toBeInTheDocument()

    const input = screen.getByLabelText('Archivo JSON o PDF')
    const archivo = new File(['{"productos":[]}'], 'tienda.json', {
      type: 'application/json',
    })
    await usuario.upload(input, archivo)

    expect(onArchivo).toHaveBeenCalledTimes(1)
    expect(onArchivo.mock.calls[0]?.[0]).toBeInstanceOf(File)
    expect((onArchivo.mock.calls[0]?.[0] as File).name).toBe('tienda.json')
  })

  it('rechaza un tipo que no es JSON ni PDF', () => {
    const onArchivo = vi.fn()
    render(
      <ZonaDeCarga
        etiqueta="Archivo JSON o PDF"
        archivo={null}
        estado="vacio"
        mensaje={null}
        onArchivo={onArchivo}
        onQuitar={() => undefined}
      />,
    )

    fireEvent.change(screen.getByLabelText('Archivo JSON o PDF'), {
      target: {
        files: [new File(['x'], 'foto.png', { type: 'image/png' })],
      },
    })

    expect(onArchivo).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Solo se aceptan JSON o PDF.')
  })

  it('en modo solo PDF rechaza un JSON', () => {
    const onArchivo = vi.fn()
    render(
      <ZonaDeCarga
        etiqueta="PDF de requerimiento"
        accept="application/pdf,.pdf"
        aceptados={['pdf']}
        archivo={null}
        estado="vacio"
        mensaje={null}
        onArchivo={onArchivo}
        onQuitar={() => undefined}
      />,
    )

    expect(screen.getByText('Suelta el PDF')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('PDF de requerimiento'), {
      target: {
        files: [
          new File(['{}'], 'tienda.json', { type: 'application/json' }),
        ],
      },
    })
    expect(onArchivo).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Solo se aceptan PDF.')
  })

  it('muestra la ficha, bloquea al procesar y permite quitar en listo', async () => {
    const usuario = userEvent.setup()
    const onQuitar = vi.fn()
    const archivo = {
      nombre: 'lista.pdf',
      bytes: 4096,
      clase: 'pdf' as const,
    }

    const { rerender } = render(
      <ZonaDeCarga
        etiqueta="Archivo JSON o PDF"
        archivo={archivo}
        estado="procesando"
        mensaje={null}
        onArchivo={() => undefined}
        onQuitar={onQuitar}
      />,
    )

    expect(screen.getByText('lista.pdf')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cambiar' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Quitar archivo' })).toBeDisabled()

    rerender(
      <ZonaDeCarga
        etiqueta="Archivo JSON o PDF"
        archivo={archivo}
        estado="listo"
        mensaje={null}
        onArchivo={() => undefined}
        onQuitar={onQuitar}
      />,
    )

    expect(screen.getByText(/listo para revisar/i)).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Quitar archivo' }))
    expect(onQuitar).toHaveBeenCalledTimes(1)
  })

  it('anuncia el error de validación junto al archivo', () => {
    render(
      <ZonaDeCarga
        etiqueta="Archivo JSON o PDF"
        archivo={{ nombre: 'roto.json', bytes: 12, clase: 'json' }}
        estado="error"
        mensaje="Falta el campo productos."
        onArchivo={() => undefined}
        onQuitar={() => undefined}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Falta el campo productos.',
    )
  })
})
