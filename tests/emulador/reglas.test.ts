import { readFileSync } from 'node:fs'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
  
} from '@firebase/rules-unit-testing'
import type {RulesTestEnvironment} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

/**
 * Pruebas de las reglas de seguridad contra el emulador.
 *
 * Son obligatorias por la constitución porque protegen operaciones con efecto
 * tributario. La afirmación que sostienen es fuerte: **no existe camino desde
 * ningún cliente, con ningún rol, para escribir un comprobante o mover un
 * correlativo.** Sin esa garantía, la protección contra el duplicado y la
 * integridad de la numeración serían convenciones del cliente en lugar de
 * propiedades del sistema, y un navegador con las herramientas de desarrollo
 * abiertas bastaría para inventar un comprobante.
 */

const EMULADOR = { host: '127.0.0.1', puerto: 8080 }

/**
 * ¿Está el emulador escuchando?
 *
 * El emulador necesita Java, que no está instalado en todas las máquinas donde se
 * trabaja este proyecto (T022). Sin esta comprobación, la suite entera se cae con
 * un `ECONNREFUSED` y deja la salida de las pruebas en rojo permanente; y una
 * salida que siempre está en rojo es una salida que se deja de leer, así que una
 * regresión de verdad en el dominio pasaría desapercibida.
 *
 * Saltar sí, callar no: el aviso de abajo tiene que salir por consola, porque
 * estas son las pruebas que sostienen que un comprobante no se puede escribir
 * desde un navegador, y no verificarlas es un riesgo que merece ser dicho en voz
 * alta y no un silencio cómodo.
 */
async function emuladorEscuchando(): Promise<boolean> {
  try {
    await fetch(`http://${EMULADOR.host}:${EMULADOR.puerto}/`)
    return true
  } catch {
    return false
  }
}

const hayEmulador = await emuladorEscuchando()

if (!hayEmulador) {
  console.warn(
    '\n  AVISO: las reglas de seguridad NO se verificaron.\n' +
      `  No hay emulador de Firestore en ${EMULADOR.host}:${EMULADOR.puerto}.\n` +
      '  Requiere Java. Arráncalo con: npm run emuladores\n',
  )
}

const describeConEmulador = describe.skipIf(!hayEmulador)

let entorno: RulesTestEnvironment

const VENDEDOR = { rol: 'vendedor', activo: true }
const OTRO_VENDEDOR = { rol: 'vendedor', activo: true }
const ADMINISTRADOR = { rol: 'administrador', activo: true }
const JEFE = { rol: 'jefe', activo: true }
const VENDEDOR_DESACTIVADO = { rol: 'vendedor', activo: false }

function comprobanteDeEjemplo() {
  return {
    estado: 'aceptado',
    tipoDocumento: 'boleta',
    serie: 'B001',
    numero: 1,
    total: 12_300,
    vendedorId: 'vendedor-1',
    lineas: [],
  }
}

beforeAll(async () => {
  if (!hayEmulador) return
  entorno = await initializeTestEnvironment({
    projectId: 'demo-suitpay',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: EMULADOR.host,
      port: EMULADOR.puerto,
    },
  })
})

afterAll(async () => {
  if (!hayEmulador) return
  await entorno.cleanup()
})

