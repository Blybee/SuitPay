import type {
  AlmacenDeEmision,
  CambiosDelComprobante,
  Comprobante,
  Cotizacion,
  Serie,
  TransaccionDeEmision,
} from './almacen.ts'
import type { EstadoDeComprobante } from '../../domain/documentos/tipos.ts'

/**
 * Almacén en memoria para las pruebas.
 *
 * ## No es un doble tonto, y no puede serlo
 *
 * La tentación sería que `enTransaccion` simplemente ejecutase el trabajo. Eso
 * haría pasar las pruebas sin comprobar nada de lo que importa: la garantía de no
 * duplicar **es** la atomicidad, y un doble que no la modela valida el orden de
 * las llamadas en lugar de la propiedad.
 *
 * De modo que aquí se modelan tres cosas de verdad:
 *
 * **Aislamiento.** Las escrituras se acumulan en un borrador y solo se aplican al
 * confirmar. Un trabajo que falla a medias no deja el correlativo consumido.
 *
 * **Detección de conflictos.** Se anota qué versiones se leyeron; si alguien las
 * cambió mientras tanto, la transacción se reintenta desde el principio, como
 * haría Firestore.
 *
 * **Serialización.** Las transacciones se encolan, de modo que dos emisiones
 * concurrentes no puedan entrelazar sus lecturas y escrituras.
 */

interface Version<T> {
  valor: T
  version: number
}

export class AlmacenEnMemoria implements AlmacenDeEmision {
  private readonly comprobantes = new Map<string, Version<Comprobante>>()
  private readonly series = new Map<string, Version<Serie>>()
  private readonly cotizaciones = new Map<string, Version<Cotizacion>>()

  /** Cuántas veces hubo que reintentar por conflicto. Se observa en pruebas. */
  reintentosPorConflicto = 0

  /** Cola para serializar transacciones. */
  private ultimaTransaccion: Promise<unknown> = Promise.resolve()

  // --- Preparación de las pruebas -----------------------------------------

  sembrarSerie(serie: Serie): void {
    this.series.set(serie.id, { valor: serie, version: 1 })
  }

  sembrarCotizacion(cotizacion: Cotizacion): void {
    this.cotizaciones.set(cotizacion.id, { valor: cotizacion, version: 1 })
  }

  sembrarComprobante(comprobante: Comprobante): void {
    this.comprobantes.set(comprobante.id, { valor: comprobante, version: 1 })
  }

  get totalDeComprobantes(): number {
    return this.comprobantes.size
  }

  cotizacionPorId(id: string): Cotizacion | undefined {
    return this.cotizaciones.get(id)?.valor
  }

  todosLosComprobantes(): readonly Comprobante[] {
    return [...this.comprobantes.values()].map((cada) => cada.valor)
  }

  // --- Transacción --------------------------------------------------------

  async enTransaccion<T>(
    trabajo: (transaccion: TransaccionDeEmision) => Promise<T>,
  ): Promise<T> {
    // Se encola sobre la anterior para que dos emisiones simultáneas no puedan
    // entrelazarse. Sin esto, el aislamiento sería una ilusión del lenguaje.
    const enCurso = this.ultimaTransaccion.then(
      () => this.ejecutarConReintento(trabajo),
      () => this.ejecutarConReintento(trabajo),
    )
    this.ultimaTransaccion = enCurso.catch(() => undefined)
    return enCurso
  }

  private async ejecutarConReintento<T>(
    trabajo: (transaccion: TransaccionDeEmision) => Promise<T>,
    intento = 0,
  ): Promise<T> {
    const leidas = new Map<string, number>()
    const borrador = {
      comprobantes: new Map<string, Comprobante>(),
      series: new Map<string, Serie>(),
      cotizaciones: new Map<string, Cotizacion>(),
      cotizacionesEliminadas: new Set<string>(),
    }

    const anotarLectura = (clave: string, version: number | undefined): void => {
      // La ausencia también se anota, con versión 0. Es lo que hace que "no
      // existía cuando lo miré" sea una condición verificable, y de eso depende
      // que dos peticiones con la misma clave no creen dos comprobantes.
      leidas.set(clave, version ?? 0)
    }

    const transaccion: TransaccionDeEmision = {
      leerComprobante: async (clave) => {
        const guardado = this.comprobantes.get(clave)
        anotarLectura(`comprobante:${clave}`, guardado?.version)
        return borrador.comprobantes.get(clave) ?? guardado?.valor
      },

      leerSerie: async (serieId) => {
        const guardada = this.series.get(serieId)
        anotarLectura(`serie:${serieId}`, guardada?.version)
        return borrador.series.get(serieId) ?? guardada?.valor
      },

      leerCotizacion: async (cotizacionId) => {
        if (borrador.cotizacionesEliminadas.has(cotizacionId)) {
          const guardada = this.cotizaciones.get(cotizacionId)
          anotarLectura(`cotizacion:${cotizacionId}`, guardada?.version)
          return undefined
        }
        const guardada = this.cotizaciones.get(cotizacionId)
        anotarLectura(`cotizacion:${cotizacionId}`, guardada?.version)
        return borrador.cotizaciones.get(cotizacionId) ?? guardada?.valor
      },

      consumirCorrelativo: (serieId, ultimoNumero) => {
        const actual = this.series.get(serieId)
        if (actual === undefined) return
        borrador.series.set(serieId, { ...actual.valor, ultimoNumero })
      },

      crearComprobante: (comprobante) => {
        borrador.comprobantes.set(comprobante.id, comprobante)
      },

      eliminarCotizacion: (cotizacionId) => {
        borrador.cotizacionesEliminadas.add(cotizacionId)
        borrador.cotizaciones.delete(cotizacionId)
      },
    }

    // Si `trabajo` lanza, la excepción sube y el borrador muere con esta llamada
    // sin haberse aplicado nunca. Esa es la propiedad que hace que un fallo a
    // mitad de la transacción no deje el correlativo consumido, y por eso aquí no
    // hay ningún `catch`: atraparlo sería justamente lo que rompería la garantía.
    const resultado: T = await trabajo(transaccion)

    if (!this.versionesSiguenIguales(leidas)) {
      if (intento >= 4) {
        throw new Error('Conflicto de transacción persistente en el almacén')
      }
      this.reintentosPorConflicto++
      return this.ejecutarConReintento(trabajo, intento + 1)
    }

    for (const [clave, valor] of borrador.comprobantes) {
      const previo = this.comprobantes.get(clave)
      this.comprobantes.set(clave, {
        valor,
        version: (previo?.version ?? 0) + 1,
      })
    }
    for (const [clave, valor] of borrador.series) {
      const previo = this.series.get(clave)
      this.series.set(clave, { valor, version: (previo?.version ?? 0) + 1 })
    }
    for (const id of borrador.cotizacionesEliminadas) {
      this.cotizaciones.delete(id)
    }
    for (const [clave, valor] of borrador.cotizaciones) {
      if (borrador.cotizacionesEliminadas.has(clave)) continue
      const previo = this.cotizaciones.get(clave)
      this.cotizaciones.set(clave, {
        valor,
        version: (previo?.version ?? 0) + 1,
      })
    }

    return resultado
  }

