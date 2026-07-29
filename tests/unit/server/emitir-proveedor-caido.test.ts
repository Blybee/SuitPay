import { describe, expect, it } from 'vitest'
import { emitirComprobante } from '../../../src/server/emision/emitir.ts'
import { montarEscenario, peticion } from './ayudas-emision.ts'

/**
 * El proveedor no responde (FR-050, FR-050a).
 *
 * A diferencia del caso indeterminado, aquí **se sabe con certeza que no se
 * emitió**: la petición no llegó a salir. Eso cambia todo lo que se puede hacer:
 * la venta queda en espera, se cobra, se entrega mercadería con un documento
 * interno y el comprobante real se emite al restablecerse el servicio.
 *
 * La diferencia entre este caso y el indeterminado es la razón de que la
 * clasificación de fallos exista, y confundirlos es lo que produce duplicados.
 */
describe('emisión con el proveedor caído', () => {
  it('deja la venta pendiente, no indeterminada', async () => {
    const { almacen, contexto, proveedor } = montarEscenario()
    proveedor.configurarEmision({ tipo: 'indisponible' })

    await expect(emitirComprobante(contexto, peticion())).rejects.toMatchObject({
      codigo: 'proveedor_no_disponible',
    })

    const [comprobante] = almacen.todosLosComprobantes()
    expect(comprobante?.estado).toBe('pendiente')
    // Nada quedó registrado del otro lado: es lo que hace segura la espera.
    expect(proveedor.documentosEmitidos).toBe(0)
  })

  it('conserva el pedido completo para poder emitirlo después', async () => {
    // El vendedor ya cobró y el cliente se fue con la mercadería. Si el pedido no
    // quedara guardado íntegro, la tarea programada no tendría qué emitir y habría
    // que reconstruirlo de memoria.
    const { almacen, contexto, proveedor } = montarEscenario()
    proveedor.configurarEmision({ tipo: 'indisponible' })

    await expect(emitirComprobante(contexto, peticion())).rejects.toThrow()

    const [comprobante] = almacen.todosLosComprobantes()
    expect(comprobante?.lineas).toHaveLength(1)
    expect(comprobante?.total).toBe(2_500)
    expect(comprobante?.serie).toBe('B001')
    expect(comprobante?.numero).toBe(1)
  })

  it('el mensaje al vendedor le dice qué hacer, no qué falló', async () => {
    // Se lee de pie y con el cliente delante: tiene que decir la acción.
    const { contexto, proveedor } = montarEscenario()
    proveedor.configurarEmision({ tipo: 'indisponible' })

    await expect(emitirComprobante(contexto, peticion())).rejects.toMatchObject({
      mensajeParaVendedor: expect.stringContaining('datos de contacto'),
    })
  })

  it('no propaga el mensaje crudo del proveedor', async () => {
    // FR-039 y principio III: el texto del proveedor se guarda en la traza para
    // diagnosticar, y no sale de ahí. Si llegara a la pantalla, cambiar de
    // proveedor cambiaría lo que lee el vendedor.
    const { almacen, contexto, proveedor } = montarEscenario()
    proveedor.configurarEmision({ tipo: 'indisponible' })

    let mensajeMostrado = ''
    try {
      await emitirComprobante(contexto, peticion())
    } catch (error) {
      mensajeMostrado = (error as { mensajeParaVendedor: string })
        .mensajeParaVendedor
    }

    expect(mensajeMostrado).not.toContain('fetch failed')

    // Pero sí está en la traza, donde sirve.
    const [comprobante] = almacen.todosLosComprobantes()
    expect(comprobante?.intentos[0]?.rastro?.mensajeOriginal).toBe(
      'fetch failed',
    )
  })

  it('el reintento programado puede volver a enviar desde pendiente', async () => {
    // La diferencia práctica con indeterminado: desde `pendiente` sí se puede
    // volver a invocar, porque consta que no se emitió nada.
    const { almacen, contexto, proveedor } = montarEscenario()
    proveedor.configurarEmision({ tipo: 'indisponible' })

    await expect(emitirComprobante(contexto, peticion())).rejects.toThrow()

    const [comprobante] = almacen.todosLosComprobantes()
    const { sePuedeInvocarEmision } = await import(
      '../../../src/server/emision/estados.ts'
    )

    expect(sePuedeInvocarEmision(comprobante?.estado ?? 'reclamado')).toBe(true)
  })
})
