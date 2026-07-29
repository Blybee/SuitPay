import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ProveedorFactpro } from '../../../src/server/proveedor/factpro/index.ts'

/**
 * T083 — prueba en vivo (demo) de crear y eliminar establecimiento.
 *
 * Se salta si no hay `PROVEEDOR_TOKEN` (p. ej. CI sin secretos).
 * Carga `.env.local` sin imprimir el token.
 */

function cargarEnvLocal(): void {
  try {
    const texto = readFileSync(resolve('.env.local'), 'utf8')
    for (const linea of texto.split('\n')) {
      const limpia = linea.trim()
      if (limpia === '' || limpia.startsWith('#')) continue
      const igual = limpia.indexOf('=')
      if (igual <= 0) continue
      const clave = limpia.slice(0, igual).trim()
      const valor = limpia.slice(igual + 1).trim()
      if (process.env[clave] === undefined) {
        process.env[clave] = valor
      }
    }
  } catch {
    // Sin .env.local: la prueba se salta.
  }
}

cargarEnvLocal()

const hayToken =
  typeof process.env.PROVEEDOR_TOKEN === 'string' &&
  process.env.PROVEEDOR_TOKEN.length > 0 &&
  typeof process.env.PROVEEDOR_URL_BASE === 'string' &&
  process.env.PROVEEDOR_URL_BASE.length > 0

describe.skipIf(!hayToken)(
  'establecimientos y series en el proveedor (demo en vivo)',
  () => {
    it(
      'crea un establecimiento, aparece en el listado y se puede eliminar',
      { timeout: 30_000 },
      async () => {
        const proveedor = new ProveedorFactpro()
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
        const proveedor = new ProveedorFactpro()
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
