import { describe, expect, it, vi } from 'vitest'
import {
  crearIndice,
  buscarProductos,
} from '../../../src/domain/busqueda/productos.ts'
import { invocarModelo } from '../../../src/server/asistencia/cliente-modelo.ts'
import { ErrorDeSuitPay } from '../../../src/server/errores.ts'

describe('asistencia caída (T118)', () => {
  it('devuelve asistencia_no_disponible cuando ambas claves fallan', async () => {
    const fetchFn = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: { message: 'down' } }), {
          status: 503,
        }),
    )

    await expect(
      invocarModelo({
        tipo: 'audio',
        medio: { mimeType: 'audio/webm', dataBase64: 'YQ==' },
        candidatos: [
          { codigo: 'C1', descripcion: 'CODO FG 1/2', unidad: 'NIU' },
        ],
        deps: {
          fetchFn: fetchFn as unknown as typeof fetch,
          clavePrimaria: 'k1',
          claveSecundaria: 'k2',
          timeoutMs: 2_000,
        },
      }),
    ).rejects.toMatchObject({ codigo: 'asistencia_no_disponible' })

    expect(fetchFn).toHaveBeenCalledTimes(2)
  })

  it('la venta se puede completar escribiendo aunque la asistencia falle (FR-046)', () => {
    const error = new ErrorDeSuitPay('asistencia_no_disponible')
    expect(error.codigo).toBe('asistencia_no_disponible')

    // La búsqueda local no depende del servicio de asistencia.
    const indice = crearIndice([
      {
        codigo: 'C1',
        descripcion: 'CODO FG 1/2',
        unidad: 'NIU',
        precio: 100,
        activo: true,
      },
    ])
    const resultado = buscarProductos(indice, 'codo fg')
    expect(resultado.sinCoincidencias).toBe(false)
    expect(resultado.coincidencias[0]?.elemento.codigo).toBe('C1')
  })
})
