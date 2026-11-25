import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { completarConexionAuthKitFn } from '../features/acceso/conexion.funciones.ts'
import {
  decidirTrasEntrar,
  leerBusquedaDeAcceso,
  mensajeDeConexion,
} from '../features/acceso/conexion.ts'
import type {
  BusquedaDeAcceso,
  ResultadoDeConexion,
  RutaDeRol,
} from '../features/acceso/conexion.ts'
import { usarSesion } from '../features/sesion/almacen.ts'
import { destinoDeRol } from '../features/sesion/destino.ts'
import { MarcaSuitPay } from '../ui/componentes/MarcaSuitPay.tsx'
import { Boton, Campo, Etiqueta } from '../ui/componentes/primitivas.tsx'

/**
 * Pantalla de acceso (T173 / FR-002 complemento).
 *
 * La sesión larga (T073) evita pedir credenciales cada mañana; esta pantalla
 * cubre la primera entrada y cuando la sesión ya no es válida.
 *
 * Con `external_auth_id` (AuthKit Standalone Connect) el login de Firebase
 * sigue igual y, si ya hay sesión, se salta. El servidor verifica el ID token
 * y solo entonces completa contra WorkOS.
 */

export const Route = createFileRoute('/acceso')({
  validateSearch: (search: Record<string, unknown>): {
    external_auth_id?: string
    idInvalido?: boolean
  } => {
    const leido = leerBusquedaDeAcceso(search)
    const salida: { external_auth_id?: string; idInvalido?: boolean } = {}
    if (leido.externalAuthId !== null) salida.external_auth_id = leido.externalAuthId
    if (leido.idInvalido) salida.idInvalido = true
    return salida
  },
  component: RutaDeAcceso,
})

function RutaDeAcceso() {
  const search = Route.useSearch()
  const busqueda = {
    externalAuthId: search.external_auth_id ?? null,
    idInvalido: search.idInvalido === true,
  }
  const navigate = useNavigate()
  const irA = useCallback(
    (ruta: RutaDeRol) => navigate({ to: ruta, replace: true }),
    [navigate],
  )
  return <PantallaDeAcceso busqueda={busqueda} irA={irA} />
}

async function completarPorOmision(
  externalAuthId: string,
): Promise<ResultadoDeConexion> {
  return completarConexionAuthKitFn({ data: { externalAuthId } })
}

function asignarPorOmision(url: string): void {
  window.location.assign(url)
}

export function PantallaDeAcceso({
  busqueda,
  irA,
  completar = completarPorOmision,
  asignar = asignarPorOmision,
}: {
  readonly busqueda: BusquedaDeAcceso
  readonly irA: (ruta: RutaDeRol) => Promise<void> | void
  readonly completar?: (externalAuthId: string) => Promise<ResultadoDeConexion>
  readonly asignar?: (url: string) => void
}) {
  const cargando = usarSesion((s) => s.cargando)
  const uid = usarSesion((s) => s.uid)
  const rol = usarSesion((s) => s.rol)
  const entrar = usarSesion((s) => s.entrar)

  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [error, setError] = useState<string | null>(
    busqueda.idInvalido ? mensajeDeConexion('id-invalido') : null,
  )
  const [ocupado, setOcupado] = useState(false)
  const pedido = useRef(false)

  const paso = decidirTrasEntrar({
    externalAuthId: busqueda.externalAuthId,
    idInvalido: busqueda.idInvalido,
    rol,
  })
  const ruta =
    paso.tipo === 'destino' ? paso.ruta : null

  useLayoutEffect(() => {
    if (cargando || uid === null || ruta === null) return
    void irA(ruta)
  }, [cargando, uid, ruta, irA])

  useEffect(() => {
    if (cargando || uid === null || paso.tipo !== 'completar') return
    if (busqueda.externalAuthId === null || pedido.current) return
    pedido.current = true
    const id = busqueda.externalAuthId
    setOcupado(true)
    void completar(id).then((resultado) => {
      if (resultado.ok) {
        asignar(resultado.redirectUri)
        return
      }
      pedido.current = false
      setOcupado(false)
      setError(mensajeDeConexion(resultado.motivo))
    })
  }, [cargando, uid, paso.tipo, busqueda.externalAuthId, completar, asignar])

  async function enviar(evento: FormEvent): Promise<void> {
    evento.preventDefault()
    setError(busqueda.idInvalido ? mensajeDeConexion('id-invalido') : null)
    setOcupado(true)
    try {
      await entrar(correo.trim(), contrasena)
      setOcupado(false)
    } catch {
      setError('Correo o contraseña incorrectos. Inténtalo de nuevo.')
      setOcupado(false)
    }
  }

  const conectando = paso.tipo === 'completar' && uid !== null && error === null

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
          {conectando
            ? 'Conectando…'
            : 'Usa tu correo y contraseña del local.'}
        </p>

        {conectando ? (
          <p className="mt-8 text-center text-cuerpo text-desvaida" aria-busy="true">
            Comprobando tu usuario.
          </p>
        ) : (
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
            {uid !== null && error !== null && (
              <Boton
                type="button"
                variante="secundario"
                className="w-full"
                onClick={() => {
                  void irA(destinoDeRol(rol))
                }}
              >
                Seguir a SuitPay
              </Boton>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
