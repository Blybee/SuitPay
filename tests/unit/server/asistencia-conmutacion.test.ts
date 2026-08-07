import { describe, expect, it, vi } from 'vitest'
import { invocarModelo } from '../../../src/server/asistencia/cliente-modelo.ts'

describe('conmutación de credencial de asistencia (T117)', () => {
  it('ante error de cuota en la primaria, conmuta a la secundaria', async () => {
    const clavesUsadas: string[] = []
    let llamadas = 0

    const fetchFn = vi.fn(async (_url: string, init?: RequestInit) => {
      llamadas += 1
      const headers = init?.headers as Record<string, string>
      const clave = headers['x-goog-api-key'] ?? ''
      clavesUsadas.push(clave)

      if (llamadas === 1) {
        return new Response(
          JSON.stringify({ error: { message: 'Quota exceeded' } }),
          { status: 429 },
        )
      }

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
                          textoOriginal: 'codo fg 1/2',
                          codigo: 'C1',
                          cantidad: 1,
                          unidad: 'NIU',
                          confidence: 'high',
                        },
                      ],
                    }),
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    })

    const resultado = await invocarModelo({
      tipo: 'audio',
      medio: { mimeType: 'audio/webm', dataBase64: 'YWI=' },
      candidatos: [{ codigo: 'C1', descripcion: 'CODO FG 1/2', unidad: 'NIU' }],
      deps: {
        fetchFn: fetchFn as unknown as typeof fetch,
        clavePrimaria: 'clave-primaria',
        claveSecundaria: 'clave-secundaria',
        timeoutMs: 5_000,
      },
    })

    expect(clavesUsadas).toEqual(['clave-primaria', 'clave-secundaria'])
    expect(resultado.items).toHaveLength(1)
    expect(resultado.items[0]?.codigo).toBe('C1')
  })
})
