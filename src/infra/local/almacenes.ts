import { openDB   } from 'idb'
import type {DBSchema, IDBPDatabase} from 'idb';

/**
 * Persistencia local en IndexedDB.
 *
 * Dos almacenes con propósitos distintos, y la diferencia importa:
 *
 * **El pedido en curso** existe para sobrevivir a la pérdida de conexión y al
 * cambio de red (FR-015). Es el caso real del local: si se va la luz y cae el
 * router, el vendedor pasa al wifi del teléfono de la empresa, y el pedido que
 * llevaba a medias no puede desaparecer con el cambio. No viaja entre
 * dispositivos, y eso es una decisión del negocio: cambiar de dispositivo
 * significa empezar el pedido de nuevo.
 *
 * **El espejo del catálogo** existe para que la búsqueda sea local, instantánea e
 * independiente de la red (FR-007, principio V), y para que arrancar la
 * aplicación cueste tres lecturas y no una por tecla.
 *
 * Se usa `idb` y no Dexie porque para dos almacenes Dexie sobra.
 */

interface EsquemaDeSuitPay extends DBSchema {
  pedido: {
    key: string
    value: unknown
  }
  catalogo: {
    key: string
    value: unknown
  }
}

const NOMBRE = 'suitpay'
const VERSION = 1

/** Claves fijas: cada almacén guarda un único documento, no una colección. */
export const CLAVES = {
  pedidoEnCurso: 'pedido-en-curso',
  catalogo: 'catalogo',
  indiceDeClientes: 'indice-de-clientes',
  parametros: 'parametros',
} as const

let conexion: Promise<IDBPDatabase<EsquemaDeSuitPay>> | undefined

function abrir(): Promise<IDBPDatabase<EsquemaDeSuitPay>> {
  conexion ??= openDB<EsquemaDeSuitPay>(NOMBRE, VERSION, {
    upgrade(bd) {
      if (!bd.objectStoreNames.contains('pedido')) {
        bd.createObjectStore('pedido')
      }
      if (!bd.objectStoreNames.contains('catalogo')) {
        bd.createObjectStore('catalogo')
      }
    },
  })
  return conexion
}

/**
 * Si IndexedDB no está disponible —navegación privada en algunos navegadores,
 * almacenamiento lleno— el sistema tiene que seguir vendiendo. Se pierde la
 * supervivencia del pedido ante corte de red, que es peor, pero no se pierde la
 * venta, que sería inaceptable.
 */
export function almacenamientoLocalDisponible(): boolean {
  return typeof indexedDB !== 'undefined'
}

export async function guardar<T>(
  almacen: 'pedido' | 'catalogo',
  clave: string,
  valor: T,
): Promise<void> {
  if (!almacenamientoLocalDisponible()) return
  try {
    const bd = await abrir()
    await bd.put(almacen, valor, clave)
  } catch {
    // Un fallo al persistir no puede tumbar la venta en curso. El pedido sigue
    // en memoria; lo que se pierde es la red de seguridad.
  }
}

export async function leer<T>(
  almacen: 'pedido' | 'catalogo',
  clave: string,
): Promise<T | undefined> {
  if (!almacenamientoLocalDisponible()) return undefined
  try {
    const bd = await abrir()
    return (await bd.get(almacen, clave)) as T | undefined
  } catch {
    return undefined
  }
}

export async function borrar(
  almacen: 'pedido' | 'catalogo',
  clave: string,
): Promise<void> {
  if (!almacenamientoLocalDisponible()) return
  try {
    const bd = await abrir()
    await bd.delete(almacen, clave)
  } catch {
    // Igual que arriba: no puede tumbar nada.
  }
}
