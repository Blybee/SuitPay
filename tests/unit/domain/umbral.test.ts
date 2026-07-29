import { describe, expect, it } from 'vitest'
import {
  evaluarIdentificacionDelComprador,
  seAcercaAlUmbral
  
} from '#/domain/documentos/umbral.ts'
import type {ClienteIdentificado} from '#/domain/documentos/umbral.ts';
import { centimosDesdeSoles } from '#/domain/totales/calculo.ts'

const UMBRAL = centimosDesdeSoles(700)

const CLIENTE: ClienteIdentificado = {
  tipoDocumento: 'DNI',
  numeroDocumento: '12345678',
  denominacion: 'Juan Pérez',
}

describe('umbral de identificación del comprador (FR-021)', () => {
  it('una boleta por debajo del umbral admite cliente eventual', () => {
    const resultado = evaluarIdentificacionDelComprador(
      'boleta',
      centimosDesdeSoles(699.99),
      null,
      UMBRAL,
    )
    expect(resultado.requiereCliente).toBe(false)
  })

  it('una boleta exactamente en el umbral todavía lo admite', () => {
    // La norma dice "supere", así que el umbral exacto no lo supera. Es la clase
    // de frontera que se implementa mal la primera vez.
    const resultado = evaluarIdentificacionDelComprador(
      'boleta',
      UMBRAL,
      null,
      UMBRAL,
    )
    expect(resultado.requiereCliente).toBe(false)
  })

  it('una boleta que supera el umbral exige identificar al cliente', () => {
    const resultado = evaluarIdentificacionDelComprador(
      'boleta',
      UMBRAL + 1,
      null,
      UMBRAL,
    )
    expect(resultado.requiereCliente).toBe(true)
    if (resultado.requiereCliente) {
      expect(resultado.motivo).toBe('supera_umbral')
    }
  })

  it('con cliente identificado el importe deja de importar', () => {
    const resultado = evaluarIdentificacionDelComprador(
      'boleta',
      centimosDesdeSoles(50_000),
      CLIENTE,
      UMBRAL,
    )
    expect(resultado.requiereCliente).toBe(false)
  })

  it('una factura exige cliente aunque el importe sea mínimo', () => {
    const resultado = evaluarIdentificacionDelComprador(
      'factura',
      centimosDesdeSoles(1),
      null,
      UMBRAL,
    )
    expect(resultado.requiereCliente).toBe(true)
    if (resultado.requiereCliente) {
      expect(resultado.motivo).toBe('tipo_lo_exige')
    }
  })

  it('una nota de venta no está sujeta al umbral', () => {
    const resultado = evaluarIdentificacionDelComprador(
      'nota_venta',
      centimosDesdeSoles(50_000),
      null,
      UMBRAL,
    )
    expect(resultado.requiereCliente).toBe(false)
  })

  it('el umbral llega como argumento, así que un cambio de norma se respeta', () => {
    // Si mañana la norma sube el umbral a 1000, basta cambiar config/parametros:
    // la misma venta que antes lo superaba deja de superarlo sin tocar código.
    const venta = centimosDesdeSoles(800)
    const conUmbralViejo = evaluarIdentificacionDelComprador(
      'boleta',
      venta,
      null,
      centimosDesdeSoles(700),
    )
    const conUmbralNuevo = evaluarIdentificacionDelComprador(
      'boleta',
      venta,
      null,
      centimosDesdeSoles(1000),
    )

    expect(conUmbralViejo.requiereCliente).toBe(true)
    expect(conUmbralNuevo.requiereCliente).toBe(false)
  })
})

describe('aviso de acercamiento al umbral', () => {
  it('avisa antes de llegar, para poder pedir los datos con el cliente delante', () => {
    expect(
      seAcercaAlUmbral('boleta', centimosDesdeSoles(650), null, UMBRAL),
    ).toBe(true)
  })

  it('no avisa cuando aún queda mucho', () => {
    expect(
      seAcercaAlUmbral('boleta', centimosDesdeSoles(100), null, UMBRAL),
    ).toBe(false)
  })

  it('no avisa si ya se superó: eso ya no es un aviso, es un bloqueo', () => {
    expect(
      seAcercaAlUmbral('boleta', centimosDesdeSoles(900), null, UMBRAL),
    ).toBe(false)
  })
})