  private versionesSiguenIguales(leidas: Map<string, number>): boolean {
    for (const [clave, version] of leidas) {
      const [tipo, ...resto] = clave.split(':')
      const id = resto.join(':')
      const mapa =
        tipo === 'comprobante'
          ? this.comprobantes
          : tipo === 'serie'
            ? this.series
            : this.cotizaciones
      const actual = (mapa as Map<string, Version<unknown>>).get(id)
      if ((actual?.version ?? 0) !== version) return false
    }
    return true
  }

  // --- Fuera de transacción -----------------------------------------------

  async leerComprobante(clave: string): Promise<Comprobante | undefined> {
    return this.comprobantes.get(clave)?.valor
  }

  async actualizarComprobante(
    clave: string,
    cambios: CambiosDelComprobante,
  ): Promise<void> {
    const guardado = this.comprobantes.get(clave)
    if (guardado === undefined) return

    const { nuevoIntento, ...resto } = cambios
    const actualizado: Comprobante = {
      ...guardado.valor,
      ...resto,
      intentos:
        nuevoIntento === undefined
          ? guardado.valor.intentos
          : [...guardado.valor.intentos, nuevoIntento],
    }

    this.comprobantes.set(clave, {
      valor: actualizado,
      version: guardado.version + 1,
    })
  }

  async confirmarCorrelativo(serieId: string, numero: number): Promise<void> {
    const guardada = this.series.get(serieId)
    if (guardada === undefined) return
    this.series.set(serieId, {
      valor: { ...guardada.valor, ultimoNumeroConfirmado: numero },
      version: guardada.version + 1,
    })
  }

  async comprobantesEnEstado(
    estado: EstadoDeComprobante,
    limite: number,
  ): Promise<readonly Comprobante[]> {
    return [...this.comprobantes.values()]
      .map((cada) => cada.valor)
      .filter((cada) => cada.estado === estado)
      .sort((uno, otro) => uno.emitidoEn.getTime() - otro.emitidoEn.getTime())
      .slice(0, limite)
  }

  async leerSerie(serieId: string): Promise<Serie | undefined> {
    return this.series.get(serieId)?.valor
  }

  async listarComprobantes(opciones: {
    readonly vendedorId: string | null
    readonly limite: number
    readonly cursorEmitidoEn?: Date
    readonly cursorId?: string
  }): Promise<{
    readonly items: readonly Comprobante[]
    readonly hayMas: boolean
  }> {
    let items = [...this.comprobantes.values()].map((cada) => cada.valor)
    if (opciones.vendedorId !== null) {
      items = items.filter((cada) => cada.vendedorId === opciones.vendedorId)
    }
    items.sort((uno, otro) => {
      const porFecha = otro.emitidoEn.getTime() - uno.emitidoEn.getTime()
      if (porFecha !== 0) return porFecha
      return otro.id.localeCompare(uno.id)
    })

    if (
      opciones.cursorEmitidoEn !== undefined &&
      opciones.cursorId !== undefined
    ) {
      const cursorMs = opciones.cursorEmitidoEn.getTime()
      const cursorId = opciones.cursorId
      items = items.filter((cada) => {
        const ms = cada.emitidoEn.getTime()
        if (ms < cursorMs) return true
        if (ms > cursorMs) return false
        return cada.id < cursorId
      })
    }

    const pagina = items.slice(0, opciones.limite)
    return { items: pagina, hayMas: items.length > opciones.limite }
  }
}
