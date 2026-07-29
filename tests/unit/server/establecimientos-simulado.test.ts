import { describe, expect, it } from 'vitest'
import { ProveedorSimulado } from '../../../src/server/proveedor/simulado.ts'

/**
 * T083 — crear / listar / eliminar establecimiento (simulado).
 */
describe('establecimientos en el proveedor simulado', () => {
  it('crea, lista y elimina un establecimiento', async () => {
    const proveedor = new ProveedorSimulado()

    const creado = await proveedor.crearEstablecimiento({
      nombre: 'Sede prueba',
      codigoAnexo: '0099',
      direccion: 'Av. Prueba 1',
      ubigeoId: '150101',
      correo: 'prueba@example.com',
    })

    expect(creado.ok).toBe(true)
    if (!creado.ok) return

    expect(creado.valor.codigoAnexo).toBe('0099')
    expect(creado.valor.id).toMatch(/^\d+$/)

    const lista = await proveedor.listarEstablecimientos()
    expect(lista.ok).toBe(true)
    if (!lista.ok) return
    expect(lista.valor.some((e) => e.id === creado.valor.id)).toBe(true)

    const baja = await proveedor.eliminarEstablecimiento(creado.valor.id)
    expect(baja.ok).toBe(true)

    const despues = await proveedor.listarEstablecimientos()
    expect(despues.ok).toBe(true)
    if (!despues.ok) return
    expect(despues.valor.some((e) => e.id === creado.valor.id)).toBe(false)

    expect(proveedor.llamadasA('crear_establecimiento')).toBe(1)
    expect(proveedor.llamadasA('eliminar_establecimiento')).toBe(1)
  })

  it('crear serie exige un establecimiento previo', async () => {
    const proveedor = new ProveedorSimulado()

    const sinSede = await proveedor.crearSerie({
      tipoDocumento: 'boleta',
      serie: 'B001',
      numeroInicial: 1,
      establecimientoId: '999',
    })
    expect(sinSede.ok).toBe(false)

    const sede = await proveedor.crearEstablecimiento({
      codigoAnexo: '0001',
      direccion: 'Calle 1',
      ubigeoId: '150101',
    })
    expect(sede.ok).toBe(true)
    if (!sede.ok) return

    const serie = await proveedor.crearSerie({
      tipoDocumento: 'boleta',
      serie: 'B001',
      numeroInicial: 1,
      establecimientoId: sede.valor.id,
    })
    expect(serie.ok).toBe(true)
    if (!serie.ok) return

    const bajaSerie = await proveedor.eliminarSerie(serie.valor.id)
    expect(bajaSerie.ok).toBe(true)
  })
})
