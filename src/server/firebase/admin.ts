import { getApps, initializeApp } from 'firebase-admin/app'
import type { App } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import type { Auth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import type { Firestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import type { Storage } from 'firebase-admin/storage'
import { projectIdDelEntorno } from './project-id.ts'

export { projectIdDelEntorno } from './project-id.ts'

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
 *
 * `GOOGLE_CLOUD_PROJECT` debe estar en el runtime (ver `apphosting.yaml`): el
 * projectId del Admin SDK **debe** ser el mismo que firma el ID token del
 * cliente. Si `initializeApp()` toma el proyecto de gcloud ADC (p. ej. otra
 * app), `verifyIdToken` falla y el mostrador muestra «sesión caducó» aunque
 * el vendedor esté bien autenticado — y nunca llega al proveedor.
 */

let aplicacion: App | undefined

function projectIdResuelto(): string | undefined {
  return projectIdDelEntorno(
    process.env,
    typeof import.meta !== 'undefined'
      ? (import.meta.env as Record<string, unknown>)
      : undefined,
  )
}

/** Bucket de Storage (cliente y Admin deben coincidir). */
export function storageBucketDelEntorno(): string | undefined {
  const desdeEnv =
    process.env['FIREBASE_STORAGE_BUCKET'] ??
    process.env['VITE_FIREBASE_STORAGE_BUCKET'] ??
    (typeof import.meta !== 'undefined'
      ? (import.meta.env['VITE_FIREBASE_STORAGE_BUCKET'] as string | undefined)
      : undefined)
  if (desdeEnv !== undefined && desdeEnv.trim() !== '') return desdeEnv.trim()

  // Respaldo clásico si solo hay projectId.
  const projectId = projectIdResuelto()
  return projectId !== undefined && projectId !== ''
    ? `${projectId}.appspot.com`
    : undefined
}

function obtenerAplicacion(): App {
  if (aplicacion !== undefined) return aplicacion
  const existentes = getApps()
  if (existentes[0] !== undefined) {
    aplicacion = existentes[0]
    return aplicacion
  }

  const projectId = projectIdResuelto()
  const storageBucket = storageBucketDelEntorno()
  if (projectId === undefined || projectId === '') {
    console.error(
      '[SuitPay] Admin SDK sin projectId: define GOOGLE_CLOUD_PROJECT ' +
        '(y que coincida con VITE_FIREBASE_PROJECT_ID).',
    )
    aplicacion = initializeApp(
      storageBucket !== undefined ? { storageBucket } : undefined,
    )
  } else {
    aplicacion = initializeApp({
      projectId,
      ...(storageBucket !== undefined ? { storageBucket } : {}),
    })
  }
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
  transportistas: 'transportistas',
  inventario: 'inventario',
  lotesAprendizaje: 'lotesAprendizaje',
  revisionesAprendizaje: 'revisionesAprendizaje',
} as const

export const DOCUMENTOS = {
  catalogoActual: 'catalogo/actual',
  indiceDeClientes: 'indices/clientes',
  indiceDeTransportistas: 'indices/transportistas',
  parametros: 'config/parametros',
  contadorCotizaciones: 'config/contadorCotizaciones',
  aprendizajeMemoria: 'aprendizaje/memoria',
} as const
