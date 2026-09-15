import { describe, expect, it, vi } from 'vitest'
import {
  invocarModelo,
  invocarModeloConPartes,
  modelosAIntentar,
  textoDeRespuestaGemini,
} from '../../../src/server/asistencia/cliente-modelo.ts'
import { diagnosticarAsistencia } from '../../../src/server/asistencia/diagnostico.ts'

/**
 * Cuando Gemini falla, el vendedor ve la banda y el administrador necesita
 * saber por qué. Estas pruebas fijan que el motivo viaja estructurado en
 * `detalle` (sin texto crudo del proveedor), que un modelo retirado (404) o
 * saturado (503 UNAVAILABLE) conmuta al de respaldo y que la sonda de
 * diagnóstico describe cada clave.
 */

function respuestaOk(json: unknown, extraParts: unknown[] = []): Response {
  return new Response(
    JSON.stringify({
      candidates: [
        {
          content: {
            parts: [...extraParts, { text: JSON.stringify(json) }],
          },
        },
      ],
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
}

function errorGemini(
  status: number,
  estado: string,
  message: string,
): Response {
  return new Response(
    JSON.stringify({ error: { code: status, status: estado, message } }),
    { status, headers: { 'Content-Type': 'application/json' } },
  )
}

const entradaAudio = {
  tipo: 'audio' as const,
  medio: { mimeType: 'audio/webm', dataBase64: 'YQ==' },
  candidatos: [{ codigo: 'C1', descripcion: 'CODO FG 1/2', unidad: 'NIU' }],
}

describe('motivo de fallo de la asistencia', () => {
  it('clave rechazada (403) en ambas claves: detalle estructurado y sin cambiar de modelo', async () => {
    const fetchFn = vi.fn(async () =>
      errorGemini(
        403,
        'PERMISSION_DENIED',
        "Method doesn't allow unregistered callers",
      ),
    )

    await expect(
      invocarModelo({
        ...entradaAudio,
        deps: {
          fetchFn: fetchFn as unknown as typeof fetch,
          clavePrimaria: 'k1',
          claveSecundaria: 'k2',
          timeoutMs: 2_000,
        },
      }),
    ).rejects.toMatchObject({
      codigo: 'asistencia_no_disponible',
      detalle: {
        motivo: 'clave_rechazada',
        status: 403,
        estadoGemini: 'PERMISSION_DENIED',
        clave: 'secundaria',
        intentos: 2,
      },
    })

    // Dos claves, un solo modelo: una clave inválida no se arregla con otro modelo.
    expect(fetchFn).toHaveBeenCalledTimes(2)
    const urls = fetchFn.mock.calls.map((c) => String((c as unknown[])[0]))
    expect(urls.every((u) => u.includes('gemini-3.8-flash'))).toBe(true)
  })

  it('el detalle nunca lleva el mensaje crudo de Gemini', async () => {
    const fetchFn = vi.fn(async () =>
      errorGemini(
        400,
        'INVALID_ARGUMENT',
        'API key not valid. Please pass a valid API key.',
      ),
    )
    let capturado: unknown
    try {
      await invocarModelo({
        ...entradaAudio,
        deps: {
          fetchFn: fetchFn as unknown as typeof fetch,
          clavePrimaria: 'k1',
          timeoutMs: 2_000,
        },
      })
    } catch (error) {
      capturado = error
    }
    const detalle = (capturado as { detalle: Record<string, unknown> }).detalle
    expect(detalle.motivo).toBe('clave_rechazada')
    expect(JSON.stringify(detalle)).not.toContain('Please pass')
  })

  it('modelo retirado (404): conmuta al modelo de respaldo con la misma clave', async () => {
    const fetchFn = vi.fn(async (url: string) => {
      if (url.includes('gemini-3.8-flash')) {
        return errorGemini(
          404,
          'NOT_FOUND',
          'models/gemini-3.8-flash is not found for API version v1beta',
        )
      }
      return respuestaOk({
        ilegible: false,
        items: [
          {
            textoOriginal: 'codo fg 1/2',
            codigo: 'C1',
            cantidad: 1,
            unidad: 'NIU',
            confidence: 'high',
          },
        ],
      })
    })

    const resultado = await invocarModelo({
      ...entradaAudio,
      deps: {
        fetchFn: fetchFn as unknown as typeof fetch,
        clavePrimaria: 'k1',
        modeloRespaldo: 'gemini-3.5-flash',
        timeoutMs: 2_000,
      },
    })

    expect(resultado.items[0]?.codigo).toBe('C1')
    const urls = fetchFn.mock.calls.map((c) => String((c as unknown[])[0]))
    expect(urls).toHaveLength(2)
    expect(urls[0]).toContain('gemini-3.8-flash')
    expect(urls[1]).toContain('gemini-3.5-flash')
  })

  it('503 UNAVAILABLE en el principal: conmuta al respaldo sin gastar la otra clave en el modelo saturado', async () => {
    const fetchFn = vi.fn(async (url: string) => {
      if (url.includes('gemini-3.8-flash')) {
        return errorGemini(
          503,
          'UNAVAILABLE',
          'This model is currently experiencing high demand',
        )
      }
      return respuestaOk({
        ilegible: false,
        items: [
          {
            textoOriginal: 'codo fg 1/2',
            codigo: 'C1',
            cantidad: 1,
            unidad: 'NIU',
            confidence: 'high',
          },
        ],
      })
    })

    const resultado = await invocarModelo({
      ...entradaAudio,
      deps: {
        fetchFn: fetchFn as unknown as typeof fetch,
        clavePrimaria: 'k1',
        claveSecundaria: 'k2',
        timeoutMs: 2_000,
      },
    })

    expect(resultado.items[0]?.codigo).toBe('C1')
    const urls = fetchFn.mock.calls.map((c) => String((c as unknown[])[0]))
    expect(urls).toHaveLength(2)
    expect(urls[0]).toContain('gemini-3.8-flash')
    expect(urls[1]).toContain('gemini-3.5-flash')
    const claves = fetchFn.mock.calls.map((c) => {
      const headers = (c as unknown as [string, RequestInit])[1]?.headers as
        | Record<string, string>
        | undefined
      return headers?.['x-goog-api-key']
    })
    expect(claves).toEqual(['k1', 'k1'])
  })

  it('503 en principal y respaldo: motivo modelo_saturado y último modelo el de respaldo', async () => {
    const fetchFn = vi.fn(async () =>
      errorGemini(
        503,
        'UNAVAILABLE',
        'This model is currently experiencing high demand',
      ),
    )

    await expect(
      invocarModelo({
        ...entradaAudio,
        deps: {
          fetchFn: fetchFn as unknown as typeof fetch,
          clavePrimaria: 'k1',
          claveSecundaria: 'k2',
          timeoutMs: 2_000,
        },
      }),
    ).rejects.toMatchObject({
      codigo: 'asistencia_no_disponible',
      detalle: {
        motivo: 'modelo_saturado',
        status: 503,
        estadoGemini: 'UNAVAILABLE',
        modelo: 'gemini-3.5-flash',
        clave: 'secundaria',
        intentos: 3,
      },
    })

    const urls = fetchFn.mock.calls.map((c) => String((c as unknown[])[0]))
    expect(urls).toEqual([
      expect.stringContaining('gemini-3.8-flash'),
      expect.stringContaining('gemini-3.5-flash'),
      expect.stringContaining('gemini-3.5-flash'),
    ])
  })

  it('si también falla el respaldo, el detalle señala el último modelo probado', async () => {
    const fetchFn = vi.fn(async () =>
      errorGemini(404, 'NOT_FOUND', 'not found'),
    )
    await expect(
      invocarModeloConPartes({
        partes: [{ text: 'hola' }],
        schema: { type: 'OBJECT' },
        deps: {
          fetchFn: fetchFn as unknown as typeof fetch,
          clavePrimaria: 'k1',
          modeloRespaldo: 'modelo-b',
          timeoutMs: 2_000,
        },
      }),
    ).rejects.toMatchObject({
      detalle: {
        motivo: 'modelo_no_disponible',
        modelo: 'modelo-b',
        intentos: 2,
      },
    })
  })

  it('sin respaldo configurado solo se intenta el modelo principal', () => {
    expect(modelosAIntentar({ modelo: 'a', modeloRespaldo: null })).toEqual([
      'a',
    ])
    expect(modelosAIntentar({ modelo: 'a', modeloRespaldo: 'b' })).toEqual([
      'a',
      'b',
    ])
    expect(modelosAIntentar({ modelo: 'a', modeloRespaldo: 'a' })).toEqual([
      'a',
    ])
  })

  it('por omisión: Gemini 3.8 Flash y respaldo 3.5 Flash', () => {
    const anteriorModelo = process.env.ASISTENCIA_MODELO
    const anteriorRespaldo = process.env.ASISTENCIA_MODELO_RESPALDO
    delete process.env.ASISTENCIA_MODELO
    delete process.env.ASISTENCIA_MODELO_RESPALDO
    try {
      expect(modelosAIntentar({})).toEqual([
        'gemini-3.8-flash',
        'gemini-3.5-flash',
      ])
    } finally {
      if (anteriorModelo === undefined) delete process.env.ASISTENCIA_MODELO
      else process.env.ASISTENCIA_MODELO = anteriorModelo
      if (anteriorRespaldo === undefined) {
        delete process.env.ASISTENCIA_MODELO_RESPALDO
      } else {
        process.env.ASISTENCIA_MODELO_RESPALDO = anteriorRespaldo
      }
    }
  })

  it('las claves se sanean: un salto de línea en el secreto no llega a la cabecera', async () => {
    const cabeceras: string[] = []
    const fetchFn = vi.fn(async (_url: string, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string>
      cabeceras.push(headers['x-goog-api-key'] ?? '')
      return respuestaOk({ ilegible: false, items: [] })
    })

    await invocarModelo({
      ...entradaAudio,
      deps: {
        fetchFn: fetchFn as unknown as typeof fetch,
        clavePrimaria: '  AIzaClave\n',
        timeoutMs: 2_000,
      },
    })
    expect(cabeceras).toEqual(['AIzaClave'])
  })

  it('un timeout no se repite con la otra clave ni con otro modelo', async () => {
    const fetchFn = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const error = new Error('aborted')
            error.name = 'AbortError'
            reject(error)
          })
        }),
    )

    await expect(
      invocarModelo({
        ...entradaAudio,
        deps: {
          fetchFn: fetchFn as unknown as typeof fetch,
          clavePrimaria: 'k1',
          claveSecundaria: 'k2',
          modeloRespaldo: 'modelo-b',
          timeoutMs: 30,
        },
      }),
    ).rejects.toMatchObject({ detalle: { motivo: 'timeout', intentos: 1 } })
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it('sin claves: motivo sin_claves', async () => {
    await expect(
      invocarModelo({
        ...entradaAudio,
        deps: { clavePrimaria: '', claveSecundaria: '  ', timeoutMs: 100 },
      }),
    ).rejects.toMatchObject({ detalle: { motivo: 'sin_claves' } })
  })

  it('lee el texto saltando las partes de razonamiento (thought)', () => {
    const texto = textoDeRespuestaGemini({
      candidates: [
        {
          content: {
            parts: [
              { thought: true, text: 'pensando…' },
              { text: '{"ok":true}' },
            ],
          },
        },
      ],
    })
    expect(texto).toBe('{"ok":true}')
    expect(
      textoDeRespuestaGemini({ candidates: [{ finishReason: 'SAFETY' }] }),
    ).toBe(undefined)
  })
})

