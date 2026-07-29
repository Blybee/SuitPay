import { doc, getDocFromServer } from 'firebase/firestore'
import { obtenerBaseDeDatos } from '../../infra/firebase/cliente.ts'
import {
  guardarCatalogo,
  guardarIndiceDeClientes,
  guardarParametros,
  leerCatalogo,
  leerIndiceDeClientes,
  leerParametros
  
  
} from '../../infra/local/catalogo.ts'
import type {ClienteEnIndice, ProductoEnCatalogo} from '../../infra/local/catalogo.ts';

/**
 * El arranque de sesión.
 *
 * ## Tres lecturas. Exactamente tres.
 *
 * `catalogo/actual`, `indices/clientes` y `config/parametros`. Nada más, y esa
 * cifra es una decisión de diseño con consecuencias en toda la aplicación.
 *
 * Con esos tres documentos en el dispositivo, la búsqueda de productos y la de
 * clientes por nombre cuestan **cero lecturas** y funcionan sin red. Es lo que
 * hace que el principio V —el mostrador no se detiene— sea una propiedad del
 * sistema y no una aspiración. La alternativa, consultar Firestore en cada
 * tecleo, habría sido a la vez más lenta, más cara y dependiente de la red
 * justo donde no puede serlo.
 *
 * ## Por qué se compara la versión
 *
 * Un catálogo que no se ha tocado en tres semanas no debería bajarse tres semanas
 * seguidas. El documento del catálogo lleva su `version`; si coincide con la que
 * hay en caché, se usa la caché.
 *
 * Aquí hay una salvedad honesta: **comprobar la versión ya cuesta la lectura**,
 * porque Firestore factura por documento leído y no por bytes transferidos. Lo
 * que se ahorra no es la lectura, es transferir y volver a indexar 500 productos
 * en un teléfono. El ahorro real de lecturas viene de que esto ocurre una vez por
 * sesión y no una por búsqueda.
 *
 * ## Por qué `getDocFromServer`
 *
 * Se pide explícitamente al servidor en el arranque, en lugar de dejar que
 * Firestore sirva su propia caché. La razón es que **nuestra** caché es la de
 * IndexedDB con su versión, y queremos que la comparación sea contra lo publicado
 * de verdad. Un catálogo servido de la caché de Firestore daría siempre la misma
 * versión y el vendedor no vería nunca un producto nuevo.
 */

export interface ResultadoDelArranque {
  readonly catalogo: {
    readonly version: number
    readonly productos: readonly ProductoEnCatalogo[]
  }
  readonly clientes: {
    readonly version: number
    readonly lista: readonly ClienteEnIndice[]
  }
  readonly parametros: {
    readonly umbralIdentificacionBoleta: number
    readonly ventanaAnulacion: 'mismo_dia'
    readonly formatoImpresionPorDefecto: 'a4' | 'rollo'
  }
  /** Qué se sirvió de la caché local y qué hubo que traer. Para diagnóstico. */
  readonly desdeCache: {
    readonly catalogo: boolean
    readonly clientes: boolean
  }
  /** Verdadero si el arranque se resolvió sin red, con lo que había guardado. */
  readonly sinRed: boolean
}

const PARAMETROS_POR_OMISION = {
  // 700 soles, en céntimos. Solo se usa si nunca se pudo leer la configuración,
  // y es el valor conservador: exigir identificación antes de lo necesario
  // molesta, no exigirla cuando toca es un incumplimiento.
  umbralIdentificacionBoleta: 70_000,
  ventanaAnulacion: 'mismo_dia',
  formatoImpresionPorDefecto: 'a4',
} as const

/**
 * Arranca desde la caché local sin tocar la red. Es lo primero que se hace, para
 * que la aplicación esté usable antes de saber si hay conexión.
 */
export async function arrancarDesdeCache(): Promise<ResultadoDelArranque | null> {
  const [catalogo, clientes, parametros] = await Promise.all([
    leerCatalogo(),
    leerIndiceDeClientes(),
    leerParametros(),
  ])

  if (catalogo === undefined) return null

  return {
    catalogo: { version: catalogo.version, productos: catalogo.productos },
    clientes: {
      version: clientes?.version ?? 0,
      lista: clientes?.clientes ?? [],
    },
    parametros: parametros ?? PARAMETROS_POR_OMISION,
    desdeCache: { catalogo: true, clientes: clientes !== undefined },
    sinRed: true,
  }
}

