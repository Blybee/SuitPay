import { create } from 'zustand'
import {
  onAuthStateChanged,
  onIdTokenChanged,
  signInWithEmailAndPassword,
  signOut
  
} from 'firebase/auth'
import type {User} from 'firebase/auth';
import { obtenerAutenticacion } from '../../infra/firebase/cliente.ts'

/**
 * La sesión del vendedor.
 *
 * ## Por qué persiste entre jornadas
 *
 * FR-002: el vendedor no debería volver a autenticarse cada mañana. En un
 * mostrador, una pantalla de acceso al empezar el día es una pantalla que alguien
 * resuelve dejando la contraseña escrita en un papel pegado al monitor, y eso es
 * peor que la sesión larga. Firebase mantiene la sesión en el almacenamiento local
 * y renueva el token por su cuenta.
 *
 * ## Por qué se revalida en segundo plano y nunca bloqueando
 *
 * Un vendedor desactivado tiene que dejar de poder emitir (FR-003), y la
 * comprobación no puede hacerse al arrancar y olvidarse: la desactivación ocurre
 * a media jornada. Pero tampoco puede bloquear la pantalla mientras se comprueba,
 * porque entonces cada renovación de token detendría el mostrador.
 *
 * De modo que se escucha el cambio de token y se lee el rol de sus reivindicaciones
 * —que están en el token y no en un documento, así que leerlas **no cuesta ninguna
 * lectura de Firestore**—. Si el vendedor ha sido desactivado, la emisión se
 * bloquea y el pedido se conserva.
 *
 * ## El pedido nunca se pierde por un problema de sesión
 *
 * Vive en IndexedDB, aparte de la sesión. Un token caducado con catorce líneas
 * tecleadas no puede costar catorce líneas: se pide reautenticar y el pedido sigue
 * donde estaba.
 */

export type Rol = 'vendedor' | 'administrador' | 'jefe'

interface EstadoDeSesion {
  readonly cargando: boolean
  readonly uid: string | null
  readonly nombre: string | null
  readonly correo: string | null
  readonly rol: Rol | null
  readonly activo: boolean
  /** Por qué no se puede emitir ahora mismo, si es que no se puede. */
  readonly motivoDeBloqueo: string | null
}

interface AccionesDeSesion {
  vigilar: () => () => void
  entrar: (correo: string, contrasena: string) => Promise<void>
  salir: () => Promise<void>
}

export type AlmacenDeSesion = EstadoDeSesion & AccionesDeSesion

const SIN_SESION: EstadoDeSesion = {
  cargando: false,
  uid: null,
  nombre: null,
  correo: null,
  rol: null,
  activo: false,
  motivoDeBloqueo: 'Tu sesión no está activa. Vuelve a entrar para poder emitir.',
}

interface Reivindicaciones {
  readonly rol?: Rol
  readonly activo?: boolean
}

async function leerDeUsuario(usuario: User): Promise<EstadoDeSesion> {
  // `false` para no forzar una renovación: si el token es reciente vale, y
  // forzarla en cada cambio añadiría latencia sin ganar nada. Los cambios de rol y
  // de estado llegan solos por `onIdTokenChanged` cuando el token se renueva.
  const resultado = await usuario.getIdTokenResult(false)
  const reivindicaciones = resultado.claims as Reivindicaciones

  const rol = reivindicaciones.rol ?? null
  // Alineado con el servidor (`activo === true` en `verificarIdentidad`): sin
  // reivindicación explícita no se puede emitir. T084 fija `{ rol, activo }` al
  // crear o editar el usuario.
  const activo = reivindicaciones.activo === true

  return {
    cargando: false,
    uid: usuario.uid,
    nombre: usuario.displayName,
    correo: usuario.email,
    rol,
    activo,
    motivoDeBloqueo: motivoDe(rol, activo),
  }
}

function motivoDe(rol: Rol | null, activo: boolean): string | null {
  if (!activo) {
    return 'Tu usuario está desactivado. Habla con el administrador antes de seguir vendiendo.'
  }
  if (rol === null) {
    return 'Tu usuario no tiene rol asignado. El administrador debe asignártelo para poder emitir.'
  }
  if (rol === 'jefe') {
    return 'Tu usuario es de consulta y no puede emitir comprobantes.'
  }
  return null
}

export const usarSesion = create<AlmacenDeSesion>((set) => ({
  ...SIN_SESION,
  cargando: true,

  vigilar() {
    const auth = obtenerAutenticacion()

    const dejarDeEscucharEstado = onAuthStateChanged(auth, (usuario) => {
      if (usuario === null) {
        set(SIN_SESION)
        return
      }
      void leerDeUsuario(usuario).then(set)
    })

    // La segunda escucha es la que hace útil a la primera. `onAuthStateChanged`
    // solo avisa de entrar y salir; `onIdTokenChanged` avisa **cada vez que el
    // token se renueva**, que es cuando llegan las reivindicaciones nuevas. Sin
    // esto, desactivar a un vendedor no surtiría efecto hasta que cerrara sesión,
    // que es justo lo que no va a hacer.
    const dejarDeEscucharToken = onIdTokenChanged(auth, (usuario) => {
      if (usuario === null) return
      void leerDeUsuario(usuario).then(set)
    })

    return () => {
      dejarDeEscucharEstado()
      dejarDeEscucharToken()
    }
  },

  async entrar(correo, contrasena) {
    const auth = obtenerAutenticacion()
    await signInWithEmailAndPassword(auth, correo, contrasena)
  },

  async salir() {
    // El pedido NO se toca. Vive en IndexedDB y sobrevive a cerrar sesión, porque
    // salir por error con catorce líneas tecleadas no puede costar el pedido.
    await signOut(obtenerAutenticacion())
  },
}))

/** Si el usuario puede emitir ahora mismo. Es la puerta que FR-003 exige. */
export function puedeEmitir(estado: AlmacenDeSesion): boolean {
  return (
    !estado.cargando &&
    estado.uid !== null &&
    estado.activo &&
    (estado.rol === 'vendedor' || estado.rol === 'administrador')
  )
}
