import { afterEach, describe, expect, it, vi } from 'vitest'
import { compartirDocumento } from '../../../src/features/emision/compartir.ts'

describe('compartirDocumento', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('comparte el PDF como archivo cuando la hoja lo admite', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    const canShare = vi.fn().mockReturnValue(true)
    vi.stubGlobal('navigator', { share, canShare })

    const archivo = new File(['%PDF'], 'nota.pdf', { type: 'application/pdf' })
    const resultado = await compartirDocumento({
      nombreSugerido: 'nota-de-venta',
      archivo,
    })

    expect(resultado).toEqual({ ok: true, via: 'sistema' })
    expect(canShare).toHaveBeenCalledWith({ files: [archivo] })
    expect(share).toHaveBeenCalledWith({
      title: 'nota-de-venta',
      files: [archivo],
    })
  })

  it('no descarga en el modal si no hay hoja de compartir', async () => {
    vi.stubGlobal('navigator', {})
    const archivo = new File(['%PDF'], 'nota.pdf', { type: 'application/pdf' })
    const resultado = await compartirDocumento({
      nombreSugerido: 'nota-de-venta',
      archivo,
    })
    expect(resultado).toEqual({ ok: false, motivo: 'sin_hoja' })
  })

  it('trata AbortError como cancelación', async () => {
    const aborto = new Error('canceló')
    aborto.name = 'AbortError'
    vi.stubGlobal('navigator', {
      share: vi.fn().mockRejectedValue(aborto),
      canShare: () => true,
    })
    const resultado = await compartirDocumento({
      nombreSugerido: 'nota-de-venta',
      archivo: new File(['%PDF'], 'nota.pdf', { type: 'application/pdf' }),
    })
    expect(resultado).toEqual({ ok: false, motivo: 'cancelado' })
  })

  it('descarga el PDF si Lista lo pide y no hay hoja', async () => {
    vi.stubGlobal('navigator', {})
    const archivo = new File(['%PDF'], 'lista.pdf', { type: 'application/pdf' })
    const resultado = await compartirDocumento({
      nombreSugerido: 'lista-requerimiento',
      archivo,
      descargarSiFalla: true,
    })
    expect(resultado).toEqual({ ok: true, via: 'descarga' })
  })
})