interface DocumentoDeCatalogo {
  readonly version?: number
  readonly productos?: readonly ProductoEnCatalogo[]
}

interface DocumentoDeIndice {
  readonly version?: number
  readonly clientes?: readonly ClienteEnIndice[]
}

interface DocumentoDeParametros {
  readonly umbralIdentificacionBoleta?: number
  readonly ventanaAnulacion?: 'mismo_dia'
  readonly formatoImpresionPorDefecto?: 'a4' | 'rollo'
}

/**
 * Arranca contra el servidor. Las tres lecturas van en paralelo porque son
 * independientes: en secuencia, el arranque tardaría el triple sin ganar nada.
 */
export async function arrancarDesdeServidor(): Promise<ResultadoDelArranque> {
  const bd = obtenerBaseDeDatos()

  const [enCache, indiceEnCache] = await Promise.all([
    leerCatalogo(),
    leerIndiceDeClientes(),
  ])

  const [instantaneaCatalogo, instantaneaIndice, instantaneaParametros] =
    await Promise.all([
      getDocFromServer(doc(bd, 'catalogo', 'actual')),
      getDocFromServer(doc(bd, 'indices', 'clientes')),
      getDocFromServer(doc(bd, 'config', 'parametros')),
    ])

  const datosCatalogo = instantaneaCatalogo.data() as DocumentoDeCatalogo | undefined
  const versionPublicada = datosCatalogo?.version ?? 0

  let productos: readonly ProductoEnCatalogo[]
  let catalogoDesdeCache = false

  if (
    enCache !== undefined &&
    enCache.version === versionPublicada &&
    versionPublicada > 0
  ) {
    productos = enCache.productos
    catalogoDesdeCache = true
  } else {
    productos = datosCatalogo?.productos ?? []
    await guardarCatalogo(versionPublicada, productos)
  }

  const datosIndice = instantaneaIndice.data() as DocumentoDeIndice | undefined
  const versionDelIndice = datosIndice?.version ?? 0

  let listaDeClientes: readonly ClienteEnIndice[]
  let clientesDesdeCache = false

  if (
    indiceEnCache !== undefined &&
    indiceEnCache.version === versionDelIndice &&
    versionDelIndice > 0
  ) {
    listaDeClientes = indiceEnCache.clientes
    clientesDesdeCache = true
  } else {
    listaDeClientes = datosIndice?.clientes ?? []
    await guardarIndiceDeClientes(versionDelIndice, listaDeClientes)
  }

  const datosParametros = instantaneaParametros.data() as
    | DocumentoDeParametros
    | undefined

  const parametros = {
    umbralIdentificacionBoleta:
      datosParametros?.umbralIdentificacionBoleta ??
      PARAMETROS_POR_OMISION.umbralIdentificacionBoleta,
    ventanaAnulacion:
      datosParametros?.ventanaAnulacion ??
      PARAMETROS_POR_OMISION.ventanaAnulacion,
    formatoImpresionPorDefecto:
      datosParametros?.formatoImpresionPorDefecto ??
      PARAMETROS_POR_OMISION.formatoImpresionPorDefecto,
  }

  await guardarParametros(parametros)

  return {
    catalogo: { version: versionPublicada, productos },
    clientes: { version: versionDelIndice, lista: listaDeClientes },
    parametros,
    desdeCache: { catalogo: catalogoDesdeCache, clientes: clientesDesdeCache },
    sinRed: false,
  }
}

/**
 * El arranque completo: primero lo que haya guardado, y si hay red, contra el
 * servidor. Si el servidor falla pero había caché, se sigue con la caché y se
 * declara el estado degradado en lugar de impedir vender.
 */
export async function arrancar(): Promise<ResultadoDelArranque> {
  try {
    return await arrancarDesdeServidor()
  } catch (error) {
    const deCache = await arrancarDesdeCache()
    if (deCache !== null) return deCache
    throw error
  }
}
