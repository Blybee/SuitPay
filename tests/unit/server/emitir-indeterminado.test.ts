import { describe, expect, it } from 'vitest'
import { emitirComprobante } from '../../../src/server/emision/emitir.ts'
import { montarEscenario, peticion } from './ayudas-emision.ts'

/**
 * El caso peligroso (FR-029).
 *
 * El proveedor recibió la petición y registró el documento, pero la respuesta
 * nunca llegó. El documento **existe** y nosotros no lo sabemos. Reintentar aquí
 * produciría dos comprobantes fiscales para una sola venta, y el segundo habría
 * que anularlo.
 *
 * De ahí que la prueba central no sea sobre el estado, sino sobre lo que **no**
 * ocurre: una nueva invocación no llama otra vez al proveedor.
 */
describe('emisión con respuesta ausente', () => {
  it('deja el comprobante en indeterminado y no lo da por bueno', async () => {
    const { almacen, contexto, proveedor } = montarEscenario()
    proveedor.configurarEmision({ tipo: 'acepta_pero_no_contesta' })

    await expect(emitirComprobante(contexto, peticion())).rejects.toMatchObject({
      codigo: 'emision_indeterminada',
      reintentable: false,
    })

    const [comprobante] = almacen.todosLosComprobantes()
    expect(comprobante?.estado).toBe('indeterminado')
  })

  it('una nueva invocación con la misma clave NO vuelve a emitir', async () => {
    // La afirmación que sostiene el principio II. Nótese que el proveedor sí tiene
    // el documento: si reintentáramos, quedarían dos.
    const { contexto, proveedor } = montarEscenario()
    proveedor.configurarEmision({ tipo: 'acepta_pero_no_contesta' })
    const peticionDeVenta = peticion()

    await expect(
      emitirComprobante(contexto, peticionDeVenta),
    ).rejects.toMatchObject({ codigo: 'emision_indeterminada' })

    expect(proveedor.documentosEmitidos).toBe(1)

    const segunda = await emitirComprobante(contexto, peticionDeVenta)

    expect(segunda.yaExistia).toBe(true)
    expect(segunda.estado).toBe('indeterminado')
    expect(proveedor.llamadasA('emitir')).toBe(1)
    // Sigue habiendo UN documento en el proveedor, no dos.
    expect(proveedor.documentosEmitidos).toBe(1)
  })

  it('el error dice explícitamente que no se puede reintentar', async () => {
    // La prohibición vive en el dato, no en la disciplina de quien escriba la
    // interfaz: si `reintentable` fuese verdadero, alguien pintaría un botón.
    const { contexto, proveedor } = montarEscenario()
    proveedor.configurarEmision({ tipo: 'indeterminado' })

    await expect(emitirComprobante(contexto, peticion())).rejects.toMatchObject({
      reintentable: false,
    })
  })

  it('conserva el rastro del proveedor en la traza para diagnosticar', async () => {
    // El principio de trazabilidad exige registrar los intentos fallidos, y este
    // es el que más falta hace: sin el rastro, reconciliar a mano es adivinar.
    const { almacen, contexto, proveedor } = montarEscenario()
    proveedor.configurarEmision({ tipo: 'acepta_pero_no_contesta' })

    await expect(emitirComprobante(contexto, peticion())).rejects.toThrow()

    const [comprobante] = almacen.todosLosComprobantes()
    expect(comprobante?.intentos).toHaveLength(1)
    expect(comprobante?.intentos[0]?.resultado).toBe('indeterminado')
    expect(comprobante?.intentos[0]?.rastro?.mensajeOriginal).toBe(
      'socket hang up',
    )
  })

  it('el correlativo consumido no se devuelve', async () => {
    // Devolverlo exigiría saber que el proveedor no lo usó, y lo que define este
    // caso es que no se puede saber. Un hueco en la numeración se explica; un
    // número repetido en dos documentos fiscales, no.
    const { almacen, contexto, proveedor } = montarEscenario()
    proveedor.configurarEmision({ tipo: 'acepta_pero_no_contesta' })

    await expect(emitirComprobante(contexto, peticion())).rejects.toThrow()

    const serie = await almacen.leerSerie('vendedor-1__boleta')
    expect(serie?.ultimoNumero).toBe(1)
    // Y sigue sin confirmar, que es lo que lo pone en el radar del sondeo.
    expect(serie?.ultimoNumeroConfirmado).toBe(0)
  })
})
