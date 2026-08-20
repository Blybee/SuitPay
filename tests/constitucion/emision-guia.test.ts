import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { emitirGuia } from '../../src/server/emision/emitir-guia.ts'
import { montarEscenario } from '../unit/server/ayudas-emision.ts'
import {
  peticionGuia,
} from '../unit/server/guia-frontera.test.ts'

const RAIZ = join(import.meta.dirname, '../..')

describe('constitución — emitir guía', () => {
  it('la puerta exige identidad y clave; no toma vendedorId del body', () => {
    const puerta = readFileSync(
      join(RAIZ, 'src/features/guia/guia.funciones.ts'),
      'utf8',
    )
    expect(puerta).toMatch(/exigirIdentidad/)
    expect(puerta).toMatch(/vendedorId:\s*identidad\.uid/)
    expect(puerta).not.toMatch(/vendedorId:\s*data\./)
    expect(puerta).toMatch(/claveIdempotencia:\s*z\.string\(\)\.min\(8\)/)
  })

  it('doble Emitir con la misma clave no llama dos veces al proveedor', async () => {
    const { contexto, proveedor } = montarEscenario({ series: ['guia'] })
    const peticion = peticionGuia({ claveIdempotencia: 'guia-doble-1' })

    const primera = await emitirGuia(contexto, peticion)
    const segunda = await emitirGuia(contexto, peticion)

    expect(primera.yaExistia).toBe(false)
    expect(segunda.yaExistia).toBe(true)
    expect(proveedor.llamadasA('emitir_guia')).toBe(1)
  })

  it('respuesta ausente no reintenta a ciegas', async () => {
    const { contexto, proveedor, almacen } = montarEscenario({
      series: ['guia'],
    })
    proveedor.configurarEmision({ tipo: 'acepta_pero_no_contesta' })
    const peticion = peticionGuia({ claveIdempotencia: 'guia-ausente-1' })

    await expect(emitirGuia(contexto, peticion)).rejects.toMatchObject({
      codigo: 'emision_indeterminada',
    })
    expect(proveedor.llamadasA('emitir_guia')).toBe(1)

    const guardado = await almacen.leerComprobante(peticion.claveIdempotencia)
    expect(guardado?.estado).toBe('indeterminado')

    const segunda = await emitirGuia(contexto, peticion)
    expect(segunda.yaExistia).toBe(true)
    expect(proveedor.llamadasA('emitir_guia')).toBe(1)
  })

  it('fallo del proveedor deja el correlativo consumido y no duplica', async () => {
    const { contexto, proveedor, almacen } = montarEscenario({
      series: ['guia'],
    })
    proveedor.configurarEmision({ tipo: 'rechazo_definitivo' })
    const peticion = peticionGuia({ claveIdempotencia: 'guia-rechazo-1' })

    await expect(emitirGuia(contexto, peticion)).rejects.toMatchObject({
      codigo: 'emision_rechazada',
    })
    const guardado = await almacen.leerComprobante(peticion.claveIdempotencia)
    expect(guardado?.numero).not.toBeNull()
    expect(proveedor.llamadasA('emitir_guia')).toBe(1)
  })

  it('sin serie configurada no invoca al proveedor', async () => {
    const { contexto, proveedor } = montarEscenario({ series: ['boleta'] })
    await expect(emitirGuia(contexto, peticionGuia())).rejects.toMatchObject({
      codigo: 'serie_no_configurada',
    })
    expect(proveedor.llamadasA('emitir_guia')).toBe(0)
  })
})
