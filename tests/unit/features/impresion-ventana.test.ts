import { afterEach, describe, expect, it, vi } from 'vitest'
import { imprimirDocumento } from '../../../src/features/emision/impresion.ts'

describe('imprimirDocumento', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('no trata como fallo un open exitoso (noopener ya no se usa en features)', () => {
    const abierta = { opener: window as unknown as Window | null }
    const open = vi.fn(() => abierta)
    vi.stubGlobal('open', open)

    const resultado = imprimirDocumento('https://ejemplo.test/doc.pdf')

    expect(resultado).toEqual({ ok: true })
    expect(open).toHaveBeenCalledWith('https://ejemplo.test/doc.pdf', '_blank')
    expect(abierta.opener).toBeNull()
  })

  it('informa bloqueo real cuando open devuelve null', () => {
    vi.stubGlobal(
      'open',
      vi.fn(() => null),
    )

    expect(imprimirDocumento('https://ejemplo.test/doc.pdf')).toEqual({
      ok: false,
      motivo: 'no_se_pudo_abrir',
    })
  })

  it('no pasa un blob URL a open: Chrome lo trata como búsqueda del omnibox', () => {
    const write = vi.fn()
    const abierta = {
      opener: window as unknown as Window | null,
      location: { href: 'about:blank' },
      document: {
        open: vi.fn(),
        write,
        close: vi.fn(),
      },
    }
    const open = vi.fn(() => abierta)
    vi.stubGlobal('open', open)

    const blobUrl =
      'blob:http://localhost:3000/04a43561-9614-4b40-96c3-c895ef1c168c'
    const resultado = imprimirDocumento(blobUrl)

    expect(resultado).toEqual({ ok: true })
    expect(open).toHaveBeenCalledWith('about:blank', '_blank')
    expect(write).toHaveBeenCalledOnce()
    expect(String(write.mock.calls[0]?.[0])).toContain(blobUrl)
    expect(String(write.mock.calls[0]?.[0])).toContain('iframe')
    expect(abierta.opener).not.toBeNull()
  })

  it('si el blob no abre ventana, navega con un ancla sin noopener', () => {
    const click = vi.fn()
    const ancla = {
      href: '',
      target: '',
      rel: '',
      click,
      remove: vi.fn(),
    }
    vi.spyOn(document, 'createElement').mockReturnValue(
      ancla as unknown as HTMLAnchorElement,
    )
    vi.spyOn(document.body, 'append').mockImplementation(() => {})
    vi.stubGlobal(
      'open',
      vi.fn(() => null),
    )

    const blobUrl = 'blob:http://localhost:3000/abc'
    expect(imprimirDocumento(blobUrl)).toEqual({ ok: true })
    expect(ancla.href).toBe(blobUrl)
    expect(ancla.target).toBe('_blank')
    expect(ancla.rel).toBe('')
    expect(click).toHaveBeenCalled()
  })
})
