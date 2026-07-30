import { createFileRoute, Navigate, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { usarSesion } from '../features/sesion/almacen.ts'
import { MarcaSuitPay } from '../ui/componentes/MarcaSuitPay.tsx'
import { Boton, Campo, Etiqueta } from '../ui/componentes/primitivas.tsx'

/**
 * Pantalla de acceso (T173 / FR-002 complemento).
 *
 * La sesión larga (T073) evita pedir credenciales cada mañana; esta pantalla
 * cubre la primera entrada y cuando la sesión ya no es válida.
 */

export const Route = createFileRoute('/acceso')({
  component: PantallaDeAcceso,
})

function PantallaDeAcceso() {
  const navigate = useNavigate()
  const cargando = usarSesion((s) => s.cargando)
  const uid = usarSesion((s) => s.uid)
  const rol = usarSesion((s) => s.rol)
  const entrar = usarSesion((s) => s.entrar)

  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  if (!cargando && uid !== null) {
    const destino =
      rol === 'administrador' || rol === 'jefe' ? '/administracion' : '/'
    return <Navigate to={destino} />
  }

  async function enviar(evento: FormEvent): Promise<void> {
    evento.preventDefault()
    setError(null)
    setOcupado(true)
    try {
      await entrar(correo.trim(), contrasena)
      const estado = usarSesion.getState()
      const destino =
        estado.rol === 'administrador' || estado.rol === 'jefe'
          ? '/administracion'
          : '/'
      await navigate({ to: destino })
    } catch {
      setError('Correo o contraseña incorrectos. Inténtalo de nuevo.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-mesa px-4">
      <div className="w-full max-w-md rounded-3xl border border-borde bg-papel p-8 shadow-sm">
        <div className="flex justify-center">
          <MarcaSuitPay className="size-12 text-tinta" />
        </div>
        <h1 className="mt-6 text-center text-cabecera font-bold text-tinta">
          Entrar a SuitPay
        </h1>
        <p className="mt-2 text-center text-cuerpo text-desvaida">
          Usa tu correo y contraseña del local.
        </p>

        <form className="mt-8 flex flex-col gap-4" onSubmit={enviar}>
          <div>
            <Etiqueta htmlFor="correo">Correo</Etiqueta>
            <Campo
              id="correo"
              type="email"
              autoComplete="username"
              required
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              disabled={ocupado || cargando}
            />
          </div>
          <div>
            <Etiqueta htmlFor="contrasena">Contraseña</Etiqueta>
            <Campo
              id="contrasena"
              type="password"
              autoComplete="current-password"
              required
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              disabled={ocupado || cargando}
            />
          </div>

          {error !== null && (
            <p className="text-cuerpo font-bold text-aviso" role="alert">
              {error}
            </p>
          )}

          <Boton
            type="submit"
            variante="principal"
            disabled={ocupado || cargando}
            className="mt-2 w-full"
          >
            {ocupado ? 'Entrando…' : 'Entrar'}
          </Boton>
        </form>
      </div>
    </div>
  )
}
