import { afterEach, describe, expect, it } from 'vitest'
import { usarCaptura } from '../../../src/features/captura/estado.ts'

afterEach(() => {
  usarCaptura.getState().cancelar()
})

describe('quitarLinea en la revisión', () => {
  it('saca el renglón pendiente y deja aprobar el resto', () => {
    usarCaptura.getState().recibirPropuesta({
      capturaId: 'c1',
      medioUrl: 'capturas/v/req.pdf',
      medioObjectUrl: null,
      tipo: 'pdf',
      lineas: [
        {
          textoOriginal: 'codo fg',
          candidatos: [
            {
              codigo: 'C1',
              descripcion: 'CODO FG 1/2',
              unidad: 'NIU',
              cantidad: 1,
              grado: 'exacta',
            },
          ],
          seleccion: 'C1',
          estadoLinea: 'resuelta',
          cantidad: 1,
        },
        {
          textoOriginal: 'producto inventado',
          candidatos: [],
          seleccion: null,
          estadoLinea: 'pendiente',
          cantidad: 1,
        },
      ],
    })

    expect(usarCaptura.getState().hayPendientesOAmbiguas()).toBe(true)
    usarCaptura.getState().quitarLinea(1)
    expect(usarCaptura.getState().lineas).toHaveLength(1)
    expect(usarCaptura.getState().lineas[0]?.textoOriginal).toBe('codo fg')
    expect(usarCaptura.getState().hayPendientesOAmbiguas()).toBe(false)
  })
})
