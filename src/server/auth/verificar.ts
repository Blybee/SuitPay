import { auth } from '../firebase/admin.ts'
import { fallar } from '../errores.ts'

/**
 * La verificación que toda función de servidor hace antes de nada.
 *
 * ## La regla que este archivo existe para hacer imposible de violar
 *
 * **La identidad sale del token, nunca de la petición.** El principio I y FR-003
 * lo exigen: si una función aceptase un `vendedorId` en su cuerpo, cualquiera
 * con una sesión válida podría emitir comprobantes atribuidos a otra persona.
 *
 * ## Las tres comprobaciones (App Check fuera de alcance)
 *
 * 1. **Sesión válida**: el token de Firebase Authentication está firmado y no ha
 *    caducado.
 * 2. **Usuario activo**: desactivar a alguien tiene que impedirle emitir de
 *    inmediato, no cuando caduque su sesión.
 * 3. **Rol suficiente**.
 *
 * La atestación de aplicación (App Check) no forma parte de esta entrega: la
 * frontera activa es sesión + rol + reglas de Firestore.
 */

export const ROLES = ['vendedor', 'administrador', 'jefe'] as const
export type Rol = (typeof ROLES)[number]

export interface Identidad {
  /** Identificador del usuario, tomado del token. */
  readonly uid: string
  readonly rol: Rol
  readonly nombre: string | undefined
}

export interface CredencialesEntrantes {
  /** Token de Firebase Authentication, del encabezado de autorización. */
  readonly tokenDeSesion: string | undefined
}

/**
 * Extrae las credenciales de los encabezados. Deliberadamente no mira el cuerpo
 * de la petición: nada de lo que decide un permiso puede venir de ahí.
 */
export function credencialesDesdeEncabezados(
  encabezados: Headers,
): CredencialesEntrantes {
  const autorizacion = encabezados.get('authorization') ?? ''
  const tokenDeSesion = autorizacion.toLowerCase().startsWith('bearer ')
    ? autorizacion.slice(7).trim()
    : undefined

  return {
    tokenDeSesion: tokenDeSesion === '' ? undefined : tokenDeSesion,
  }
}

function esRol(valor: unknown): valor is Rol {
  return typeof valor === 'string' && (ROLES as readonly string[]).includes(valor)
}

export async function verificarIdentidad(
  credenciales: CredencialesEntrantes,
): Promise<Identidad> {
  if (credenciales.tokenDeSesion === undefined) {
    fallar('sesion_ausente')
  }

  let reivindicaciones
  try {
    // `true` comprueba además que la sesión no haya sido revocada. Cuesta una
    // lectura y es lo que hace que desactivar a alguien surta efecto ahora en
    // lugar de cuando su token caduque por su cuenta.
    reivindicaciones = await auth().verifyIdToken(
      credenciales.tokenDeSesion,
      true,
    )
  } catch (error) {
    // Fallos frecuentes en local: Admin SDK apuntando a otro proyecto que el
    // cliente (ADC/gcloud ≠ VITE_FIREBASE_PROJECT_ID). Sin el detalle, parece
    // que «caducó» la sesión del vendedor.
    console.error('[SuitPay] verifyIdToken falló', error)
    fallar('sesion_invalida')
  }

  if (reivindicaciones.activo !== true) {
    fallar('usuario_desactivado')
  }

  if (!esRol(reivindicaciones.rol)) {
    fallar('rol_insuficiente')
  }

  return {
    uid: reivindicaciones.uid,
    rol: reivindicaciones.rol,
    nombre:
      typeof reivindicaciones.name === 'string'
        ? reivindicaciones.name
        : undefined,
  }
}

export function exigirRol(
  identidad: Identidad,
  admitidos: readonly Rol[],
): void {
  if (!admitidos.includes(identidad.rol)) {
    fallar('rol_insuficiente', { rol: identidad.rol })
  }
}

/**
 * La comprobación completa: verifica y exige rol de una vez. Es la que usan las
 * funciones de servidor, para que no exista la variante de verificar sin exigir.
 */
export async function exigirIdentidad(
  encabezados: Headers,
  admitidos: readonly Rol[],
): Promise<Identidad> {
  const identidad = await verificarIdentidad(
    credencialesDesdeEncabezados(encabezados),
  )
  exigirRol(identidad, admitidos)
  return identidad
}
