import { describe, expect, it } from 'vitest'
import { emitirComprobante } from '../../../src/server/emision/emitir.ts'
import { montarEscenario, peticion } from './ayudas-emision.ts'

/**
 * La prueba más importante del sistema (FR-028, principio II).
 *
 * Comprueba dos cosas, y la segunda es la que de verdad importa: no solo que
 * quede **un** comprobante, sino que **al proveedor no se le llamó dos veces**.
 * Mirar solo el estado final no bastaría, porque un estado final correcto se
 * puede alcanzar habiendo emitido dos documentos y quedándose con el último. Eso
 * dejaría un comprobante fiscal huérfano en el proveedor que nadie sabría que hay
 * que anular.
 */
describe('idempotencia de la emisión', () => {
  it('dos invocaciones con la misma clave producen un solo comprobante', async () => {
    const { almacen, proveedor, contexto } = montarEscenario()
    const peticionDeVenta = peticion()

    const primera = await emitirComprobante(contexto, peticionDeVenta)
    const segunda = await emitirComprobante(contexto, peticionDeVenta)

    expect(primera.yaExistia).toBe(false)
    expect(segunda.yaExistia).toBe(true)

    expect(almacen.totalDeComprobantes).toBe(1)
    // La afirmación decisiva: el proveedor se invocó una sola vez.
    expect(proveedor.llamadasA('emitir')).toBe(1)
    expect(proveedor.documentosEmitidos).toBe(1)
  })

  it('la segunda invocación devuelve la misma numeración, no la siguiente', async () => {
    // Si el correlativo se consumiera otra vez, el reintento devolvería un número
    // distinto y el vendedor tendría dos papeles con distinta numeración para una
    // sola venta.
    const { almacen, contexto } = montarEscenario()
    const peticionDeVenta = peticion()

    const primera = await emitirComprobante(contexto, peticionDeVenta)
    const segunda = await emitirComprobante(contexto, peticionDeVenta)

    expect(segunda.serie).toBe(primera.serie)
    expect(segunda.numero).toBe(primera.numero)

    const serie = await almacen.leerSerie(`vendedor-1__boleta`)
    expect(serie?.ultimoNumero).toBe(1)
  })

  it('dos pulsaciones simultáneas producen un solo comprobante', async () => {
    // El doble clic real: las dos peticiones salen antes de que la primera
    // conteste. Es el caso que la transacción existe para cubrir, y el que un
    // "compruebo si existe y luego creo" sin atomicidad dejaría pasar.
    const { almacen, proveedor, contexto } = montarEscenario()
    const peticionDeVenta = peticion()

    const [primera, segunda] = await Promise.all([
      emitirComprobante(contexto, peticionDeVenta),
      emitirComprobante(contexto, peticionDeVenta),
    ])

    expect(almacen.totalDeComprobantes).toBe(1)
    expect(proveedor.llamadasA('emitir')).toBe(1)

    // Una de las dos tuvo que ver el comprobante ya creado.
    const existieron = [primera.yaExistia, segunda.yaExistia]
    expect(existieron).toContain(true)
    expect(existieron).toContain(false)
  })

  it('claves distintas sí producen comprobantes distintos', async () => {
    // La contraparte: la idempotencia no debe volverse tan agresiva que impida
    // vender dos veces lo mismo al mismo cliente, que en un mostrador pasa.
    const { almacen, contexto } = montarEscenario()

    const primera = await emitirComprobante(contexto, peticion())
    const segunda = await emitirComprobante(contexto, peticion())

    expect(almacen.totalDeComprobantes).toBe(2)
    expect(segunda.numero).toBe((primera.numero ?? 0) + 1)
  })

  it('un reintento tras un rechazo no vuelve a llamar al proveedor', async () => {
    // Un rechazo es definitivo: la corrección es un documento nuevo con su propia
    // clave. Reintentar con la misma clave devuelve el rechazo, no otra llamada.
    const { proveedor, contexto } = montarEscenario()
    proveedor.configurarEmision({ tipo: 'rechazo_definitivo' })
    const peticionDeVenta = peticion()

    await expect(
      emitirComprobante(contexto, peticionDeVenta),
    ).rejects.toMatchObject({ codigo: 'emision_rechazada' })

    const segunda = await emitirComprobante(contexto, peticionDeVenta)

    expect(segunda.yaExistia).toBe(true)
    expect(segunda.estado).toBe('rechazado')
    expect(proveedor.llamadasA('emitir')).toBe(1)
  })
})