beforeEach(async () => {
  if (!hayEmulador) return
  await entorno.clearFirestore()

  // Se siembra con las reglas desactivadas: es el papel del backend, que
  // escribe con privilegios administrativos y no está sujeto a estas reglas.
  await entorno.withSecurityRulesDisabled(async (contexto) => {
    const bd = contexto.firestore()
    await setDoc(doc(bd, 'catalogo/actual'), { version: 1, productos: [] })
    await setDoc(doc(bd, 'indices/clientes'), { version: 1, clientes: [] })
    await setDoc(doc(bd, 'config/parametros'), {
      umbralIdentificacionBoleta: 70_000,
      ventanaAnulacion: 'mismo_dia',
      formatoImpresionPorDefecto: 'a4',
    })
    await setDoc(doc(bd, 'comprobantes/clave-existente'), comprobanteDeEjemplo())
    await setDoc(doc(bd, 'series/serie-1'), {
      serie: 'B001',
      tipoDocumento: 'boleta',
      vendedorId: 'vendedor-1',
      numeroInicial: 1,
      ultimoNumero: 7,
      ultimoNumeroConfirmado: 7,
      activa: true,
    })
    await setDoc(doc(bd, 'cotizaciones/cot-de-otro'), {
      numero: 42,
      estado: 'pendiente',
      canal: 'general',
      cliente: null,
      lineas: [],
      total: 5000,
      creadoPor: 'vendedor-2',
      creadoEn: serverTimestamp(),
    })
    await setDoc(doc(bd, 'usuarios/vendedor-1'), {
      nombre: 'Vendedor Uno',
      rol: 'vendedor',
      activo: true,
      seriesAsignadas: ['serie-1'],
    })
  })
})

function comoVendedor() {
  return entorno.authenticatedContext('vendedor-1', VENDEDOR).firestore()
}

function comoOtroVendedor() {
  return entorno.authenticatedContext('vendedor-2', OTRO_VENDEDOR).firestore()
}

function comoAdministrador() {
  return entorno.authenticatedContext('admin-1', ADMINISTRADOR).firestore()
}

function comoJefe() {
  return entorno.authenticatedContext('jefe-1', JEFE).firestore()
}

function comoDesactivado() {
  return entorno
    .authenticatedContext('vendedor-3', VENDEDOR_DESACTIVADO)
    .firestore()
}

// ---------------------------------------------------------------------------

describeConEmulador('comprobantes: la restricción más importante del sistema', () => {
  it('un vendedor NO puede crear un comprobante', async () => {
    await assertFails(
      setDoc(doc(comoVendedor(), 'comprobantes/inventado'), comprobanteDeEjemplo()),
    )
  })

  it('un vendedor NO puede declarar aceptado un comprobante', async () => {
    await assertFails(
      updateDoc(doc(comoVendedor(), 'comprobantes/clave-existente'), {
        estado: 'aceptado',
      }),
    )
  })

  it('un vendedor NO puede borrar un comprobante', async () => {
    await assertFails(
      deleteDoc(doc(comoVendedor(), 'comprobantes/clave-existente')),
    )
  })

  it('EL ADMINISTRADOR TAMPOCO puede crear un comprobante', async () => {
    // Es el caso que hace falta comprobar explícitamente. Lo natural al escribir
    // reglas es conceder al administrador todo lo que se niega al vendedor, y
    // aquí eso sería un agujero: el correlativo y la clave de idempotencia no
    // admiten un actor privilegiado en el cliente, solo el backend en transacción.
    await assertFails(
      setDoc(
        doc(comoAdministrador(), 'comprobantes/inventado-por-admin'),
        comprobanteDeEjemplo(),
      ),
    )
  })

  it('EL ADMINISTRADOR TAMPOCO puede modificar un comprobante', async () => {
    await assertFails(
      updateDoc(doc(comoAdministrador(), 'comprobantes/clave-existente'), {
        total: 1,
      }),
    )
  })

  it('el jefe tampoco', async () => {
    await assertFails(
      setDoc(doc(comoJefe(), 'comprobantes/inventado-por-jefe'), comprobanteDeEjemplo()),
    )
  })

  it('cualquiera del personal puede leerlos', async () => {
    await assertSucceeds(
      getDoc(doc(comoVendedor(), 'comprobantes/clave-existente')),
    )
    await assertSucceeds(getDoc(doc(comoJefe(), 'comprobantes/clave-existente')))
  })
})

