import { getApps, initializeApp  } from 'firebase-admin/app'
import type {App} from 'firebase-admin/app';
import { getAppCheck  } from 'firebase-admin/app-check'
import type {AppCheck} from 'firebase-admin/app-check';
import { getAuth  } from 'firebase-admin/auth'
import type {Auth} from 'firebase-admin/auth';
import { getFirestore  } from 'firebase-admin/firestore'
import type {Firestore} from 'firebase-admin/firestore';
import { getStorage  } from 'firebase-admin/storage'
import type {Storage} from 'firebase-admin/storage';

/**
 * El Admin SDK. **Solo servidor.**
 *
 * Lo que hay que tener presente al leer cualquier cosa que importe este archivo:
 * el Admin SDK **salta todas las reglas de seguridad**. Ese es su propósito y es
 * también su peligro. Las reglas de `firestore.rules` prohíben al cliente
 * escribir comprobantes y mover correlativos; aquí nada lo prohíbe. La única
 * cosa que impide que ese privilegio se filtre al navegador es la frontera que
 * vigila el linter, y por eso importar `firebase-admin` fuera de `src/server/`
 * es un error de construcción y no una advertencia.
 *
 * En App Hosting las credenciales las provee el entorno de ejecución, así que no
 * hay ningún archivo de cuenta de servicio en el repositorio ni debe haberlo.
 * Con emuladores, las variables `FIRESTORE_EMULATOR_HOST` y compañía redirigen
 * las conexiones sin cambiar nada de este código.
 */

let aplicacion: App | undefined

function obtenerAplicacion(): App {
  if (aplicacion !== undefined) return aplicacion
  const existentes = getApps()
  aplicacion = existentes[0] ?? initializeApp()
  return aplicacion
}

let baseDeDatos: Firestore | undefined

export function bd(): Firestore {
  if (baseDeDatos !== undefined) return baseDeDatos
  baseDeDatos = getFirestore(obtenerAplicacion())
  baseDeDatos.settings({ ignoreUndefinedProperties: false })
  return baseDeDatos
}

let autenticacion: Auth | undefined

export function auth(): Auth {
  if (autenticacion !== undefined) return autenticacion
  autenticacion = getAuth(obtenerAplicacion())
  return autenticacion
}

let atestacion: AppCheck | undefined

export function appCheck(): AppCheck {
  if (atestacion !== undefined) return atestacion
  atestacion = getAppCheck(obtenerAplicacion())
  return atestacion
}

let almacenamiento: Storage | undefined

export function storage(): Storage {
  if (almacenamiento !== undefined) return almacenamiento
  almacenamiento = getStorage(obtenerAplicacion())
  return almacenamiento
}

/** Nombres de las colecciones en un solo sitio. Ver data-model.md. */
export const COLECCIONES = {
  catalogo: 'catalogo',
  clientes: 'clientes',
  indices: 'indices',
  comprobantes: 'comprobantes',
  series: 'series',
  cotizaciones: 'cotizaciones',
  capturas: 'capturas',
  usuarios: 'usuarios',
  config: 'config',
} as const

export const DOCUMENTOS = {
  catalogoActual: 'catalogo/actual',
  indiceDeClientes: 'indices/clientes',
  parametros: 'config/parametros',
} as const
