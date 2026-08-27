import { create } from 'zustand'
import {
  buscarProductos,
  crearIndice
  
  
  
} from '../../domain/busqueda/productos.ts'
import type {IndiceDeProductos, ProductoBuscable, ResultadoDeBusqueda} from '../../domain/busqueda/productos.ts';
import {
  filtrarPorFacetas,
  marcasDe,
} from '../../domain/catalogo/filtros.ts'
import type { FacetasDeCatalogo } from '../../domain/catalogo/filtros.ts'
import type { ClienteEnIndice, CategoriaEnCatalogo } from '../../infra/local/catalogo.ts'
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
  readonly productos: readonly ProductoBuscable[]
  readonly categorias: readonly CategoriaEnCatalogo[]
  readonly facetas: FacetasDeCatalogo
  readonly version: number
  readonly cargando: boolean
  readonly listo: boolean
  readonly parametros: ResultadoDelArranque['parametros'] | null
  readonly clientes: ResultadoDelArranque['clientes']['lista']
  /** Verdadero si lo que hay se sirvió sin poder confirmar contra el servidor. */
  readonly posiblementeDesactualizado: boolean
}

interface AccionesDelCatalogo {
  /**
   * @param opciones.forzar — reintenta contra el servidor aunque ya haya
   *   arrancado desde caché. Hace falta cuando el primer intento falló por
   *   sesión aún no lista y dejó la banda de «sin conexión» pegada.
   */
  cargar: (opciones?: { readonly forzar?: boolean }) => Promise<void>
  buscar: (termino: string, limite?: number) => ResultadoDeBusqueda<ProductoBuscable>
  productoPorCodigo: (codigo: string) => ProductoBuscable | undefined
  /** Actualiza el índice en memoria tras un alta (sin lectura extra). */
  incorporarCliente: (entrada: ClienteEnIndice) => void
  fijarFacetas: (facetas: FacetasDeCatalogo) => void
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
  productos: [],
  categorias: [],
  facetas: {},
  version: 0,
  cargando: false,
  listo: false,
  parametros: null,
  clientes: [],
  posiblementeDesactualizado: false,

  async cargar(opciones = {}) {
    // Dos montajes simultáneos no deben provocar dos arranques: serían tres
    // lecturas de más, y el arranque entero cuesta tres.
    if (get().cargando) return
    if (get().listo && !opciones.forzar) return
    set({ cargando: true })

    try {
      const resultado = await arrancar()
      const productos = resultado.catalogo.productos
      set({
        indice: crearIndice(productos),
        productos,
        categorias: resultado.catalogo.categorias,
        version: resultado.catalogo.version,
        parametros: resultado.parametros,
        clientes: resultado.clientes.lista,
        posiblementeDesactualizado: resultado.sinRed,
        cargando: false,
        listo: true,
      })

      // `sinRed` no significa «el SO dice offline»: significa que Firestore no
      // respondió y se usó IndexedDB. Si más tarde el servidor sí responde,
      // hay que **resolver** la banda; si no, queda pegada con wifi bueno.
      if (resultado.sinRed) {
        usarDegradacion.getState().declarar('red')
      } else {
        usarDegradacion.getState().resolver('red')
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
    const crudo = buscarProductos(indice, termino, limite * 4)
    const visibles = filtrarPorFacetas(
      crudo.coincidencias.map((c) => c.elemento),
      get().facetas,
    )
    const permitidos = new Set(visibles.map((p) => p.codigo))
    const coincidencias = crudo.coincidencias
      .filter((c) => permitidos.has(c.elemento.codigo))
      .slice(0, limite)
    return {
      coincidencias,
      sinCoincidencias: coincidencias.length === 0,
      soloAproximadas:
        coincidencias.length > 0 &&
        coincidencias.every((c) => c.grado === 'aproximada'),
      termino: crudo.termino,
    }
  },

  productoPorCodigo(codigo) {
    const indice = get().indice
    if (indice === null) return undefined
    for (const producto of indice.porDescripcionNormalizada.values()) {
      if (producto.codigo === codigo) return producto
    }
    return undefined
  },

  incorporarCliente(entrada) {
    const actuales = get().clientes
    const indice = actuales.findIndex(
      (c) => c.numeroDocumento === entrada.numeroDocumento,
    )
    if (indice >= 0) {
      const siguientes = [...actuales]
      siguientes[indice] = entrada
      set({ clientes: siguientes })
      return
    }
    set({ clientes: [...actuales, entrada] })
  },

  fijarFacetas(facetas) {
    set({ facetas })
  },
}))

export function marcasDelCatalogo(estado: AlmacenDelCatalogo): readonly string[] {
  return marcasDe(estado.productos)
}

/** El umbral vigente, con el respaldo conservador si aún no se leyó. */
export function umbralVigente(estado: AlmacenDelCatalogo): number {
  return estado.parametros?.umbralIdentificacionBoleta ?? 70_000
}