describeConEmulador('series: el contador no lo toca nadie desde el cliente', () => {
  it('un vendedor NO puede incrementar el contador de su serie', async () => {
    await assertFails(
      updateDoc(doc(comoVendedor(), 'series/serie-1'), { ultimoNumero: 8 }),
    )
  })

  it('EL ADMINISTRADOR TAMPOCO puede tocar el contador', async () => {
    // Escribirlo permitiría reservar o repetir numeración.
    await assertFails(
      updateDoc(doc(comoAdministrador(), 'series/serie-1'), { ultimoNumero: 99 }),
    )
  })

  it('el administrador sí puede desactivar una serie', async () => {
    await assertSucceeds(
      updateDoc(doc(comoAdministrador(), 'series/serie-1'), { activa: false }),
    )
  })

  it('un vendedor lee su propia serie', async () => {
    await assertSucceeds(getDoc(doc(comoVendedor(), 'series/serie-1')))
  })

  it('un vendedor NO lee la serie de otro', async () => {
    await assertFails(getDoc(doc(comoOtroVendedor(), 'series/serie-1')))
  })
})

describeConEmulador('cotizaciones', () => {
  it('un vendedor NO puede marcar una cotización como convertida', async () => {
    await assertFails(
      updateDoc(doc(comoVendedor(), 'cotizaciones/cot-de-otro'), {
        estado: 'convertida',
      }),
    )
  })

  it('un vendedor NO puede escribir campos retirados (comprobanteId)', async () => {
    await assertFails(
      updateDoc(doc(comoVendedor(), 'cotizaciones/cot-de-otro'), {
        comprobanteId: 'inventado',
      }),
    )
  })

  it('un vendedor recupera la cotización de otro vendedor (FR-017)', async () => {
    await assertSucceeds(
      getDoc(doc(comoVendedor(), 'cotizaciones/cot-de-otro')),
    )
  })

  it('un vendedor crea una cotización propia y pendiente', async () => {
    await assertSucceeds(
      setDoc(doc(comoVendedor(), 'cotizaciones/nueva'), {
        numero: 43,
        estado: 'pendiente',
        canal: 'general',
        cliente: null,
        lineas: [],
        total: 1000,
        creadoPor: 'vendedor-1',
        creadoEn: serverTimestamp(),
      }),
    )
  })

  it('un vendedor NO puede crear una cotización a nombre de otro', async () => {
    await assertFails(
      setDoc(doc(comoVendedor(), 'cotizaciones/suplantada'), {
        numero: 44,
        estado: 'pendiente',
        canal: 'general',
        cliente: null,
        lineas: [],
        total: 1000,
        creadoPor: 'vendedor-2',
        creadoEn: serverTimestamp(),
      }),
    )
  })

  it('un vendedor puede borrar una cotización pendiente de otro (FR-019a)', async () => {
    await assertSucceeds(
      deleteDoc(doc(comoVendedor(), 'cotizaciones/cot-de-otro')),
    )
  })
})

describeConEmulador('usuarios', () => {
  it('un vendedor NO puede ascenderse a administrador', async () => {
    await assertFails(
      updateDoc(doc(comoVendedor(), 'usuarios/vendedor-1'), {
        rol: 'administrador',
      }),
    )
  })

  it('un vendedor NO puede reactivarse', async () => {
    await assertFails(
      updateDoc(doc(comoDesactivado(), 'usuarios/vendedor-3'), { activo: true }),
    )
  })

  it('un vendedor lee su propio documento', async () => {
    await assertSucceeds(getDoc(doc(comoVendedor(), 'usuarios/vendedor-1')))
  })

  it('un vendedor NO lee el documento de otro', async () => {
    await assertFails(getDoc(doc(comoOtroVendedor(), 'usuarios/vendedor-1')))
  })
})

