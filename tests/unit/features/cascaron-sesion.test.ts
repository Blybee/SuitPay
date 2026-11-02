import { describe, expect, it } from 'vitest'
import { vistaDeCascaron } from '../../../src/features/sesion/cascaron.ts'

describe('vistaDeCascaron', () => {
  it('sin sesión, con el destino ya en /acceso, pinta la ruta pública y no vuelve a navegar', () => {
    expect(
      vistaDeCascaron({
        pathnameDestino: '/acceso',
        pathnameEnPantalla: '/',
        cargandoSesion: false,
        sinSesion: true,
        rol: null,
      }),
    ).toBe('publica')
  })

  it('sin sesión, todavía en /, manda a /acceso una sola vez', () => {
    expect(
      vistaDeCascaron({
        pathnameDestino: '/',
        pathnameEnPantalla: '/',
        cargandoSesion: false,
        sinSesion: true,
        rol: null,
      }),
    ).toBe('ir-a-acceso')
  })

  it('el jefe en el mostrador va a /fichaje, y no repite el salto cuando el destino ya es /fichaje', () => {
    expect(
      vistaDeCascaron({
        pathnameDestino: '/',
        pathnameEnPantalla: '/',
        cargandoSesion: false,
        sinSesion: false,
        rol: 'jefe',
      }),
    ).toBe('ir-a-fichaje')
    expect(
      vistaDeCascaron({
        pathnameDestino: '/fichaje',
        pathnameEnPantalla: '/',
        cargandoSesion: false,
        sinSesion: false,
        rol: 'jefe',
      }),
    ).toBe('esperando-fichaje')
  })

  it('el jefe ya resuelto en /fichaje ve el mostrador de su ruta', () => {
    expect(
      vistaDeCascaron({
        pathnameDestino: '/fichaje',
        pathnameEnPantalla: '/fichaje',
        cargandoSesion: false,
        sinSesion: false,
        rol: 'jefe',
      }),
    ).toBe('mostrador')
  })
})
