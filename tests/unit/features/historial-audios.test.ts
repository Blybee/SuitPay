import { describe, expect, it } from 'vitest'
import { audiosVisibles } from '../../../src/features/captura/historial.ts'
import type { RegistroDeAudio } from '../../../src/infra/local/almacenes.ts'

function audio(
  parcial: Partial<RegistroDeAudio> & Pick<RegistroDeAudio, 'id' | 'contexto'>,
): RegistroDeAudio {
  return {
    grabadoEn: Date.now(),
    vecinoId: null,
    mimeType: 'audio/webm',
    blob: new Blob(['x'], { type: 'audio/webm' }),
    ...parcial,
  }
}

describe('audiosVisibles', () => {
  it('en Pedido solo muestra audios de pedido del día', () => {
    const entradas = [
      audio({ id: 'p', contexto: 'pedido' }),
      audio({ id: 'l', contexto: 'lista' }),
      audio({ id: 'v', contexto: 'vecino', vecinoId: 'w' }),
    ]
    expect(
      audiosVisibles({ entradas, contexto: 'pedido', vecinoId: null }).map(
        (c) => c.id,
      ),
    ).toEqual(['p'])
  })

  it('en Vecinos solo muestra el pill activo', () => {
    const entradas = [
      audio({ id: 'w', contexto: 'vecino', vecinoId: 'wilmer' }),
      audio({ id: 'a', contexto: 'vecino', vecinoId: 'ana' }),
    ]
    expect(
      audiosVisibles({
        entradas,
        contexto: 'vecino',
        vecinoId: 'ana',
      }).map((c) => c.id),
    ).toEqual(['a'])
  })

  it('oculta grabaciones de otro día civil', () => {
    const ayer = Date.now() - 36 * 60 * 60 * 1000
    const entradas = [
      audio({ id: 'hoy', contexto: 'pedido' }),
      audio({ id: 'ayer', contexto: 'pedido', grabadoEn: ayer }),
    ]
    expect(
      audiosVisibles({ entradas, contexto: 'pedido', vecinoId: null }).map(
        (c) => c.id,
      ),
    ).toEqual(['hoy'])
  })
})
