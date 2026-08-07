import { deleteApp, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import type { Page } from '@playwright/test'

/**
 * Dejar al navegador con una sesión de vendedor válida.
 *
 * ## Por qué esto es necesario y por qué es incómodo
 *
 * La emisión está cerrada a quien no tenga rol y esté activo (FR-003), así que sin
 * sesión el botón de emitir queda inhabilitado y no hay venta que probar.
 *
 * Ya existe `/acceso` (T173). Esta ayuda sigue inyectando sesión en el emulador
 * e2e porque Playwright aún depende de la Emulator Suite (T022). Cuando e2e
 * pase a cloud o use la pantalla de acceso, **borrar este archivo** y entrar
 * con correo/contraseña.
 *
 * ## Por qué un token a medida y no usuario con contraseña
 *
 * El rol viaja en las reivindicaciones del token, no en un documento, y eso es una
 * decisión de coste: leerlas no cuesta ninguna lectura de Firestore. Un alta normal
 * produce un token sin rol, y el vendedor quedaría bloqueado por no tener rol
 * asignado. Con un token a medida las reivindicaciones van dentro desde el primer
 * momento, que es como llegan en producción una vez el administrador asigna el rol.
 */

const AUTH_EMULADOR = '127.0.0.1:9099'
const PROYECTO = 'demo-suitpay'
const UID = 'vendedor-de-prueba'
const CORREO = 'vendedor@ejemplo.pe'

interface SesionInyectable {
  readonly idToken: string
  readonly refreshToken: string
}

/** Mintea un token con rol de vendedor y lo canjea por credenciales de sesión. */
async function credencialesDeVendedor(apiKey: string): Promise<SesionInyectable> {
  process.env['FIREBASE_AUTH_EMULATOR_HOST'] = AUTH_EMULADOR

  // Con AUTH emulator no hace falta credencial real (firebase-admin v14
  // rechaza claves placeholder).
  const aplicacion = initializeApp(
    { projectId: PROYECTO },
    `e2e-${Date.now()}`,
  )

  try {
    const auth = getAuth(aplicacion)

    // Idempotente a propósito: la prueba corre en dos proyectos de Playwright
    // —escritorio y móvil— y en paralelo, así que el usuario puede existir ya.
    await auth.getUser(UID).catch(() =>
      auth.createUser({ uid: UID, email: CORREO, password: 'prueba-1234' }),
    )
    await auth.setCustomUserClaims(UID, { rol: 'vendedor', activo: true })

    const tokenAMedida = await auth.createCustomToken(UID, {
      rol: 'vendedor',
      activo: true,
    })

    const respuesta = await fetch(
      `http://${AUTH_EMULADOR}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: tokenAMedida, returnSecureToken: true }),
      },
    )

    if (!respuesta.ok) {
      throw new Error(
        `El emulador rechazó el token a medida: ${respuesta.status} ${await respuesta.text()}`,
      )
    }

    const datos = (await respuesta.json()) as {
      idToken: string
      refreshToken: string
    }

    return { idToken: datos.idToken, refreshToken: datos.refreshToken }
  } finally {
    await deleteApp(aplicacion)
  }
}

/**
 * Siembra la sesión antes de que arranque la aplicación.
 *
 * Tiene que ser un guion de inicialización y no una llamada después de cargar: el
 * SDK lee la sesión guardada al construirse, y para entonces ya tiene que estar.
 */
export async function sembrarSesionDeVendedor(pagina: Page): Promise<void> {
  const apiKey = process.env['VITE_FIREBASE_API_KEY'] ?? 'clave-de-emulador'
  const { idToken, refreshToken } = await credencialesDeVendedor(apiKey)

  await pagina.addInitScript(
    ({ idToken: token, refreshToken: refresco, apiKey: clave, uid, correo }) => {
      const usuario = {
        uid,
        email: correo,
        emailVerified: false,
        isAnonymous: false,
        providerData: [],
        stsTokenManager: {
          refreshToken: refresco,
          accessToken: token,
          // Una hora, que es lo que dura un token de Firebase. Si estuviera
          // caducado el SDK lo renovaría contra el emulador, que también vale,
          // pero añadiría una espera al arranque de cada prueba.
          expirationTime: Date.now() + 3_600_000,
        },
        createdAt: String(Date.now()),
        lastLoginAt: String(Date.now()),
        apiKey: clave,
        appName: '[DEFAULT]',
      }

      window.localStorage.setItem(
        `firebase:authUser:${clave}:[DEFAULT]`,
        JSON.stringify(usuario),
      )
    },
    { idToken, refreshToken, apiKey, uid: UID, correo: CORREO },
  )
}
