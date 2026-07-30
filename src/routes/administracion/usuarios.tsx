import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { GuardaSesion } from '../../features/sesion/GuardaSesion.tsx'
import {
  actualizarUsuarioFn,
  crearUsuarioFn,
  listarUsuariosFn,
} from '../../features/usuarios/usuarios.funciones.ts'
import type { UsuarioListado } from '../../features/usuarios/usuarios.funciones.ts'
import { Boton, Campo, Etiqueta } from '../../ui/componentes/primitivas.tsx'

/**
 * Gestión de usuarios y roles (T084 / FR-005).
 */

export const Route = createFileRoute('/administracion/usuarios')({
  component: () => (
    <GuardaSesion roles={['administrador']}>
      <PantallaDeUsuarios />
    </GuardaSesion>
  ),
})

function PantallaDeUsuarios() {
  const [usuarios, setUsuarios] = useState<readonly UsuarioListado[]>([])
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [nombre, setNombre] = useState('')
  const [rol, setRol] = useState<'vendedor' | 'administrador' | 'jefe'>(
    'vendedor',
  )

  async function cargar(): Promise<void> {
    setOcupado(true)
    setError(null)
    try {
      const respuesta = await listarUsuariosFn()
      if (!respuesta.ok || respuesta.usuarios === undefined) {
        setError(respuesta.error?.mensaje ?? 'No se pudieron listar usuarios.')
        return
      }
      setUsuarios(respuesta.usuarios)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de red.')
    } finally {
      setOcupado(false)
    }
  }

  useEffect(() => {
    void cargar()
  }, [])

  async function crear(evento: FormEvent): Promise<void> {
    evento.preventDefault()
    setOcupado(true)
    setError(null)
    try {
      const respuesta = await crearUsuarioFn({
        data: { correo, contrasena, nombre, rol },
      })
      if (!respuesta.ok) {
        setError(respuesta.error?.mensaje ?? 'No se pudo crear el usuario.')
        return
      }
      setCorreo('')
      setContrasena('')
      setNombre('')
      setRol('vendedor')
      await cargar()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de red.')
    } finally {
      setOcupado(false)
    }
  }

  async function alternarActivo(usuario: UsuarioListado): Promise<void> {
    setOcupado(true)
    setError(null)
    try {
      const respuesta = await actualizarUsuarioFn({
        data: { uid: usuario.uid, activo: !usuario.activo },
      })
      if (!respuesta.ok) {
        setError(respuesta.error?.mensaje ?? 'No se pudo actualizar.')
        return
      }
      await cargar()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de red.')
    } finally {
      setOcupado(false)
    }
  }

  async function cambiarRol(
    usuario: UsuarioListado,
    nuevoRol: 'vendedor' | 'administrador' | 'jefe',
  ): Promise<void> {
    setOcupado(true)
    setError(null)
    try {
      const respuesta = await actualizarUsuarioFn({
        data: { uid: usuario.uid, rol: nuevoRol },
      })
      if (!respuesta.ok) {
        setError(respuesta.error?.mensaje ?? 'No se pudo cambiar el rol.')
        return
      }
      await cargar()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de red.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-8">
      <header>
        <h1 className="text-cabecera font-bold text-tinta">Usuarios</h1>
        <p className="mt-2 text-cuerpo text-desvaida">
          Alta, rol y activación. El rol se replica en las reivindicaciones del
          token.
        </p>
      </header>

      {error !== null && (
        <p className="text-cuerpo font-bold text-aviso" role="alert">
          {error}
        </p>
      )}

      <form
        onSubmit={crear}
        className="flex flex-col gap-3 rounded-3xl border border-borde bg-papel p-6"
      >
        <h2 className="text-cuerpo font-bold">Nuevo usuario</h2>
        <div>
          <Etiqueta htmlFor="nombre">Nombre</Etiqueta>
          <Campo
            id="nombre"
            required
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            disabled={ocupado}
          />
        </div>
        <div>
          <Etiqueta htmlFor="correo">Correo</Etiqueta>
          <Campo
            id="correo"
            type="email"
            required
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            disabled={ocupado}
          />
        </div>
        <div>
          <Etiqueta htmlFor="contrasena">Contraseña (mín. 8)</Etiqueta>
          <Campo
            id="contrasena"
            type="password"
            required
            minLength={8}
            value={contrasena}
            onChange={(e) => setContrasena(e.target.value)}
            disabled={ocupado}
          />
        </div>
        <div>
          <Etiqueta htmlFor="rol">Rol</Etiqueta>
          <select
            id="rol"
            className="min-h-11 w-full rounded-full border border-borde bg-papel px-4"
            value={rol}
            onChange={(e) =>
              setRol(e.target.value as 'vendedor' | 'administrador' | 'jefe')
            }
            disabled={ocupado}
          >
            <option value="vendedor">Vendedor</option>
            <option value="administrador">Administrador</option>
            <option value="jefe">Jefe</option>
          </select>
        </div>
        <Boton type="submit" variante="principal" disabled={ocupado}>
          Crear usuario
        </Boton>
      </form>

      <ul className="flex flex-col gap-3">
        {usuarios.map((usuario) => (
          <li
            key={usuario.uid}
            className="rounded-3xl border border-borde bg-papel p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-cuerpo font-bold text-tinta">
                  {usuario.nombre || '(sin nombre)'}
                </p>
                <p className="font-mono text-etiqueta text-desvaida">
                  {usuario.correo}
                </p>
                <p className="mt-1 font-mono text-etiqueta uppercase text-desvaida">
                  {usuario.activo ? 'activo' : 'desactivado'} · {usuario.rol}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  className="min-h-11 rounded-full border border-borde bg-papel px-3"
                  value={usuario.rol}
                  disabled={ocupado}
                  onChange={(e) =>
                    void cambiarRol(
                      usuario,
                      e.target.value as 'vendedor' | 'administrador' | 'jefe',
                    )
                  }
                  aria-label={`Rol de ${usuario.nombre}`}
                >
                  <option value="vendedor">Vendedor</option>
                  <option value="administrador">Administrador</option>
                  <option value="jefe">Jefe</option>
                </select>
                <Boton
                  variante={usuario.activo ? 'peligro' : 'principal'}
                  disabled={ocupado}
                  onClick={() => void alternarActivo(usuario)}
                >
                  {usuario.activo ? 'Desactivar' : 'Activar'}
                </Boton>
              </div>
            </div>
          </li>
        ))}
        {usuarios.length === 0 && !ocupado && (
          <li className="text-cuerpo text-desvaida">
            Aún no hay usuarios registrados en SuitPay.
          </li>
        )}
      </ul>
    </div>
  )
}
