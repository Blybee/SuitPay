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
})
