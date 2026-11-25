import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  decidirTrasEntrar,
  leerBusquedaDeAcceso,
  mensajeDeConexion,
} from '../../../src/features/acceso/conexion.ts'
import { PantallaDeAcceso } from '../../../src/routes/acceso.tsx'
import { usarSesion } from '../../../src/features/sesion/almacen.ts'
import type { Rol } from '../../../src/features/sesion/almacen.ts'
import type { RutaDeRol } from '../../../src/features/acceso/conexion.ts'

const ID = '01EXTERNALAUTHID'
const REDIRECT =
  'https://elegant-palm-42-staging.authkit.app/oauth2/callback?code=abc'

function sesion(rol: Rol | null, uid: string | null = rol === null ? null : 'uid-1') {
  usarSesion.setState({
    cargando: false,
    uid,
    nombre: 'Ada',
    correo: 'ada@suitpay.local',
    rol,
    activo: true,
    motivoDeBloqueo: null,
  })
}

describe('acceso sin external_auth_id', () => {
  it('manda cada rol a su pantalla y no completa', () => {
    expect(
      decidirTrasEntrar({
        externalAuthId: null,
        idInvalido: false,
        rol: 'administrador',
      }),
    ).toEqual({ tipo: 'destino', ruta: '/administracion' })
    expect(
      decidirTrasEntrar({
        externalAuthId: null,
        idInvalido: false,
        rol: 'vendedor',
      }),
    ).toEqual({ tipo: 'destino', ruta: '/' })
    expect(
      decidirTrasEntrar({
        externalAuthId: null,
        idInvalido: false,
        rol: 'jefe',
      }),
    ).toEqual({ tipo: 'destino', ruta: '/fichaje' })

    const rutas: RutaDeRol[] = []
    const completados: string[] = []
    sesion('administrador')
    render(
      <PantallaDeAcceso
        busqueda={{ externalAuthId: null, idInvalido: false }}
        irA={(ruta) => {
          rutas.push(ruta)
        }}
        completar={async (id) => {
          completados.push(id)
          return { ok: true, redirectUri: REDIRECT }
        }}
      />,
    )

    expect(rutas).toEqual(['/administracion'])
    expect(completados).toEqual([])
    expect(screen.getByRole('heading', { name: 'Entrar a SuitPay' })).toBeTruthy()
  })

  it('sin sesión sigue mostrando el formulario', () => {
    sesion(null)
    render(
      <PantallaDeAcceso
        busqueda={leerBusquedaDeAcceso({})}
        irA={() => {
          throw new Error('no debía navegar')
        }}
        completar={async () => {
          throw new Error('no debía completar')
        }}
      />,
    )

    expect(screen.getByLabelText('Contraseña')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('acceso con external_auth_id', () => {
  it('redirige exactamente a la uri que devuelve el servidor', async () => {
    const asignadas: string[] = []
    const rutas: RutaDeRol[] = []
    sesion('administrador')
    render(
      <PantallaDeAcceso
        busqueda={{ externalAuthId: ID, idInvalido: false }}
        irA={(ruta) => {
          rutas.push(ruta)
        }}
        completar={async () => ({ ok: true, redirectUri: REDIRECT })}
        asignar={(url) => {
          asignadas.push(url)
        }}
      />,
    )

    await waitFor(() => {
      expect(asignadas).toEqual([REDIRECT])
    })
    expect(rutas).toEqual([])
  })

  it('un vendedor ve el error y no sale hacia WorkOS', async () => {
    const asignadas: string[] = []
    sesion('vendedor')
    render(
      <PantallaDeAcceso
        busqueda={{ externalAuthId: ID, idInvalido: false }}
        irA={() => {
          throw new Error('no debía ir al mostrador')
        }}
        completar={async () => ({ ok: false, motivo: 'sin-permiso' })}
        asignar={(url) => {
          asignadas.push(url)
        }}
      />,
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      mensajeDeConexion('sin-permiso'),
    )
    expect(asignadas).toEqual([])
    expect(screen.getByRole('alert').textContent).not.toContain(ID)
  })

  it('un id que no es string no se pinta', () => {
    const crudo = '<img src=x onerror=alert(1)>'
    const busqueda = leerBusquedaDeAcceso({ external_auth_id: crudo })
    expect(busqueda).toEqual({ externalAuthId: null, idInvalido: true })
    expect(JSON.stringify(busqueda)).not.toContain('onerror')

    sesion(null)
    render(
      <PantallaDeAcceso
        busqueda={busqueda}
        irA={() => undefined}
        completar={async () => {
          throw new Error('no debía completar')
        }}
      />,
    )

    expect(document.body.innerHTML).not.toContain('onerror')
    expect(screen.getByRole('alert')).toHaveTextContent(
      mensajeDeConexion('id-invalido'),
    )
  })
})
