import { auth, bd, COLECCIONES } from '../firebase/admin.ts'
import { fallar } from '../errores.ts'
import { ROLES } from '../auth/verificar.ts'
import type { Rol } from '../auth/verificar.ts'

/**
 * Gestión de usuarios y reivindicaciones (T084 / FR-005).
 *
 * El rol y `activo` viven en custom claims para que el token (y las reglas)
 * los evalúen sin lecturas de Firestore. El documento `usuarios/{uid}` es la
 * ficha administrativa.
 */

export interface UsuarioListado {
  readonly uid: string
  readonly correo: string
  readonly nombre: string
  readonly rol: Rol
  readonly activo: boolean
  readonly seriesAsignadas: readonly string[]
}

export interface AltaDeUsuario {
  readonly correo: string
  readonly contrasena: string
  readonly nombre: string
  readonly rol: Rol
}

export interface CambioDeUsuario {
  readonly uid: string
  readonly nombre?: string
  readonly rol?: Rol
  readonly activo?: boolean
  readonly contrasena?: string
}

function esRol(valor: unknown): valor is Rol {
  return typeof valor === 'string' && (ROLES as readonly string[]).includes(valor)
}

async function fijarClaims(
  uid: string,
  rol: Rol,
  activo: boolean,
): Promise<void> {
  await auth().setCustomUserClaims(uid, { rol, activo })
}

export async function listarUsuarios(): Promise<readonly UsuarioListado[]> {
  const instantanea = await bd().collection(COLECCIONES.usuarios).get()
  return instantanea.docs.map((doc) => {
    const datos = doc.data()
    const rol = esRol(datos['rol']) ? datos['rol'] : 'vendedor'
    return {
      uid: doc.id,
      correo: typeof datos['correo'] === 'string' ? datos['correo'] : '',
      nombre: typeof datos['nombre'] === 'string' ? datos['nombre'] : '',
      rol,
      activo: datos['activo'] === true,
      seriesAsignadas: Array.isArray(datos['seriesAsignadas'])
        ? datos['seriesAsignadas'].filter(
            (cada): cada is string => typeof cada === 'string',
          )
        : [],
    }
  })
}

export async function crearUsuario(alta: AltaDeUsuario): Promise<UsuarioListado> {
  if (!esRol(alta.rol)) fallar('peticion_invalida', { campo: 'rol' })
  if (alta.contrasena.length < 8) {
    fallar('peticion_invalida', { campo: 'contrasena' })
  }

  const creado = await auth().createUser({
    email: alta.correo.trim(),
    password: alta.contrasena,
    displayName: alta.nombre.trim(),
  })

  await fijarClaims(creado.uid, alta.rol, true)

  const ficha: UsuarioListado = {
    uid: creado.uid,
    correo: alta.correo.trim(),
    nombre: alta.nombre.trim(),
    rol: alta.rol,
    activo: true,
    seriesAsignadas: [],
  }

  await bd().collection(COLECCIONES.usuarios).doc(creado.uid).set({
    nombre: ficha.nombre,
    correo: ficha.correo,
    rol: ficha.rol,
    activo: true,
    seriesAsignadas: [],
  })

  return ficha
}

export async function actualizarUsuario(
  cambio: CambioDeUsuario,
): Promise<UsuarioListado> {
  const ref = bd().collection(COLECCIONES.usuarios).doc(cambio.uid)
  const actual = await ref.get()
  if (!actual.exists) fallar('no_encontrado', { recurso: 'usuario' })

  const datos = actual.data() ?? {}
  const rolActual = esRol(datos['rol']) ? datos['rol'] : 'vendedor'
  const activoActual = datos['activo'] === true

  const rol = cambio.rol ?? rolActual
  const activo = cambio.activo ?? activoActual
  const nombre =
    cambio.nombre?.trim() ??
    (typeof datos['nombre'] === 'string' ? datos['nombre'] : '')

  if (cambio.rol !== undefined || cambio.activo !== undefined) {
    await fijarClaims(cambio.uid, rol, activo)
  }

  const authUpdate: {
    displayName?: string
    password?: string
    disabled?: boolean
  } = {}
  if (cambio.nombre !== undefined) authUpdate.displayName = nombre
  if (cambio.contrasena !== undefined && cambio.contrasena.length >= 8) {
    authUpdate.password = cambio.contrasena
  }
  if (cambio.activo !== undefined) authUpdate.disabled = !activo
  if (Object.keys(authUpdate).length > 0) {
    await auth().updateUser(cambio.uid, authUpdate)
  }

  await ref.set(
    {
      nombre,
      correo:
        typeof datos['correo'] === 'string' ? datos['correo'] : '',
      rol,
      activo,
      seriesAsignadas: Array.isArray(datos['seriesAsignadas'])
        ? datos['seriesAsignadas']
        : [],
    },
    { merge: true },
  )

  return {
    uid: cambio.uid,
    correo: typeof datos['correo'] === 'string' ? datos['correo'] : '',
    nombre,
    rol,
    activo,
    seriesAsignadas: Array.isArray(datos['seriesAsignadas'])
      ? datos['seriesAsignadas'].filter(
          (cada): cada is string => typeof cada === 'string',
        )
      : [],
  }
}