describeConEmulador('un vendedor desactivado no puede escribir nada (FR-003)', () => {
  it('ni crear un cliente', async () => {
    await assertFails(
      setDoc(doc(comoDesactivado(), 'clientes/20123456789'), {
        tipoDocumento: 'RUC',
        numeroDocumento: '20123456789',
        denominacion: 'Ferretería Ejemplo',
        creadoPor: 'vendedor-3',
        creadoEn: serverTimestamp(),
      }),
    )
  })

  it('ni crear una cotización', async () => {
    await assertFails(
      setDoc(doc(comoDesactivado(), 'cotizaciones/de-desactivado'), {
        numero: 50,
        estado: 'pendiente',
        canal: 'general',
        cliente: null,
        lineas: [],
        total: 100,
        creadoPor: 'vendedor-3',
        creadoEn: serverTimestamp(),
      }),
    )
  })
})

describeConEmulador('clientes', () => {
  it('un vendedor crea un cliente con forma válida', async () => {
    await assertSucceeds(
      setDoc(doc(comoVendedor(), 'clientes/20123456789'), {
        tipoDocumento: 'RUC',
        numeroDocumento: '20123456789',
        denominacion: 'Ferretería Ejemplo',
        direccion: 'Av. Ejemplo 123',
        creadoPor: 'vendedor-1',
        creadoEn: serverTimestamp(),
      }),
    )
  })

  it('el identificador del documento tiene que coincidir con el número', async () => {
    await assertFails(
      setDoc(doc(comoVendedor(), 'clientes/20123456789'), {
        tipoDocumento: 'RUC',
        numeroDocumento: '99999999999',
        denominacion: 'Ferretería Ejemplo',
        creadoPor: 'vendedor-1',
        creadoEn: serverTimestamp(),
      }),
    )
  })

  it('se rechaza un campo no previsto, para que la forma no derive', async () => {
    await assertFails(
      setDoc(doc(comoVendedor(), 'clientes/20123456789'), {
        tipoDocumento: 'RUC',
        numeroDocumento: '20123456789',
        denominacion: 'Ferretería Ejemplo',
        creadoPor: 'vendedor-1',
        creadoEn: serverTimestamp(),
        descuentoEspecial: 0.5,
      }),
    )
  })

  it('un vendedor NO puede editar un cliente ya registrado', async () => {
    await entorno.withSecurityRulesDisabled(async (contexto) => {
      await setDoc(doc(contexto.firestore(), 'clientes/20999999999'), {
        tipoDocumento: 'RUC',
        numeroDocumento: '20999999999',
        denominacion: 'Original',
        creadoPor: 'vendedor-2',
      })
    })

    await assertFails(
      updateDoc(doc(comoVendedor(), 'clientes/20999999999'), {
        denominacion: 'Cambiado',
      }),
    )
  })

  it('nadie puede borrar un cliente', async () => {
    await assertFails(deleteDoc(doc(comoAdministrador(), 'clientes/20999999999')))
  })
})

describeConEmulador('instantáneas de solo lectura', () => {
  it('un vendedor lee el catálogo, el índice de clientes y los parámetros', async () => {
    const bd = comoVendedor()
    await assertSucceeds(getDoc(doc(bd, 'catalogo/actual')))
    await assertSucceeds(getDoc(doc(bd, 'indices/clientes')))
    await assertSucceeds(getDoc(doc(bd, 'config/parametros')))
  })

  it('nadie las escribe desde el cliente, ni el administrador', async () => {
    await assertFails(
      setDoc(doc(comoAdministrador(), 'catalogo/actual'), { version: 2 }),
    )
    await assertFails(
      setDoc(doc(comoAdministrador(), 'config/parametros'), {
        umbralIdentificacionBoleta: 1,
      }),
    )
  })
})

describeConEmulador('la regla por defecto niega', () => {
  it('una colección no prevista es inaccesible', async () => {
    await assertFails(getDoc(doc(comoVendedor(), 'coleccion-inventada/algo')))
    await assertFails(
      setDoc(doc(comoAdministrador(), 'coleccion-inventada/algo'), { a: 1 }),
    )
  })
})
