import { describe, expect, it } from 'vitest'
import {
  aplicarFactorARenglon,
  canonicoDeEmpaque,
  evidenciaSimulada,
  factorDesdeEvidencia,
  factorDeUnidad,
  fusionarCantidades,
  textoDeFactor,
} from '../../../src/domain/aprendizaje/cantidades.ts'

describe('léxico de empaque', () => {
  it('normaliza alias a la clave canónica', () => {
    expect(canonicoDeEmpaque('Bolsas')).toBe('bolsa')
    expect(canonicoDeEmpaque('bls.')).toBe('bolsa')
    expect(canonicoDeEmpaque('cja')).toBe('caja')
    expect(canonicoDeEmpaque('paq')).toBe('paquete')
    expect(canonicoDeEmpaque('1/2')).toBeNull()
    expect(canonicoDeEmpaque('unidades')).toBeNull()
  })
})

describe('factorDesdeEvidencia', () => {
  it('1 bolsa y 25 unidades del oro dan 25', () => {
    expect(
      factorDesdeEvidencia({ unidad: 'bolsa', bultos: 1, unidades: 25 }),
    ).toEqual({ unidad: 'bolsa', factor: 25 })
  })

  it('descarta una división que no es entera', () => {
    expect(
      factorDesdeEvidencia({ unidad: 'saco', bultos: 2, unidades: 25 }),
    ).toBeNull()
  })

  it('no aprende docena: el múltiplo fijo vive en código', () => {
    expect(
      factorDesdeEvidencia({ unidad: 'docena', bultos: 1, unidades: 12 }),
    ).toBeNull()
  })

  it('un factor de 1 no es conversión', () => {
    expect(
      factorDesdeEvidencia({ unidad: 'caja', bultos: 4, unidades: 4 }),
    ).toBeNull()
  })
})

describe('factorDeUnidad', () => {
  it('el valor aprendido gana sobre el múltiplo fijo', () => {
    expect(factorDeUnidad('docena')).toBe(12)
    expect(factorDeUnidad('docenas', { docena: 10 })).toBe(10)
    expect(factorDeUnidad('bolsa', { bolsa: 25 })).toBe(25)
    expect(factorDeUnidad('bolsa')).toBeNull()
  })
})

describe('fusionarCantidades', () => {
  it('reemplaza una clave y conserva las demás', () => {
    expect(
      fusionarCantidades({ bolsa: 25, saco: 50 }, [
        { unidad: 'bolsa', factor: 30 },
      ]),
    ).toEqual({ bolsa: 30, saco: 50 })
  })

  it('un conflicto dentro del par deja la clave como estaba', () => {
    expect(
      fusionarCantidades({ bolsa: 25 }, [
        { unidad: 'bolsa', factor: 25 },
        { unidad: 'bolsa', factor: 50 },
      ]),
    ).toEqual({ bolsa: 25 })
  })
})

describe('aplicarFactorARenglon', () => {
  it('multiplica los bultos una sola vez', () => {
    expect(
      aplicarFactorARenglon({
        cantidad: 25,
        unidad: 'NIU',
        bultos: 1,
        unidadEmpaque: 'bolsa',
        cantidades: { bolsa: 25 },
      }),
    ).toEqual({ cantidad: 25, unidad: 'NIU' })
  })

  it('2 bolsas con factor 25 son 50 unidades', () => {
    expect(
      aplicarFactorARenglon({
        cantidad: 2,
        unidad: 'bolsa',
        bultos: 2,
        unidadEmpaque: 'bolsa',
        cantidades: { bolsa: 25 },
      }),
    ).toEqual({ cantidad: 50, unidad: 'NIU' })
  })

  it('sin factor conocido deja la cantidad dicha', () => {
    expect(
      aplicarFactorARenglon({
        cantidad: 1,
        unidad: 'bolsa',
        bultos: 1,
        unidadEmpaque: 'bolsa',
      }),
    ).toEqual({ cantidad: 1, unidad: 'bolsa' })
  })

  it('25 unidades no se multiplica', () => {
    expect(
      aplicarFactorARenglon({
        cantidad: 25,
        unidad: 'unidades',
        cantidades: { bolsa: 25 },
      }),
    ).toEqual({ cantidad: 25, unidad: 'unidades' })
  })

  it('una docena sin mapa aprendido son 12', () => {
    expect(
      aplicarFactorARenglon({
        cantidad: 1,
        unidad: 'docena',
        bultos: 1,
        unidadEmpaque: 'docena',
      }),
    ).toEqual({ cantidad: 12, unidad: 'NIU' })
  })
})

describe('evidenciaSimulada', () => {
  it('lee 1 bolsa y la cantidad del oro junto al SKU', () => {
    expect(
      evidenciaSimulada(
        '1 bolsa unión 1/2 pavco',
        'PAVCO-U12 UNION PVC\nCANTIDAD: 25',
        'PAVCO-U12',
      ),
    ).toEqual({ unidad: 'bolsa', bultos: 1, unidades: 25 })
  })
})

describe('textoDeFactor', () => {
  it('distingue alta y reemplazo', () => {
    expect(textoDeFactor('bolsa', 25)).toBe('bolsa = 25 u')
    expect(textoDeFactor('bolsa', 50, 25)).toBe('bolsa: 25 → 50')
  })
})
