import { describe, expect, it } from 'vitest'
import {
  destinoDeRol,
  elJefeDebeAbandonarLaRuta,
} from '#/features/sesion/destino.ts'

describe('destino de la sesión', () => {
  it('manda al jefe al fichaje y al administrador a administración', () => {
    expect(destinoDeRol('jefe')).toBe('/fichaje')
    expect(destinoDeRol('administrador')).toBe('/administracion')
    expect(destinoDeRol('vendedor')).toBe('/')
    expect(destinoDeRol(null)).toBe('/')
  })

  it('el jefe no se queda en el mostrador ni en pantallas de venta', () => {
    expect(elJefeDebeAbandonarLaRuta('jefe', '/')).toBe(true)
    expect(elJefeDebeAbandonarLaRuta('jefe', '/comprobantes')).toBe(true)
    expect(elJefeDebeAbandonarLaRuta('jefe', '/configuracion')).toBe(true)
    expect(elJefeDebeAbandonarLaRuta('jefe', '/cotizaciones')).toBe(true)
  })

  it('el jefe sí permanece en fichaje, administración y pantallas públicas', () => {
    expect(elJefeDebeAbandonarLaRuta('jefe', '/fichaje')).toBe(false)
    expect(elJefeDebeAbandonarLaRuta('jefe', '/administracion')).toBe(false)
    expect(elJefeDebeAbandonarLaRuta('jefe', '/administracion/catalogo')).toBe(
      false,
    )
    expect(elJefeDebeAbandonarLaRuta('jefe', '/acceso')).toBe(false)
    expect(elJefeDebeAbandonarLaRuta('jefe', '/fichar')).toBe(false)
  })

  it('un vendedor o una sesión sin rol no disparan la salida del jefe', () => {
    expect(elJefeDebeAbandonarLaRuta('vendedor', '/')).toBe(false)
    expect(elJefeDebeAbandonarLaRuta('administrador', '/')).toBe(false)
    expect(elJefeDebeAbandonarLaRuta(null, '/')).toBe(false)
  })
})
