import { getApp, getApps, initializeApp  } from 'firebase/app'
import type {FirebaseApp} from 'firebase/app';
import {
  ReCaptchaV3Provider,
  initializeAppCheck
  
} from 'firebase/app-check'
import type {AppCheck} from 'firebase/app-check';
import {
  connectAuthEmulator,
  getAuth,
  browserLocalPersistence,
  setPersistence
  
} from 'firebase/auth'
import type {Auth} from 'firebase/auth';
import {
  connectFirestoreEmulator,
  getFirestore
  
} from 'firebase/firestore'
import type {Firestore} from 'firebase/firestore';
import {
  connectStorageEmulator,
  getStorage
  
} from 'firebase/storage'
import type {FirebaseStorage} from 'firebase/storage';

/**
 * El cliente de Firebase en el navegador.
 *
 * ## Sobre la configuración que se ve en el paquete
 *
 * Todos estos valores llegan al navegador y eso es correcto: la configuración
 * del cliente de Firebase es pública por diseño. Lo que protege los datos son
 * las reglas de seguridad y App Check, no el secreto de un identificador de
 * proyecto. Lo que **no** puede estar aquí es el token del proveedor de emisión
 * ni las claves del servicio de asistencia, y de eso se encarga la frontera que
 * vigila el linter.
 *
 * ## Sobre la sesión
 *
 * La persistencia es local a propósito. La primera queja del volcado inicial es
 * que el personal espera de pie a que llegue quien tiene las credenciales; una
 * sesión que sobrevive al cierre del navegador es parte de la respuesta a eso.
 * La revalidación ocurre por debajo, como en cualquier sitio moderno, en lugar
 * de pedir credenciales cada mañana.
 */

interface Configuracion {
  readonly apiKey: string
  readonly authDomain: string
  readonly projectId: string
  readonly storageBucket: string
  readonly appId: string
}

function leerConfiguracion(): Configuracion {
  const valores = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  }

  const ausentes = Object.entries(valores)
    .filter(([, valor]) => valor === undefined || valor === '')
    .map(([nombre]) => nombre)

  if (ausentes.length > 0) {
    // Falla al arrancar y con los nombres puestos. Una configuración a medias se
    // manifestaría más tarde como un error de permisos incomprensible.
    throw new Error(
      `Falta configuración de Firebase: ${ausentes.join(', ')}. Ver .env.example.`,
    )
  }

  return valores
}

const usarEmuladores = import.meta.env.VITE_USAR_EMULADORES === 'true'

let aplicacion: FirebaseApp | undefined
let atestacion: AppCheck | undefined

export function obtenerAplicacion(): FirebaseApp {
  if (aplicacion !== undefined) return aplicacion
  aplicacion =
    getApps().length > 0 ? getApp() : initializeApp(leerConfiguracion())
  return aplicacion
}

/**
 * App Check atestigua que la petición viene de nuestra aplicación y no de un
 * guion cualquiera con la configuración copiada. Es la segunda mitad de la
 * verificación transversal de las funciones de servidor: la primera dice *quién*
 * llama y ésta dice *desde dónde*.
 *
 * En desarrollo con emuladores se omite: no hay dominio registrado y exigirla
 * solo produciría un fallo que no enseña nada.
 */
export function activarAtestacion(): AppCheck | undefined {
  if (usarEmuladores) return undefined
  if (atestacion !== undefined) return atestacion

  const claveDeSitio = import.meta.env.VITE_APP_CHECK_CLAVE_SITIO
  if (claveDeSitio === undefined || claveDeSitio === '') {
    throw new Error(
      'Falta VITE_APP_CHECK_CLAVE_SITIO. Sin atestación, las funciones de servidor rechazarán todas las llamadas.',
    )
  }

  atestacion = initializeAppCheck(obtenerAplicacion(), {
    provider: new ReCaptchaV3Provider(claveDeSitio),
    isTokenAutoRefreshEnabled: true,
  })
  return atestacion
}

let autenticacion: Auth | undefined

export function obtenerAutenticacion(): Auth {
  if (autenticacion !== undefined) return autenticacion
  autenticacion = getAuth(obtenerAplicacion())
  if (usarEmuladores) {
    connectAuthEmulator(autenticacion, 'http://127.0.0.1:9099', {
      disableWarnings: true,
    })
  }
  void setPersistence(autenticacion, browserLocalPersistence)
  return autenticacion
}

let baseDeDatos: Firestore | undefined

export function obtenerBaseDeDatos(): Firestore {
  if (baseDeDatos !== undefined) return baseDeDatos
  baseDeDatos = getFirestore(obtenerAplicacion())
  if (usarEmuladores) {
    connectFirestoreEmulator(baseDeDatos, '127.0.0.1', 8080)
  }
  return baseDeDatos
}

let almacenamiento: FirebaseStorage | undefined

export function obtenerAlmacenamiento(): FirebaseStorage {
  if (almacenamiento !== undefined) return almacenamiento
  almacenamiento = getStorage(obtenerAplicacion())
  if (usarEmuladores) {
    connectStorageEmulator(almacenamiento, '127.0.0.1', 9199)
  }
  return almacenamiento
}
