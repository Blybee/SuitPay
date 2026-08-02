import { describe, expect, it, vi } from 'vitest'
import { consultarContribuyente } from '../../../src/server/contribuyentes/consultar.ts'
import { ProveedorSimulado } from '../../../src/server/proveedor/simulado.ts'

/**
 * Modos de fallo de la consulta — **solo aquí** se usa el simulado.
 *
 * No se pueden inyectar «indisponible» ni «credenciales_rechazadas» a voluntad
 * en el proveedor real. El camino feliz y el contrato HTTP viven en
 * `contribuyente-demo.test.ts` (proveedor real).
 */

describe('consultarContribuyente (inyección de fallos)', () => {
  it('señala explícitamente la condición de no habido', async () => {
    const proveedor = new ProveedorSimulado()
    proveedor.configurarContribuyente({
      tipo: 'exito',
      condicion: 'NO HABIDO',
    })

    const datos = await consultarContribuyente(
      { proveedor },
      { tipoDocumento: 'RUC', numeroDocumento: '20999999999' },
    )

    expect(datos.noHabido).toBe(true)
    expect(datos.condicion).toMatch(/NO HABIDO/i)
  })

  it('ante servicio caído devuelve error que no bloquea la venta', async () => {
    const proveedor = new ProveedorSimulado()
    proveedor.configurarContribuyente({ tipo: 'indisponible' })

    await expect(
      consultarContribuyente(
        { proveedor },
        { tipoDocumento: 'DNI', numeroDocumento: '12345678' },
      ),
    ).rejects.toMatchObject({ codigo: 'servicio_no_disponible' })
  })

  it('contribuyente inexistente se informa sin crear nada', async () => {
    const proveedor = new ProveedorSimulado()
    proveedor.configurarContribuyente({ tipo: 'rechazo_definitivo' })
    const crearEspia = vi.fn()

    await expect(
      consultarContribuyente(
        { proveedor },
        { tipoDocumento: 'RUC', numeroDocumento: '20000000000' },
      ),
    ).rejects.toMatchObject({ codigo: 'no_encontrado' })
    expect(crearEspia).not.toHaveBeenCalled()
  })

  it('credenciales rechazadas no se disfrazan de «no encontrado»', async () => {
    const proveedor = new ProveedorSimulado()
    proveedor.configurarContribuyente({
      tipo: 'rechazo_definitivo',
      motivo: 'credenciales_rechazadas_401',
    })

    await expect(
      consultarContribuyente(
        { proveedor },
        { tipoDocumento: 'RUC', numeroDocumento: '20337564373' },
      ),
    ).rejects.toMatchObject({ codigo: 'servicio_no_disponible' })
  })
})
