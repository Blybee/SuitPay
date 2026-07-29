import { describe, expect, it } from 'vitest'
import { consultarEstadoEmision } from '../../../src/server/emision/consultar-estado.ts'
import { emitirComprobante } from '../../../src/server/emision/emitir.ts'
import { montarEscenario, peticion } from './ayudas-emision.ts'

/**
 * Consulta bajo demanda (decisión 10 / T171). Nunca emite.
 */
describe('consultarEstadoEmision', () => {
  it('adopta el estado cuando el proveedor sí tiene el documento', async () => {
    const { almacen, contexto, proveedor } = montarEscenario()
    const p = peticion({ claveIdempotencia: 'consulta-existe' })
    proveedor.configurarEmision({ tipo: 'acepta_pero_no_contesta' })

    await expect(emitirComprobante(contexto, p)).rejects.toMatchObject({
      codigo: 'emision_indeterminada',
    })

    const resultado = await consultarEstadoEmision(
      { almacen, proveedor },
      p.claveIdempotencia,
    )

    expect(resultado.desenlace).toBe('resuelto')
    expect(resultado.comprobante.estado).toBe('enviado')
    expect(proveedor.llamadasA('emitir')).toBe(1)
  })

  it('deja pendiente si el documento no existe, para reintento manual seguro', async () => {
    const { almacen, contexto, proveedor } = montarEscenario()
    const p = peticion({ claveIdempotencia: 'consulta-ausente' })
    proveedor.configurarEmision({ tipo: 'indeterminado' })

    await expect(emitirComprobante(contexto, p)).rejects.toThrow()

    proveedor.configurarConsulta({ tipo: 'exito' })

    const resultado = await consultarEstadoEmision(
      { almacen, proveedor },
      p.claveIdempotencia,
    )

    expect(resultado.desenlace).toBe('sin_documento')
    expect(resultado.comprobante.estado).toBe('pendiente')
  })

  it('una consulta fallida NO da la venta por no emitida', async () => {
    const { almacen, contexto, proveedor } = montarEscenario()
    const p = peticion({ claveIdempotencia: 'consulta-falla' })
    proveedor.configurarEmision({ tipo: 'acepta_pero_no_contesta' })
    await expect(emitirComprobante(contexto, p)).rejects.toThrow()

    proveedor.configurarConsulta({ tipo: 'indisponible' })
    const resultado = await consultarEstadoEmision(
      { almacen, proveedor },
      p.claveIdempotencia,
    )

    expect(resultado.desenlace).toBe('no_consultable')
    expect(resultado.comprobante.estado).toBe('indeterminado')
  })

  it('no reemite al consultar', async () => {
    const { almacen, contexto, proveedor } = montarEscenario()
    const p = peticion({ claveIdempotencia: 'consulta-no-emite' })
    proveedor.configurarEmision({ tipo: 'indeterminado' })

    await expect(emitirComprobante(contexto, p)).rejects.toThrow()
    const emitidosAntes = proveedor.llamadasA('emitir')

    await consultarEstadoEmision({ almacen, proveedor }, p.claveIdempotencia)

    expect(proveedor.llamadasA('emitir')).toBe(emitidosAntes)
  })
})
