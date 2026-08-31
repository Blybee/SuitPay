import { create } from 'zustand'
import {
  calcularLineas,
  calcularTotal,
  normalizarCantidad,
  pedidoEsEmitible,
  pedidoTieneCodigo,
} from '../../domain/totales/calculo.ts'
import type {
  Centimos,
  LineaCalculada,
  LineaDePedido,
} from '../../domain/totales/calculo.ts'
import type { TipoElegible } from '../../domain/documentos/tipos.ts'
import {
  guardarPedidoEnSlot,
  leerPedidoEnSlot,
  leerMetaDeSlots,
  guardarMetaDeSlots,
  olvidarPedidoEnSlot,
} from '../../infra/local/pedido.ts'
import { CLAVES, leer } from '../../infra/local/almacenes.ts'
import type { PedidoPersistido } from '../../infra/local/pedido.ts'
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
  /** Comprobante (boleta/factura) desde el que se reutilizó el pedido. */
  readonly comprobanteOrigenId: string | null
  readonly comprobanteOrigenEtiqueta: string | null
  readonly modoCotizacion: boolean
  readonly restaurando: boolean
  readonly slotActivo: 1 | 2
  readonly segundoAbierto: boolean
}

interface AccionesDelPedido {
  /**
   * Agrega una línea si el código no está ya en el pedido.
   * @returns `false` si el producto ya estaba (no modifica el pedido).
   */
  agregarLinea: (linea: LineaDePedido) => boolean
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
   * Sustituye el pedido en curso por el contenido de una cotización recuperada.
   * Nueva clave de idempotencia: recuperar no es la misma intención de venta
   * que hubiera quedado a medias en este dispositivo.
   */
  cargarDesdeCotizacion: (datos: {
    readonly cotizacionId: string
    readonly lineas: readonly LineaDePedido[]
    readonly cliente: ClienteDelPedido | null
  }) => void
  /**
   * Carga líneas (y cliente) desde un comprobante ya emitido para armar un
   * documento nuevo. No liga cotización ni captura; nueva clave de idempotencia
   * (el comprobante origen queda intacto — principio II).
   */
  cargarDesdeComprobante: (datos: {
    readonly lineas: readonly LineaDePedido[]
    readonly cliente: ClienteDelPedido | null
    readonly comprobanteOrigenId: string
    readonly comprobanteOrigenEtiqueta?: string
  }) => void
  fijarComprobanteOrigen: (datos: {
    readonly id: string
    readonly etiqueta: string
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
  fijarModoCotizacion: (valor: boolean) => void
  abrirSegundo: () => void
  conmutarSlot: () => void
}

export type AlmacenDelPedido = EstadoDelPedido & AccionesDelPedido

const ESTADO_INICIAL: EstadoDelPedido = {
  lineas: [],
  cliente: null,
  tipoDocumento: 'nota_venta',
  cotizacionId: null,
  capturaId: null,
  claveIdempotencia: null,
  comprobanteOrigenId: null,
  comprobanteOrigenEtiqueta: null,
  modoCotizacion: false,
  restaurando: true,
  slotActivo: 1,
  segundoAbierto: false,
}


const VACIO_CONTENIDO: Omit<
  EstadoDelPedido,
  'restaurando' | 'slotActivo' | 'segundoAbierto'
> = {
  lineas: [],
  cliente: null,
  tipoDocumento: 'nota_venta',
  cotizacionId: null,
  capturaId: null,
  claveIdempotencia: null,
  comprobanteOrigenId: null,
  comprobanteOrigenEtiqueta: null,
  modoCotizacion: false,
}

let inactivo: typeof VACIO_CONTENIDO | null = null

function contenidoDe(
  estado: EstadoDelPedido | typeof VACIO_CONTENIDO,
): typeof VACIO_CONTENIDO {
  return {
    lineas: estado.lineas,
    cliente: estado.cliente,
    tipoDocumento: estado.tipoDocumento,
    cotizacionId: estado.cotizacionId,
    capturaId: estado.capturaId,
    claveIdempotencia: estado.claveIdempotencia,
    comprobanteOrigenId: estado.comprobanteOrigenId,
    comprobanteOrigenEtiqueta: estado.comprobanteOrigenEtiqueta,
    modoCotizacion: 'modoCotizacion' in estado ? estado.modoCotizacion : false,
  }
}

function hidratar(
  guardado: PedidoPersistido,
): typeof VACIO_CONTENIDO {
  return {
    lineas: guardado.lineas,
    cliente: guardado.cliente,
    tipoDocumento: guardado.tipoDocumento as TipoElegible,
    cotizacionId: guardado.cotizacionId,
    capturaId: guardado.capturaId,
    claveIdempotencia: guardado.claveIdempotencia,
    comprobanteOrigenId: guardado.comprobanteOrigenId ?? null,
    comprobanteOrigenEtiqueta: guardado.comprobanteOrigenEtiqueta ?? null,
    modoCotizacion: guardado.modoCotizacion === true,
  }
}

export const usarPedido = create<AlmacenDelPedido>((set, get) => {
  function persistir(): void {
    const estado = get()
    void guardarPedidoEnSlot(estado.slotActivo, contenidoDe(estado))
    void guardarMetaDeSlots({
      slotActivo: estado.slotActivo,
      segundoAbierto: estado.segundoAbierto,
    })
    if (estado.segundoAbierto && inactivo !== null) {
      const otro: 1 | 2 = estado.slotActivo === 1 ? 2 : 1
      void guardarPedidoEnSlot(otro, inactivo)
    }
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
      if (pedidoTieneCodigo(get().lineas, linea.codigo)) return false
      // Lo nuevo va arriba: el vendedor ve al instante lo que acaba de elegir.
      const lineas = [
        { ...linea, cantidad: normalizarCantidad(linea.cantidad) },
        ...get().lineas,
      ]
      cambiarContenido({ lineas })
      return true
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

    cargarDesdeCotizacion(datos) {
      cambiarContenido({
        lineas: datos.lineas.map((linea) => ({
          ...linea,
          cantidad: normalizarCantidad(linea.cantidad),
        })),
        cliente: datos.cliente,
        cotizacionId: datos.cotizacionId,
        capturaId: null,
        comprobanteOrigenId: null,
        comprobanteOrigenEtiqueta: null,
      })
    },

    cargarDesdeComprobante(datos) {
      cambiarContenido({
        lineas: datos.lineas.map((linea) => ({
          ...linea,
          cantidad: normalizarCantidad(linea.cantidad),
        })),
        cliente: datos.cliente,
        cotizacionId: null,
        capturaId: null,
        comprobanteOrigenId: datos.comprobanteOrigenId,
        comprobanteOrigenEtiqueta: datos.comprobanteOrigenEtiqueta ?? null,
      })
    },

    fijarComprobanteOrigen(datos) {
      cambiarContenido({
        comprobanteOrigenId: datos.id,
        comprobanteOrigenEtiqueta: datos.etiqueta,
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
      const estado = get()
      if (estado.slotActivo === 2) {
        const slot1 = inactivo ?? VACIO_CONTENIDO
        inactivo = null
        set({
          ...slot1,
          restaurando: false,
          slotActivo: 1,
          segundoAbierto: false,
        })
        void olvidarPedidoEnSlot(2)
        void guardarPedidoEnSlot(1, slot1)
        void guardarMetaDeSlots({ slotActivo: 1, segundoAbierto: false })
        return
      }
      set({
        ...VACIO_CONTENIDO,
        restaurando: false,
        slotActivo: 1,
        segundoAbierto: estado.segundoAbierto,
      })
      void olvidarPedidoEnSlot(1)
    },

    fijarModoCotizacion(valor) {
      cambiarContenido({ modoCotizacion: valor })
    },

    abrirSegundo() {
      const estado = get()
      if (estado.segundoAbierto) {
        get().conmutarSlot()
        return
      }
      inactivo = contenidoDe(estado)
      void guardarPedidoEnSlot(1, inactivo)
      set({
        ...VACIO_CONTENIDO,
        restaurando: false,
        slotActivo: 2,
        segundoAbierto: true,
      })
      persistir()
    },

    conmutarSlot() {
      const estado = get()
      if (!estado.segundoAbierto) return
      const actual = contenidoDe(estado)
      const destino: 1 | 2 = estado.slotActivo === 1 ? 2 : 1
      const siguiente = inactivo ?? VACIO_CONTENIDO
      inactivo = actual
      set({
        ...siguiente,
        restaurando: false,
        slotActivo: destino,
        segundoAbierto: true,
      })
      persistir()
    },

    async restaurar() {
      const legado = await leer<PedidoPersistido>('pedido', CLAVES.pedidoEnCurso)
      const slot1 = (await leerPedidoEnSlot(1)) ?? legado
      const slot2 = await leerPedidoEnSlot(2)
      const meta = await leerMetaDeSlots()
      const segundo = meta?.segundoAbierto === true && slot2 !== undefined
      const activo: 1 | 2 = segundo && meta?.slotActivo === 2 ? 2 : 1
      if (activo === 1 && slot2 !== undefined) inactivo = hidratar(slot2)
      if (activo === 2 && slot1 !== undefined) inactivo = hidratar(slot1)
      const principal = activo === 1 ? slot1 : slot2
      if (principal === undefined) {
        set({ restaurando: false })
        return
      }
      set({
        ...hidratar(principal),
        restaurando: false,
        slotActivo: activo,
        segundoAbierto: segundo,
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
