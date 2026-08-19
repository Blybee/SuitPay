import { afterEach, describe, expect, it } from 'vitest'
import { usarBusqueda } from '../../../src/features/busqueda/almacen.ts'

describe('usarBusqueda', () => {
  afterEach(() => {
    usarBusqueda.setState({ ultima: '' })
  })

  it('recuerda el último término de producto', () => {
    usarBusqueda.getState().recordar('valvula')
    expect(usarBusqueda.getState().ultima).toBe('valvula')
    usarBusqueda.getState().recordar('tubo pvc')
    expect(usarBusqueda.getState().ultima).toBe('tubo pvc')
  })

  it('ignora vacío y comandos', () => {
    usarBusqueda.getState().recordar('valvula')
    usarBusqueda.getState().recordar('')
    usarBusqueda.getState().recordar('   ')
    usarBusqueda.getState().recordar('/guia')
    usarBusqueda.getState().recordar('  /crear transportista')
    expect(usarBusqueda.getState().ultima).toBe('valvula')
  })
})
