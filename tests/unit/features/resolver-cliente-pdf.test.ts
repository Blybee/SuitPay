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

  it('el cliente indicado por el vendedor gana aunque el modelo no detecte', () => {
    const r = resolverEtiquetaClientePdf(null, [], null, {
      tipoDocumento: 'DNI',
      numeroDocumento: '00000000',
      denominacion: 'Ferretería Sol',
    })
    expect(r.etiqueta).toBe('Ferretería Sol')
    expect(r.cliente?.denominacion).toBe('Ferretería Sol')
    expect(r.cliente?.numeroDocumento).toBe('00000000')
  })

  it('el cliente registrado indicado gana sobre el detectado en el PDF', () => {
    const r = resolverEtiquetaClientePdf(
      {
        tipoDocumento: 'RUC',
        numeroDocumento: '20123456789',
        denominacion: 'Nombre del modelo',
      },
      [],
      null,
      {
        tipoDocumento: 'RUC',
        numeroDocumento: '20123456789',
        denominacion: 'Cliente Test',
      },
    )
    expect(r.etiqueta).toBe('Cliente Test')
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
