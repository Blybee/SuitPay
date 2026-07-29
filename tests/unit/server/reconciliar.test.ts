import { describe, expect, it } from 'vitest'
import { emitirComprobante } from '../../../src/server/emision/emitir.ts'
import { reconciliarEmisiones } from '../../../src/server/emision/reconciliar.ts'
import { montarEscenario, peticion } from './ayudas-emision.ts'

/**
 * La reconciliación.
 *
 * Es la contrapartida obligatoria de prohibir el reintento. Sin ella, cada
 * respuesta ausente sería una venta abandonada y el vendedor acabaría emitiendo a
 * mano un segundo comprobante, que es justo lo que la prohibición evitaba.
 *
 * La afirmación que más importa de todas las de este archivo es que **nunca
 * emite**: se comprueba contando las llamadas a `emitir` del proveedor.
 */
describe('reconciliación de emisiones', () => {
  it('adopta el estado real cuando el documento sí existía', async () => {
    // El caso traicionero: el proveedor registró el documento y nosotros nunca lo
    // supimos. La reconciliación lo encuentra y cierra la venta.
    const { almacen, contexto, proveedor } = montarEscenario()
    proveedor.configurarEmision({ tipo: 'acepta_pero_no_contesta' })

    await expect(emitirComprobante(contexto, peticion())).rejects.toThrow()
    expect(almacen.todosLosComprobantes()[0]?.estado).toBe('indeterminado')

    const llamadasAEmitirAntes = proveedor.llamadasA('emitir')
    const resumen = await reconciliarEmisiones({
      almacen,
      proveedor,
      ahora: () => new Date('2026-07-28T15:10:00Z'),
    })

    expect(resumen.resueltos).toBe(1)
    expect(almacen.todosLosComprobantes()[0]?.estado).toBe('enviado')
    // No emitió. Ni una llamada más.
    expect(proveedor.llamadasA('emitir')).toBe(llamadasAEmitirAntes)
  })

  it('nunca emite, ni cuando el documento no existe', async () => {
    // Cuando consta que no se emitió, la venta pasa a `pendiente` para que la
    // emita `procesarPendientes`. Así el camino de emisión sigue siendo único, que
    // es lo que hace auditable la garantía.
    const { almacen, contexto, proveedor } = montarEscenario()
    proveedor.configurarEmision({ tipo: 'indeterminado' })

    await expect(emitirComprobante(contexto, peticion())).rejects.toThrow()

    const antes = proveedor.llamadasA('emitir')
    const resumen = await reconciliarEmisiones({
      almacen,
      proveedor,
      ahora: () => new Date('2026-07-28T15:10:00Z'),
    })

    expect(resumen.sinDocumento).toBe(1)
    expect(almacen.todosLosComprobantes()[0]?.estado).toBe('pendiente')
    expect(proveedor.llamadasA('emitir')).toBe(antes)
  })

  it('una consulta fallida NO da la venta por no emitida', async () => {
    // El error más caro posible aquí. Si una consulta caída se interpretara como
    // "no existe", habilitaría un reintento sobre un documento que puede existir.
    const { almacen, contexto, proveedor } = montarEscenario()
    proveedor.configurarEmision({ tipo: 'acepta_pero_no_contesta' })
    await expect(emitirComprobante(contexto, peticion())).rejects.toThrow()

    proveedor.configurarConsulta({ tipo: 'indisponible' })
    const resumen = await reconciliarEmisiones({
      almacen,
      proveedor,
      ahora: () => new Date('2026-07-28T15:10:00Z'),
    })

    expect(resumen.noSePudoConsultar).toBe(1)
    // Sigue indeterminado, esperando el siguiente barrido.
    expect(almacen.todosLosComprobantes()[0]?.estado).toBe('indeterminado')
  })

  it('barre también los reclamado envejecidos', async () => {
    // El proceso que murió entre la llamada al proveedor y la escritura del
    // resultado. Sin este barrido esas ventas quedarían invisibles para siempre en
    // un estado que parece transitorio.
    const { almacen, proveedor } = montarEscenario()
    almacen.sembrarComprobante({
      id: 'atascado',
      estado: 'reclamado',
      tipoDocumento: 'boleta',
      serie: 'B001',
      numero: 7,
      cliente: null,
      lineas: [],
      total: 2_500,
      condicionPago: {
        tipo: 'contado',
        fechaVencimiento: null,
        estadoCobro: 'no_aplica',
      },
      medioPago: null,
      vendedorId: 'vendedor-1',
      emitidoEn: new Date('2026-07-28T14:00:00Z'),
      proveedor: null,
      cotizacionId: null,
      capturaId: null,
      contacto: null,
      intentos: [],
      anulacion: null,
    })

    const resumen = await reconciliarEmisiones({
      almacen,
      proveedor,
      ahora: () => new Date('2026-07-28T15:00:00Z'),
    })

    expect(resumen.revisados).toBe(1)
    // El proveedor no tiene nada en B001-7, así que la venta puede reintentarse.
    expect(resumen.sinDocumento).toBe(1)
  })

  it('no toca un reclamado recién creado', async () => {
    // Puede estar en vuelo ahora mismo. Barrerlo sería competir con la emisión.
    const { almacen, proveedor, contexto } = montarEscenario()
    await emitirComprobante(contexto, peticion())

    const resumen = await reconciliarEmisiones({
      almacen,
      proveedor,
      ahora: () => new Date('2026-07-28T15:00:30Z'),
    })

    expect(resumen.revisados).toBe(0)
  })

  it('manda a intervención un documento ajeno en ese número', async () => {
    // Ocurriría si el proveedor no respetase el número explícito, que es lo que
    // T027 tiene que descartar. Adoptar un documento ajeno sería peor que revisar.
    const { almacen, contexto, proveedor } = montarEscenario()
    proveedor.configurarEmision({ tipo: 'acepta_pero_no_contesta' })
    await expect(
      emitirComprobante(
        contexto,
        peticion({
          lineas: [
            {
              codigo: 'X',
              descripcion: 'OTRA VENTA',
              unidad: 'UND',
              cantidad: 1,
              precio: 9_900,
            },
          ],
        }),
      ),
    ).rejects.toThrow()

    // Se manipula el total guardado para simular que el número lo ocupa otra
    // venta con otro importe.
    const guardado = almacen.todosLosComprobantes()[0]
    if (guardado !== undefined) {
      almacen.sembrarComprobante({ ...guardado, total: 12_345 })
    }

    const resumen = await reconciliarEmisiones({
      almacen,
      proveedor,
      ahora: () => new Date('2026-07-28T15:10:00Z'),
    })

    expect(resumen.requierenIntervencion).toBe(1)
    expect(almacen.todosLosComprobantes()[0]?.estado).toBe(
      'requiere_intervencion',
    )
  })

  it('deja constancia de cada intento en la traza', async () => {
    const { almacen, contexto, proveedor } = montarEscenario()
    proveedor.configurarEmision({ tipo: 'acepta_pero_no_contesta' })
    await expect(emitirComprobante(contexto, peticion())).rejects.toThrow()

    await reconciliarEmisiones({
      almacen,
      proveedor,
      ahora: () => new Date('2026-07-28T15:10:00Z'),
    })

    const comprobante = almacen.todosLosComprobantes()[0]
    expect(comprobante?.intentos.length).toBeGreaterThanOrEqual(2)
    expect(comprobante?.intentos.at(-1)?.razon).toContain('reconciliado')
  })
})
