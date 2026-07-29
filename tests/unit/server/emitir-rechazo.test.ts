import { describe, expect, it } from 'vitest'
import { emitirComprobante } from '../../../src/server/emision/emitir.ts'
import { montarEscenario, peticion } from './ayudas-emision.ts'

/**
 * Rechazo definitivo (FR-030).
 *
 * El proveedor entendió la petición y la considera inválida. Se sabe con certeza
 * que no se emitió, y la corrección es un documento nuevo, no un reintento.
 *
 * Lo que esta prueba protege de verdad es lo del correlativo: **queda consumido**.
 * Resulta contraintuitivo —"si se rechazó, devuélveme el número"— y es
 * precisamente lo que no se puede hacer.
 */
describe('emisión rechazada por el proveedor', () => {
  it('deja el comprobante rechazado con el motivo en su traza', async () => {
    const { almacen, contexto, proveedor } = montarEscenario()
    proveedor.configurarEmision({
      tipo: 'rechazo_definitivo',
      motivo: 'ruc_invalido',
    })

    await expect(emitirComprobante(contexto, peticion())).rejects.toMatchObject({
      codigo: 'emision_rechazada',
    })

    const [comprobante] = almacen.todosLosComprobantes()
    expect(comprobante?.estado).toBe('rechazado')
    expect(comprobante?.intentos[0]?.razon).toBe('ruc_invalido')
    expect(comprobante?.intentos[0]?.rastro?.codigoOriginal).toBe('2027')
  })

  it('el correlativo consumido queda registrado como consumido', async () => {
    // La regla que más cuesta aceptar y la que evita el peor fallo posible. Si se
    // devolviera el número, la siguiente venta lo reclamaría; y si el proveedor
    // sí lo había registrado antes de rechazarlo, habría dos documentos con la
    // misma numeración. Un hueco se explica en una fiscalización; un número
    // repetido, no.
    const { almacen, contexto, proveedor } = montarEscenario()
    proveedor.configurarEmision({ tipo: 'rechazo_definitivo' })

    await expect(emitirComprobante(contexto, peticion())).rejects.toThrow()

    const serie = await almacen.leerSerie('vendedor-1__boleta')
    expect(serie?.ultimoNumero).toBe(1)
  })

  it('la venta corregida consume el número siguiente, no el rechazado', async () => {
    const { almacen, contexto, proveedor } = montarEscenario()
    proveedor.configurarEmision({ tipo: 'rechazo_definitivo' })

    await expect(emitirComprobante(contexto, peticion())).rejects.toThrow()

    // El vendedor corrige y vuelve a emitir: es una venta nueva, clave nueva.
    proveedor.configurarEmision({ tipo: 'exito' })
    const corregida = await emitirComprobante(contexto, peticion())

    expect(corregida.numero).toBe(2)
    expect(almacen.totalDeComprobantes).toBe(2)
  })

  it('un rechazo no es reintentable', async () => {
    const { contexto, proveedor } = montarEscenario()
    proveedor.configurarEmision({ tipo: 'rechazo_definitivo' })

    await expect(emitirComprobante(contexto, peticion())).rejects.toMatchObject({
      reintentable: false,
    })
  })

  it('nunca se alcanza el estado rechazado sin pasar por el proveedor', async () => {
    // Un rechazo es una afirmación del proveedor. Si el sistema lo produjera por
    // su cuenta, estaría inventando un hecho tributario.
    const { almacen, contexto, proveedor } = montarEscenario()
    proveedor.configurarEmision({ tipo: 'rechazo_definitivo' })

    await expect(emitirComprobante(contexto, peticion())).rejects.toThrow()

    const [comprobante] = almacen.todosLosComprobantes()
    expect(comprobante?.intentos).toHaveLength(1)
    expect(proveedor.llamadasA('emitir')).toBe(1)
  })
})
