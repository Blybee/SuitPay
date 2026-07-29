import { appCheck, auth } from '../firebase/admin.ts'
import { fallar } from '../errores.ts'

/**
 * La verificación que toda función de servidor hace antes de nada.
 *
 * ## La regla que este archivo existe para hacer imposible de violar
 *
 * **La identidad sale del token, nunca de la petición.** El principio I y FR-003
 * lo exigen y la razón es concreta: si una función aceptase un `vendedorId` en su
 * cuerpo, cualquiera con una sesión válida podría emitir comprobantes atribuidos
 * a otra persona. La atribución dejaría de significar nada, y la atribución es
 * justamente lo que convierte una emisión en un acto con responsable.
 *
 * Por eso `Identidad` no se construye nunca a partir de datos de entrada, y por
 * eso ninguna función de este módulo acepta un identificador de usuario como
 * argumento. Quien quiera saber quién llama tiene que pasar por aquí.
 *
 * ## Las cuatro comprobaciones
 *
 * 1. **Sesión válida**: el token de Firebase Authentication está firmado y no ha
 *    caducado.
 * 2. **Atestación de aplicación**: la llamada viene de nuestra aplicación y no de
 *    un guion con la configuración copiada del paquete del navegador.
 * 3. **Usuario activo**: desactivar a alguien tiene que impedirle emitir de
 *    inmediato, no cuando caduque su sesión.
 * 4. **Rol suficiente**.
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
  /** Token de App Check, del encabezado correspondiente. */
  readonly tokenDeAtestacion: string | undefined
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
    tokenDeAtestacion: encabezados.get('x-firebase-appcheck') ?? undefined,
  }
}

/**
 * Si se exige atestación. Se relaja únicamente contra emuladores, donde no hay
 * dominio registrado. La condición se lee del entorno del servidor y no de la
 * petición, para que ningún cliente pueda pedir que se le exima.
 */
function seExigeAtestacion(): boolean {
  return process.env.FIREBASE_AUTH_EMULATOR_HOST === undefined
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

  if (seExigeAtestacion()) {
    if (credenciales.tokenDeAtestacion === undefined) {
      fallar('atestacion_invalida')
    }
    try {
      await appCheck().verifyToken(credenciales.tokenDeAtestacion)
    } catch {
      fallar('atestacion_invalida')
    }
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
  } catch {
    fallar('sesion_invalida')
  }

  if (reivindicaciones.activo !== true) {
    fallar('usuario_desactivado')
  }

  if (!esRol(reivindicaciones.rol)) {
    // Un token sin rol reconocible no es un usuario sin permisos: es un usuario
    // mal aprovisionado, y tratarlo como vendedor por omisión sería la clase de
    // valor por defecto que concede acceso sin que nadie lo haya decidido.
    fallar('rol_insuficiente')
  }

  return {
    uid: reivindicaciones.uid,
    rol: reivindicaciones.rol,
    nombre: typeof reivindicaciones.name === 'string' ? reivindicaciones.name : undefined,
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

/**
 * Protección de las rutas que dispara Cloud Scheduler. No llevan sesión de
 * usuario porque no hay usuario: lo que las autentica es un secreto compartido.
 */
export function exigirSecretoDeTareas(encabezados: Headers): void {
  const esperado = process.env.TAREAS_SECRETO_COMPARTIDO
  if (esperado === undefined || esperado === '') {
    // Sin secreto configurado la ruta queda cerrada, no abierta. Un valor
    // ausente no puede significar "sin protección".
    fallar('rol_insuficiente', { motivo: 'secreto_de_tareas_no_configurado' })
  }

  const recibido = encabezados.get('x-suitpay-tareas') ?? ''
  if (!comparacionEnTiempoConstante(recibido, esperado)) {
    fallar('rol_insuficiente', { motivo: 'secreto_de_tareas_invalido' })
  }
}

/**
 * Comparación que no delata la longitud del prefijo coincidente por el tiempo
 * que tarda. Con un secreto de despliegue el riesgo es remoto, pero comparar
 * secretos con `===` es un hábito que se acaba llevando a donde sí importa.
 */
function comparacionEnTiempoConstante(uno: string, otro: string): boolean {
  if (uno.length !== otro.length) return false
  let diferencia = 0
  for (let indice = 0; indice < uno.length; indice += 1) {
    diferencia |= uno.charCodeAt(indice) ^ otro.charCodeAt(indice)
  }
  return diferencia === 0
}