describe('diagnóstico de asistencia (Administración → Parámetros)', () => {
  it('sondea cada clave y modelo y describe el resultado sin devolver las claves', async () => {
    const fetchFn = vi.fn(async (_url: string, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string>
      if (headers['x-goog-api-key'] === 'clave-buena') {
        return respuestaOk({ ok: true })
      }
      return errorGemini(429, 'RESOURCE_EXHAUSTED', 'Quota exceeded')
    })

    const diagnostico = await diagnosticarAsistencia(
      {
        fetchFn: fetchFn as unknown as typeof fetch,
        clavePrimaria: 'clave-buena',
        claveSecundaria: 'clave-agotada',
        modelo: 'modelo-a',
        modeloRespaldo: null,
      },
      () => new Date('2026-09-07T12:00:00.000Z'),
    )

    expect(diagnostico.modelos).toEqual(['modelo-a'])
    expect(diagnostico.ejecutadoEn).toBe('2026-09-07T12:00:00.000Z')
    expect(diagnostico.sondas).toHaveLength(2)
    expect(diagnostico.sondas[0]).toMatchObject({
      clave: 'primaria',
      presente: true,
      longitud: 'clave-buena'.length,
      resultado: 'ok',
      respondioOk: true,
      status: 200,
    })
    expect(diagnostico.sondas[1]).toMatchObject({
      clave: 'secundaria',
      presente: true,
      resultado: 'cuota',
      status: 429,
      estadoGemini: 'RESOURCE_EXHAUSTED',
    })
    expect(JSON.stringify(diagnostico)).not.toContain('clave-buena')
    expect(JSON.stringify(diagnostico)).not.toContain('clave-agotada')
  })

  it('una clave ausente se reporta como tal sin llamar al servicio', async () => {
    const fetchFn = vi.fn(async () => respuestaOk({ ok: true }))
    const diagnostico = await diagnosticarAsistencia({
      fetchFn: fetchFn as unknown as typeof fetch,
      clavePrimaria: 'k1',
      claveSecundaria: '',
      modelo: 'modelo-a',
      modeloRespaldo: null,
    })
    expect(fetchFn).toHaveBeenCalledTimes(1)
    expect(diagnostico.sondas[1]).toMatchObject({
      clave: 'secundaria',
      presente: false,
      resultado: 'ausente',
    })
  })
})
