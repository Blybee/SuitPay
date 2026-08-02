import { describe, expect, it } from 'vitest'
import {
  hayCredencialesDelProveedor,
  proveedorReal,
} from './ayudas-proveedor-vivo.ts'

/**
 * T083 — prueba en vivo (demo) de crear/eliminar establecimiento y serie.
 * Se salta si no hay credenciales (p. ej. CI sin secretos).
 */

const hayCredenciales = hayCredencialesDelProveedor()

describe.skipIf(!hayCredenciales)(
  'establecimientos y series en el proveedor (demo en vivo)',
  () => {
    it(
      'crea un establecimiento, aparece en el listado y se puede eliminar',
      { timeout: 30_000 },
      async () => {
        const proveedor = proveedorReal()
        const anexo = `9${String(Date.now()).slice(-3)}`

        const creado = await proveedor.crearEstablecimiento({
          nombre: `SuitPay test ${anexo}`,
          codigoAnexo: anexo,
          direccion: 'Av. Prueba SuitPay 1',
          ubigeoId: '150101',
          correo: 'suitpay-test@example.com',
        })

        expect(creado.ok, JSON.stringify(creado)).toBe(true)
        if (!creado.ok) return

        const id = creado.valor.id
        expect(id).toMatch(/^\d+$/)

        const lista = await proveedor.listarEstablecimientos()
        expect(lista.ok).toBe(true)
        if (!lista.ok) return
        expect(
          lista.valor.some((e) => e.id === id || e.codigoAnexo === anexo),
        ).toBe(true)

        const baja = await proveedor.eliminarEstablecimiento(id)
        expect(baja.ok, JSON.stringify(baja)).toBe(true)

        const despues = await proveedor.listarEstablecimientos()
        expect(despues.ok).toBe(true)
        if (!despues.ok) return
        expect(
          despues.valor.some((e) => e.id === id || e.codigoAnexo === anexo),
        ).toBe(false)
      },
    )

    it(
      'crea y elimina una serie de boleta sobre un establecimiento existente',
      { timeout: 30_000 },
      async () => {
        const proveedor = proveedorReal()
        const lista = await proveedor.listarEstablecimientos()
        expect(lista.ok).toBe(true)
        if (!lista.ok) return

        const sede =
          lista.valor.find((e) => e.codigoAnexo === '0000') ?? lista.valor[0]
        expect(sede).toBeDefined()

        const serie = `B${String(Date.now()).slice(-3)}`
        const creada = await proveedor.crearSerie({
          tipoDocumento: 'boleta',
          serie,
          numeroInicial: 1,
          establecimientoId: sede!.id,
        })
        expect(creada.ok, JSON.stringify(creada)).toBe(true)
        if (!creada.ok) return

        const baja = await proveedor.eliminarSerie(creada.valor.id)
        expect(baja.ok, JSON.stringify(baja)).toBe(true)
      },
    )
  },
)
