import { create } from 'zustand'
import {
  calcularLineas,
  calcularTotal,
  normalizarCantidad,
  pedidoEsEmitible,
} from '../../domain/totales/calculo.ts'
import type {
  Centimos,
  LineaCalculada,
  LineaDePedido,
} from '../../domain/totales/calculo.ts'
import type { TipoElegible } from '../../domain/documentos/tipos.ts'
import {
  guardarPedido,
  leerPedido,
  olvidarPedido,
} from '../../infra/local/pedido.ts'
import { generarClaveDeIdempotencia } from '../emision/clave.ts'

/**
 * El almacén del pedido en curso.
 *
 * ## Por qué un almacén y no estado de componente
 *
 * El pedido se toca desde cuatro sitios que no son padre e hijo entre sí: la
 * búsqueda escrita, el dictado, la revisión de una fotografía y la edición de
 * precio en el propio renglón. Propagar eso por props sería atravesar media
 * aplicación con un objeto que todos modifican.
 *
 * ## Cómo se persiste
 *
 * Cada cambio se escribe en IndexedDB. No se usa el middleware de persistencia
 * de Zustand porque su almacenamiento es sincrónico por diseño e IndexedDB no lo
 * es; hacerlo a mano es menos código que adaptar el envoltorio, y además deja
 * explícito que la escritura puede fallar sin tumbar la venta.
 */

export interface ClienteDelPedido {
  readonly tipoDocumento: string
  readonly numeroDocumento: string
  readonly denominacion: string
  readonly direccion?: string
}

interface EstadoDelPedido {
  readonly lineas: readonly LineaDePedido[]
  readonly cliente: ClienteDelPedido | null
  readonly tipoDocumento: TipoElegible
  readonly cotizacionId: string | null
  readonly capturaId: string | null
  readonly claveIdempotencia: string | null
  /** Verdadero mientras se lee lo que hubiera guardado en el dispositivo. */
  readonly restaurando: boolean
}

interface AccionesDelPedido {
  agregarLinea: (linea: LineaDePedido) => void
  cambiarCantidad: (indice: number, cantidad: number) => void
  cambiarPrecio: (indice: number, precio: Centimos) => void
  quitarLinea: (indice: number) => void
  fijarCliente: (cliente: ClienteDelPedido | null) => void
  fijarTipoDocumento: (tipo: TipoElegible) => void
  fijarOrigen: (origen: {
    cotizacionId?: string | null
    capturaId?: string | null
  }) => void
  /**
   * Reclama la clave de idempotencia con la que se confirmará la venta. Es
   * idempotente a propósito: llamarla dos veces devuelve la misma clave, porque
   * la clave identifica **la intención de venta** y no la pulsación. Ahí es
   * donde muere la doble emisión por doble clic.
   */
  reclamarClaveDeIdempotencia: () => string
  soltarClaveDeIdempotencia: () => void
  vaciar: () => void
  restaurar: () => Promise<void>
}

export type AlmacenDelPedido = EstadoDelPedido & AccionesDelPedido

const ESTADO_INICIAL: EstadoDelPedido = {
  lineas: [],
  cliente: null,
  tipoDocumento: 'nota_venta',
  cotizacionId: null,
  capturaId: null,
  claveIdempotencia: null,
  restaurando: true,
}


export const usarPedido = create<AlmacenDelPedido>((set, get) => {
  function persistir(): void {
    const estado = get()
    void guardarPedido({
      lineas: estado.lineas,
      cliente: estado.cliente,
      tipoDocumento: estado.tipoDocumento,
      cotizacionId: estado.cotizacionId,
      capturaId: estado.capturaId,
      claveIdempotencia: estado.claveIdempotencia,
    })
  }

  /**
   * Cualquier cambio en el contenido de la venta invalida una clave ya
   * reclamada. Si el vendedor pulsa emitir, cambia una cantidad y vuelve a
   * pulsar, esa segunda pulsación es **otra venta** y merece otra clave;
   * reutilizar la primera haría que el servidor devolviese el comprobante
   * anterior y el vendedor cobraría un total que no coincide con lo emitido.
   */
  function cambiarContenido(cambio: Partial<EstadoDelPedido>): void {
    set({ ...cambio, claveIdempotencia: null })
    persistir()
  }

  return {
    ...ESTADO_INICIAL,

    agregarLinea(linea) {
      const lineas = [
        ...get().lineas,
        { ...linea, cantidad: normalizarCantidad(linea.cantidad) },
      ]
      cambiarContenido({ lineas })
    },

    cambiarCantidad(indice, cantidad) {
      const lineas = get().lineas.map((linea, posicion) =>
        posicion === indice
          ? { ...linea, cantidad: normalizarCantidad(cantidad) }
          : linea,
      )
      cambiarContenido({ lineas })
    },

    cambiarPrecio(indice, precio) {
      const lineas = get().lineas.map((linea, posicion) =>
        posicion === indice ? { ...linea, precio } : linea,
      )
      cambiarContenido({ lineas })
    },

    quitarLinea(indice) {
      const lineas = get().lineas.filter((_, posicion) => posicion !== indice)
      cambiarContenido({ lineas })
    },

    fijarCliente(cliente) {
      cambiarContenido({ cliente })
    },

    fijarTipoDocumento(tipo) {
      cambiarContenido({ tipoDocumento: tipo })
    },

    fijarOrigen(origen) {
      cambiarContenido({
        ...(origen.cotizacionId !== undefined
          ? { cotizacionId: origen.cotizacionId }
          : {}),
        ...(origen.capturaId !== undefined
          ? { capturaId: origen.capturaId }
          : {}),
      })
    },

    reclamarClaveDeIdempotencia() {
      const yaReclamada = get().claveIdempotencia
      if (yaReclamada !== null) return yaReclamada
      const clave = generarClaveDeIdempotencia()
      set({ claveIdempotencia: clave })
      persistir()
      return clave
    },

    soltarClaveDeIdempotencia() {
      set({ claveIdempotencia: null })
      persistir()
    },

    vaciar() {
      set({ ...ESTADO_INICIAL, restaurando: false })
      void olvidarPedido()
    },

    async restaurar() {
      const guardado = await leerPedido()
      if (guardado === undefined) {
        set({ restaurando: false })
        return
      }
      set({
        lineas: guardado.lineas,
        cliente: guardado.cliente,
        tipoDocumento: guardado.tipoDocumento as TipoElegible,
        cotizacionId: guardado.cotizacionId,
        capturaId: guardado.capturaId,
        claveIdempotencia: guardado.claveIdempotencia,
        restaurando: false,
      })
    },
  }
})

// --- Selectores -------------------------------------------------------------
//
// El total se calcula a partir de las líneas en lugar de guardarse como campo.
// Un total almacenado es un total que se puede quedar viejo, y en este sistema
// una cifra vieja es una cifra que alguien cobra.

export function lineasCalculadas(estado: AlmacenDelPedido): LineaCalculada[] {
  return calcularLineas(estado.lineas)
}

export function totalDelPedido(estado: AlmacenDelPedido): Centimos {
  return calcularTotal(estado.lineas)
}

export function sePuedeEmitir(estado: AlmacenDelPedido): boolean {
  return pedidoEsEmitible(estado.lineas)
}
