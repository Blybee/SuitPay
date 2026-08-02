import { describe, expect, it } from 'vitest'
import { consultarContribuyente } from '../../../src/server/contribuyentes/consultar.ts'
import {
  hayCredencialesDelProveedor,
  proveedorReal,
} from './ayudas-proveedor-vivo.ts'

/**
 * Integración en vivo: consulta RUC/DNI contra el host de consultas.
 *
 * Si facturación autentica pero consultas responde 401 «Token incorrecto»,
 * el plan/demo no tiene habilitada la API de RUC/DNI — hay que pedirlo al
 * proveedor. Esta prueba **falla a propósito** en ese caso (no se salta).
 */

const hayCredenciales = hayCredencialesDelProveedor()

describe.skipIf(!hayCredenciales)(
  'consulta de contribuyente (proveedor real)',
  () => {
    it(
      'trae razón social de un RUC conocido (20337564373)',
      { timeout: 20_000 },
      async () => {
        const proveedor = proveedorReal()
        const crudo = await proveedor.consultarContribuyente({
          tipoDocumento: 'RUC',
          numeroDocumento: '20337564373',
        })

        if (
          !crudo.ok &&
          crudo.fallo.razon.startsWith('credenciales_rechazadas')
        ) {
          throw new Error(
            [
              'consultas.factpro.la rechazó el token (401 Token incorrecto).',
              'El mismo token SÍ autentica en api.factpro.la (facturación).',
              'Pedir al proveedor que habilite la API de consulta RUC/DNI',
              'para esta empresa/demo, o un token con ese permiso.',
              `detalle=${crudo.fallo.rastro.mensajeOriginal ?? '(sin mensaje)'}`,
            ].join(' '),
          )
        }

        expect(crudo.ok, JSON.stringify(crudo)).toBe(true)
        if (!crudo.ok) return

        const datos = await consultarContribuyente(
          { proveedor },
          { tipoDocumento: 'RUC', numeroDocumento: '20337564373' },
        )
        expect(datos.denominacion.length).toBeGreaterThan(3)
        expect(datos.denominacion).toMatch(/RIPLEY|TIENDAS/i)
        expect(datos.noHabido).toBe(false)
      },
    )

    it(
      'RUC inexistente se informa como no_encontrado (no como sesión)',
      { timeout: 20_000 },
      async () => {
        const proveedor = proveedorReal()
        const crudo = await proveedor.consultarContribuyente({
          tipoDocumento: 'RUC',
          numeroDocumento: '20000000001',
        })

        if (
          !crudo.ok &&
          crudo.fallo.razon.startsWith('credenciales_rechazadas')
        ) {
          throw new Error(
            'Misma bloqueo de credenciales en consultas — habilitar RUC/DNI con el proveedor.',
          )
        }

        await expect(
          consultarContribuyente(
            { proveedor },
            { tipoDocumento: 'RUC', numeroDocumento: '20000000001' },
          ),
        ).rejects.toMatchObject({ codigo: 'no_encontrado' })
      },
    )
  },
)
