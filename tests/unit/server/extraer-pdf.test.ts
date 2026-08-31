import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi, afterEach } from 'vitest'
import {
  construirPayloadDePdf,
  payloadPdfIncluyeCatalogoOFicha,
} from '../../../src/server/asistencia/payload-pdf.ts'
import {
  extraerListaPdf,
  normalizarClientePdf,
  viaParaTamano,
  TECHO_INLINE_PDF_BYTES,
  TECHO_UI_PDF_BYTES,
} from '../../../src/server/asistencia/extraer-pdf.ts'
import { fijarModoSimulado } from '../../../src/server/asistencia/simulado.ts'
import {
  promptDeListaPdf,
  SCHEMA_RESPUESTA_PDF,
} from '../../../src/server/asistencia/prompts-pdf.ts'

describe('extraerListaPdf (FR-061)', () => {
  afterEach(() => {
    fijarModoSimulado('exito')
  })

  it('el payload no incluye catálogo ni ficha de clientes', () => {
    const payload = construirPayloadDePdf({
      via: 'inline',
      dataBase64: 'JVBERi0=',
    })
    expect(payload.tipo).toBe('pdf')
    expect(payload.medio.mimeType).toBe('application/pdf')
    expect(payloadPdfIncluyeCatalogoOFicha(payload)).toBe(false)
    expect(Object.keys(payload).sort()).toEqual(['medio', 'tipo', 'via'].sort())
  })

  it('File API no embebe los bytes en el payload auditable', () => {
    const payload = construirPayloadDePdf({
      via: 'file_api',
      dataBase64: 'JVBERi0x',
    })
    expect(payload.medio.dataBase64).toBe('')
  })

  it('el prompt vacío no exige lote filtrado', () => {
    expect(promptDeListaPdf()).not.toMatch(/LOTE FILTRADO/i)
    expect(promptDeListaPdf()).not.toMatch(/candidatos/)
  })

  it('simulado extrae items y cliente sin Fuse en servidor', async () => {
    fijarModoSimulado('exito')
    const persistir = vi.fn()
    const resultado = await extraerListaPdf(
      { medioUrl: 'capturas/v/req.pdf', vendedorId: 'v1' },
      {
        forzarSimulado: true,
        leerMedio: async () => ({
          mimeType: 'application/pdf',
          dataBase64: Buffer.from('%PDF-1.4').toString('base64'),
        }),
        persistir,
        idCaptura: () => 'cap-pdf-1',
      },
    )
    expect(resultado.items.length).toBeGreaterThan(0)
    expect(resultado.cliente?.numeroDocumento).toBe('20123456789')
    expect(persistir).toHaveBeenCalledOnce()
  })

  it('rechaza un medio que no es PDF', async () => {
    await expect(
      extraerListaPdf(
        { medioUrl: 'capturas/v/foto.jpg', vendedorId: 'v1' },
        {
          forzarSimulado: true,
          leerMedio: async () => ({
            mimeType: 'image/jpeg',
            dataBase64: 'eA==',
          }),
        },
      ),
    ).rejects.toMatchObject({ codigo: 'peticion_invalida' })
  })

  it('medio ilegible no persiste propuesta', async () => {
    fijarModoSimulado('ilegible')
    const persistir = vi.fn()
    await expect(
      extraerListaPdf(
        { medioUrl: 'capturas/v/negro.pdf', vendedorId: 'v1' },
        {
          forzarSimulado: true,
          leerMedio: async () => ({
            mimeType: 'application/pdf',
            dataBase64: Buffer.from('%PDF').toString('base64'),
          }),
          persistir,
        },
      ),
    ).rejects.toMatchObject({ codigo: 'medio_ilegible' })
    expect(persistir).not.toHaveBeenCalled()
  })

  it('elige File API por encima del techo inline', () => {
    expect(viaParaTamano(TECHO_INLINE_PDF_BYTES + 1)).toBe('file_api')
    expect(viaParaTamano(1024)).toBe('inline')
  })

  it('normaliza RUC y rechaza números incompletos', () => {
    expect(
      normalizarClientePdf({
        tipoDocumento: 'RUC',
        numeroDocumento: '20123456789',
        denominacion: 'ACME',
      }),
    ).toEqual({
      tipoDocumento: 'RUC',
      numeroDocumento: '20123456789',
      denominacion: 'ACME',
    })
    expect(
      normalizarClientePdf({
        tipoDocumento: 'RUC',
        numeroDocumento: '20123',
        denominacion: 'X',
      }),
    ).toBeNull()
  })

  it('inline llama generateContent con application/pdf y sin candidatos', async () => {
    const cuerpos: unknown[] = []
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes('generateContent')) {
        cuerpos.push(JSON.parse(String(init?.body ?? '{}')))
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        ilegible: false,
                        items: [
                          {
                            textoOriginal: 'codo fg',
                            cantidad: 2,
                            unidad: 'NIU',
                          },
                        ],
                        cliente: null,
                      }),
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200 },
        )
      }
      return new Response('no', { status: 404 })
    })

    const resultado = await extraerListaPdf(
      { medioUrl: 'capturas/v/req.pdf', vendedorId: 'v1' },
      {
        forzarSimulado: false,
        forzarVia: 'inline',
        leerMedio: async () => ({
          mimeType: 'application/pdf',
          dataBase64: Buffer.from('%PDF-1.4 mini').toString('base64'),
        }),
        persistir: async () => undefined,
        depsModelo: {
          fetchFn: fetchFn as unknown as typeof fetch,
          clavePrimaria: 'k1',
          timeoutMs: 5_000,
        },
      },
    )

    expect(resultado.items[0]?.textoOriginal).toBe('codo fg')
    expect(cuerpos).toHaveLength(1)
    const cuerpo = cuerpos[0] as {
      contents: Array<{ parts: Array<Record<string, unknown>> }>
    }
    const partes = cuerpo.contents[0]?.parts ?? []
    const inline = partes.find((p) => p.inlineData !== undefined)
    expect(inline?.inlineData).toMatchObject({ mimeType: 'application/pdf' })
    const serializado = JSON.stringify(cuerpo)
    expect(serializado).not.toContain('candidatos')
    expect(serializado).not.toContain('LOTE FILTRADO')
  })

  it('no extrae texto con unpdf; el schema trae cliente opcional y código de matching', () => {
    const fuente = readFileSync(
      join(import.meta.dirname, '../../../src/server/asistencia/extraer-pdf.ts'),
      'utf8',
    )
    expect(fuente).not.toMatch(/unpdf/)
    expect(fuente).toMatch(/inlineData/)
    expect(fuente).toMatch(/fileData/)
    expect(TECHO_UI_PDF_BYTES).toBe(40 * 1024 * 1024)
    expect(
      'codigo' in SCHEMA_RESPUESTA_PDF.properties.items.items.properties,
    ).toBe(true)
    expect(SCHEMA_RESPUESTA_PDF.properties.cliente.nullable).toBe(true)
  })

  it('la server function solo recibe medioUrl', () => {
    const fuente = readFileSync(
      join(
        import.meta.dirname,
        '../../../src/features/cotizaciones/pdf.funciones.ts',
      ),
      'utf8',
    )
    expect(fuente).not.toMatch(/candidatos/)
    expect(fuente).toMatch(/medioUrl/)
  })

  it('File API llama generateContent con fileData y borra el archivo', async () => {
    const uri = 'https://generativelanguage.googleapis.com/v1beta/files/abc'
    const cuerpos: unknown[] = []
    const metodos: string[] = []
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url)
      metodos.push(`${init?.method ?? 'GET'} ${u}`)
      if (u.includes('upload/v1beta/files')) {
        return new Response(
          JSON.stringify({
            file: { name: 'files/abc', uri, state: 'ACTIVE' },
          }),
          { status: 200 },
        )
      }
      if (u.includes('v1beta/files/abc')) {
        if (init?.method === 'DELETE') {
          return new Response('', { status: 200 })
        }
        return new Response(
          JSON.stringify({ name: 'files/abc', uri, state: 'ACTIVE' }),
          { status: 200 },
        )
      }
      if (u.includes('generateContent')) {
        cuerpos.push(JSON.parse(String(init?.body ?? '{}')))
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        ilegible: false,
                        items: [
                          {
                            textoOriginal: 'tee pvc',
                            cantidad: 1,
                            unidad: 'NIU',
                          },
                        ],
                        cliente: null,
                      }),
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200 },
        )
      }
      return new Response('no', { status: 404 })
    })

    const resultado = await extraerListaPdf(
      { medioUrl: 'capturas/v/req.pdf', vendedorId: 'v1' },
      {
        forzarSimulado: false,
        forzarVia: 'file_api',
        leerMedio: async () => ({
          mimeType: 'application/pdf',
          dataBase64: Buffer.from('%PDF-1.4 fileapi').toString('base64'),
          bytes: Uint8Array.from(Buffer.from('%PDF-1.4 fileapi')),
        }),
        persistir: async () => undefined,
        depsModelo: {
          fetchFn: fetchFn as unknown as typeof fetch,
          clavePrimaria: 'k1',
          timeoutMs: 5_000,
        },
      },
    )

    expect(resultado.items[0]?.textoOriginal).toBe('tee pvc')
    expect(cuerpos).toHaveLength(1)
    const cuerpo = cuerpos[0] as {
      contents: Array<{ parts: Array<Record<string, unknown>> }>
    }
    const partes = cuerpo.contents[0]?.parts ?? []
    expect(partes.find((p) => p.inlineData !== undefined)).toBeUndefined()
    expect(partes.find((p) => p.fileData !== undefined)?.fileData).toMatchObject(
      {
        mimeType: 'application/pdf',
        fileUri: uri,
      },
    )
    expect(JSON.stringify(cuerpo)).not.toContain('candidatos')
    expect(metodos.some((m) => m.startsWith('POST') && m.includes('upload'))).toBe(
      true,
    )
    expect(metodos.some((m) => m.startsWith('DELETE'))).toBe(true)
  })
})
