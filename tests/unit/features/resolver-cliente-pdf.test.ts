import { describe, expect, it } from 'vitest'
import { resolverEtiquetaClientePdf } from '../../../src/features/cotizaciones/resolver-cliente-pdf.ts'

describe('resolverEtiquetaClientePdf', () => {
  it('usa la denominación del índice cuando el documento coincide', () => {
    const r = resolverEtiquetaClientePdf(
      {
        tipoDocumento: 'RUC',
        numeroDocumento: '20123456789',
        denominacion: 'Nombre del modelo',
      },
      [{ numeroDocumento: '20123456789', denominacion: 'Cliente Test' }],
      null,
    )
    expect(r.etiqueta).toBe('Cliente Test')
    expect(r.cliente?.denominacion).toBe('Cliente Test')
  })

  it('usa la ficha registrada si existe', () => {
    const r = resolverEtiquetaClientePdf(
      {
        tipoDocumento: 'RUC',
        numeroDocumento: '20123456789',
        denominacion: 'Modelo',
      },
      [],
      {
        tipoDocumento: 'RUC',
        numeroDocumento: '20123456789',
        denominacion: 'Cliente Test',
      },
    )
    expect(r.etiqueta).toBe('Cliente Test')
  })

  it('sin documento queda Sin cliente', () => {
    const r = resolverEtiquetaClientePdf(null, [], null)
    expect(r.etiqueta).toBe('Sin cliente')
    expect(r.cliente).toBeNull()
  })

  it('si no está registrado usa la denominación del modelo solo como etiqueta', () => {
    const r = resolverEtiquetaClientePdf(
      {
        tipoDocumento: 'RUC',
        numeroDocumento: '20123456789',
        denominacion: 'Ferretería Sol',
      },
      [],
      null,
    )
    expect(r.etiqueta).toBe('Ferretería Sol')
    expect(r.cliente?.numeroDocumento).toBe('20123456789')
  })
})
