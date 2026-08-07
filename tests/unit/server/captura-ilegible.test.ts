import { describe, expect, it, vi, afterEach } from 'vitest'
import { interpretarCaptura } from '../../../src/server/asistencia/interpretar.ts'
import { fijarModoSimulado } from '../../../src/server/asistencia/simulado.ts'

describe('medio ilegible (T129)', () => {
  afterEach(() => {
    fijarModoSimulado('exito')
  })

  it('devuelve medio_ilegible y conserva el original (no borra ni descarta)', async () => {
    fijarModoSimulado('ilegible')
    const persistir = vi.fn()
    const medioUrl = 'capturas/vendedor/foto-ilegible.jpg'

    await expect(
      interpretarCaptura(
        {
          tipo: 'imagen',
          medioUrl,
          candidatos: [
            { codigo: 'C1', descripcion: 'CODO FG 1/2', unidad: 'NIU' },
          ],
          vendedorId: 'v1',
        },
        {
          forzarSimulado: true,
          leerMedio: async () => ({
            mimeType: 'image/jpeg',
            dataBase64: 'Zm90bw==',
          }),
          persistir,
        },
      ),
    ).rejects.toMatchObject({ codigo: 'medio_ilegible' })

    // Sin persistir propuesta; el medioUrl sigue siendo responsabilidad del
    // cliente/Storage — esta función no lo elimina.
    expect(persistir).not.toHaveBeenCalled()
  })
})
