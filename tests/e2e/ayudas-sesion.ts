import { cert, deleteApp, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import type { Page } from '@playwright/test'

/**
 * Dejar al navegador con una sesión de vendedor válida.
 *
 * ## Por qué esto es necesario y por qué es incómodo
 *
 * La emisión está cerrada a quien no tenga rol y esté activo (FR-003), así que sin
 * sesión el botón de emitir queda inhabilitado y no hay venta que probar. Y todavía
 * no existe pantalla de acceso, de modo que la prueba no puede entrar como entraría
 * una persona.
 *
 * La consecuencia es que este archivo escribe **directamente** en el sitio donde el
 * SDK de Firebase guarda la sesión. Es un detalle interno del SDK y conviene decirlo
 * sin adornos: si Firebase cambia ese formato, esta ayuda deja de funcionar. No
 * fallará en silencio —la prueba dirá que no se puede emitir— pero el mensaje no
 * apuntará aquí, y por eso queda escrito.
 *
 * **Cuando exista la pantalla de acceso, esto se borra** y la prueba entra
 * escribiendo correo y contraseña, que además cubriría ese camino.
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

  const aplicacion = initializeApp(
    {
      projectId: PROYECTO,
      credential: cert({
        projectId: PROYECTO,
        clientEmail: `prueba@${PROYECTO}.iam.gserviceaccount.com`,
        privateKey: 'sin-uso-en-el-emulador',
      }),
    },
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
