import { describe, expect, it } from 'vitest'
import {
  hayCredencialesDelProveedor,
  proveedorReal,
} from './ayudas-proveedor-vivo.ts'

/**
 * Antes usaba ProveedorSimulado. Ahora valida contra el proveedor real
 * (mismo contrato que T083 / establecimientos-demo).
 */

const hayCredenciales = hayCredencialesDelProveedor()

describe.skipIf(!hayCredenciales)(
  'establecimientos en el proveedor real',
  () => {
    it(
      'lista establecimientos (cuenta demo puede venir vacía)',
      { timeout: 20_000 },
      async () => {
        const proveedor = proveedorReal()
        const lista = await proveedor.listarEstablecimientos()
        expect(lista.ok, JSON.stringify(lista)).toBe(true)
        if (!lista.ok) return
        expect(Array.isArray(lista.valor)).toBe(true)
        if (lista.valor[0] !== undefined) {
          expect(lista.valor[0].id).toMatch(/^\d+$/)
        }
      },
    )

    it(
      'crear y eliminar un establecimiento temporal',
      { timeout: 30_000 },
      async () => {
        const proveedor = proveedorReal()
        const anexo = `9${String(Date.now()).slice(-3)}`

        const creado = await proveedor.crearEstablecimiento({
          nombre: `SuitPay live ${anexo}`,
          codigoAnexo: anexo,
          direccion: 'Av. Prueba SuitPay 1',
          ubigeoId: '150101',
          correo: 'suitpay-test@example.com',
        })
        expect(creado.ok, JSON.stringify(creado)).toBe(true)
        if (!creado.ok) return

        const baja = await proveedor.eliminarEstablecimiento(creado.valor.id)
        expect(baja.ok, JSON.stringify(baja)).toBe(true)
      },
    )
  },
)
