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

  it('reconoce imagen por tipo o extensión', () => {
    expect(
      clasificarArchivo(
        new File(['x'], 'foto.png', { type: 'image/png' }),
      ),
    ).toBe('imagen')
    expect(
      clasificarArchivo(new File(['x'], 'scan.WEBP', { type: '' })),
    ).toBe('imagen')
  })

  it('rechaza tipos ajenos', () => {
    expect(
      clasificarArchivo(
        new File(['x'], 'nota.txt', { type: 'text/plain' }),
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

  it('en modo multiple entrega todas las imágenes elegidas', async () => {
    const usuario = userEvent.setup()
    const onArchivos = vi.fn()
    render(
      <ZonaDeCarga
        multiple
        titulo="Pedido del cliente"
        etiqueta="PDF o imágenes del pedido"
        accept="image/jpeg,image/png,.jpg,.jpeg,.png"
        aceptados={['pdf', 'imagen']}
        archivos={[]}
        estado="vacio"
        mensaje={null}
        onArchivos={onArchivos}
        onQuitar={() => undefined}
      />,
    )

    expect(screen.getByRole('button', { name: 'Elegir archivos' })).toBeInTheDocument()
    expect(screen.getByText('Suelta el PDF o las imágenes')).toBeInTheDocument()

    const input = screen.getByLabelText('PDF o imágenes del pedido')
    await usuario.upload(input, [
      new File(['aaa'], 'pedido-1.png', { type: 'image/png' }),
      new File(['bbb'], 'pedido-2.jpg', { type: 'image/jpeg' }),
    ])

    expect(onArchivos).toHaveBeenCalledTimes(1)
    const entregados = onArchivos.mock.calls[0]?.[0] as File[]
    expect(entregados).toHaveLength(2)
    expect(entregados.map((f) => f.name)).toEqual([
      'pedido-1.png',
      'pedido-2.jpg',
    ])
  })

  it('en modo multiple lista fichas y quita por índice', async () => {
    const usuario = userEvent.setup()
    const onQuitar = vi.fn()
    render(
      <ZonaDeCarga
        multiple
        maxArchivos={8}
        etiqueta="PDF o imágenes del pedido"
        aceptados={['pdf', 'imagen']}
        archivos={[
          { nombre: 'hoja-1.png', bytes: 1200, clase: 'imagen' },
          { nombre: 'hoja-2.png', bytes: 2400, clase: 'imagen' },
        ]}
        estado="listo"
        mensaje={null}
        onArchivos={() => undefined}
        onQuitar={onQuitar}
      />,
    )

    expect(screen.getByText('hoja-1.png')).toBeInTheDocument()
    expect(screen.getByText('hoja-2.png')).toBeInTheDocument()
    expect(screen.getByText(/2 de 8 archivos/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Añadir' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cambiar' })).not.toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Quitar hoja-2.png' }))
    expect(onQuitar).toHaveBeenCalledTimes(1)
    expect(onQuitar).toHaveBeenCalledWith(1)
  })
})
