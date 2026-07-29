import { create } from 'zustand'
import {
  buscarProductos,
  crearIndice
  
  
  
} from '../../domain/busqueda/productos.ts'
import type {IndiceDeProductos, ProductoBuscable, ResultadoDeBusqueda} from '../../domain/busqueda/productos.ts';
import { usarDegradacion } from '../degradacion/estado.ts'
import { arrancar  } from './arranque.ts'
import type {ResultadoDelArranque} from './arranque.ts';

/**
 * El catálogo en el dispositivo y la búsqueda sobre él.
 *
 * ## Cero lecturas por búsqueda, y ninguna dependencia de red
 *
 * El índice se construye **una vez** al arrancar la sesión y vive en memoria. Cada
 * tecleo del vendedor lo consulta sin tocar Firestore ni ningún servicio. Eso es
 * lo que hace que FR-007 sea una propiedad estructural y no una promesa: si el
 * catálogo está en el dispositivo, la búsqueda **no puede** depender de la red
 * aunque alguien quisiera.
 *
 * ## Por qué el índice no se guarda, solo los productos
 *
 * Se persisten los productos en IndexedDB y el índice de Fuse se reconstruye al
 * arrancar. Serializar el índice ahorraría unos milisegundos de arranque y
 * añadiría un formato propio que habría que versionar y migrar. Construirlo sobre
 * 500 productos es instantáneo, así que no hay nada que ganar.
 *
 * ## Por qué esto no contradice la regla de no usar contextos globales
 *
 * La regla prohíbe descargar listas masivas al arrancar la aplicación. Aquí el
 * catálogo **es** el caso en que hacerlo es lo correcto, y por un motivo medible:
 * es un solo documento, una sola lectura, y la alternativa serían 500 lecturas o
 * una consulta por tecleo. La regla existe para evitar el coste, y aquí bajarlo
 * entero es lo que lo minimiza.
 */

interface EstadoDelCatalogo {
  readonly indice: IndiceDeProductos | null
  readonly version: number
  readonly cargando: boolean
  readonly listo: boolean
  readonly parametros: ResultadoDelArranque['parametros'] | null
  readonly clientes: ResultadoDelArranque['clientes']['lista']
  /** Verdadero si lo que hay se sirvió sin poder confirmar contra el servidor. */
  readonly posiblementeDesactualizado: boolean
}

interface AccionesDelCatalogo {
  cargar: () => Promise<void>
  buscar: (termino: string, limite?: number) => ResultadoDeBusqueda<ProductoBuscable>
  productoPorCodigo: (codigo: string) => ProductoBuscable | undefined
}

export type AlmacenDelCatalogo = EstadoDelCatalogo & AccionesDelCatalogo

const VACIO: ResultadoDeBusqueda<ProductoBuscable> = {
  coincidencias: [],
  sinCoincidencias: true,
  soloAproximadas: false,
  termino: '',
}

export const usarCatalogo = create<AlmacenDelCatalogo>((set, get) => ({
  indice: null,
  version: 0,
  cargando: false,
  listo: false,
  parametros: null,
  clientes: [],
  posiblementeDesactualizado: false,

  async cargar() {
    // Dos montajes simultáneos no deben provocar dos arranques: serían tres
    // lecturas de más, y el arranque entero cuesta tres.
    if (get().cargando || get().listo) return
    set({ cargando: true })

    try {
      const resultado = await arrancar()
      set({
        indice: crearIndice(resultado.catalogo.productos),
        version: resultado.catalogo.version,
        parametros: resultado.parametros,
        clientes: resultado.clientes.lista,
        posiblementeDesactualizado: resultado.sinRed,
        cargando: false,
        listo: true,
      })

      // Si se arrancó de la caché, el vendedor tiene que saberlo: puede vender,
      // pero un producto nuevo del catálogo de esta mañana quizá no esté.
      if (resultado.sinRed) {
        usarDegradacion.getState().declarar('red')
      }
    } catch {
      // Sin catálogo no hay búsqueda, pero la aplicación no se cae: el vendedor
      // aún puede escribir una línea a mano. Declarar la degradación es lo que
      // hace que se entere de qué perdió en lugar de ver un buscador que no
      // encuentra nada y suponer que el catálogo está vacío.
      set({ cargando: false, listo: false })
      usarDegradacion.getState().declarar('red')
    }
  },

  buscar(termino, limite = 12) {
    const indice = get().indice
    if (indice === null) return { ...VACIO, termino }
    return buscarProductos(indice, termino, limite)
  },

  productoPorCodigo(codigo) {
    const indice = get().indice
    if (indice === null) return undefined
    for (const producto of indice.porDescripcionNormalizada.values()) {
      if (producto.codigo === codigo) return producto
    }
    return undefined
  },
}))

/** El umbral vigente, con el respaldo conservador si aún no se leyó. */
export function umbralVigente(estado: AlmacenDelCatalogo): number {
  return estado.parametros?.umbralIdentificacionBoleta ?? 70_000
}
