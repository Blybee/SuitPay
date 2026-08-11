import { Timestamp } from 'firebase-admin/firestore'
import type {
  DocumentData,
  Firestore,
  Query,
} from 'firebase-admin/firestore'
import { COLECCIONES, bd } from '../firebase/admin.ts'
import type {
  AlmacenDeEmision,
  CambiosDelComprobante,
  Comprobante,
  Cotizacion,
  IntentoDeEmision,
  Serie,
  TransaccionDeEmision,
} from './almacen.ts'
import type { EstadoDeComprobante } from '../../domain/documentos/tipos.ts'

/**
 * La implementación real sobre Firestore.
 *
 * ## Sobre las conversiones de fecha
 *
 * Firestore devuelve `Timestamp` y el dominio trabaja con `Date`. La conversión
 * ocurre aquí, en el borde, y no se filtra hacia arriba. Si se dejara pasar el
 * `Timestamp`, el tipo `Comprobante` tendría que conocer Firestore y la frontera
 * dejaría de existir; y las pruebas en memoria empezarían a divergir del
 * comportamiento real justo en los cálculos de fecha, que es donde más duele.
 *
 * ## Sobre las lecturas
 *
 * Emitir cuesta **dos escrituras en una transacción** —el comprobante y el
 * contador de la serie— más una actualización al volver del proveedor. Las
 * lecturas de la transacción son dos: el comprobante por su clave y la serie. Ni
 * una consulta, porque los dos accesos son por identificador directo.
 */

function aFecha(valor: unknown): Date {
  if (valor instanceof Timestamp) return valor.toDate()
  if (valor instanceof Date) return valor
  return new Date(0)
}

/** Firestore rechaza `undefined`; el rastro del proveedor lo usa a menudo. */
function sinUndefined<T extends Record<string, unknown>>(objeto: T): DocumentData {
  const limpio: DocumentData = {}
  for (const [clave, valor] of Object.entries(objeto)) {
    if (valor === undefined) continue
    if (valor !== null && typeof valor === 'object' && !Array.isArray(valor)) {
      limpio[clave] = sinUndefined(valor as Record<string, unknown>)
    } else {
      limpio[clave] = valor
    }
  }
  return limpio
}

function serializarIntento(intento: IntentoDeEmision): DocumentData {
  return sinUndefined({
    momento: Timestamp.fromDate(intento.momento),
    resultado: intento.resultado,
    razon: intento.razon,
    rastro: intento.rastro,
  })
}

function aComprobante(id: string, datos: DocumentData): Comprobante {
  return {
    id,
    estado: datos['estado'] as EstadoDeComprobante,
    tipoDocumento: datos['tipoDocumento'],
    serie: datos['serie'] ?? '',
    numero: datos['numero'] ?? null,
    cliente: datos['cliente'] ?? null,
    lineas: datos['lineas'] ?? [],
    total: datos['total'] ?? 0,
    condicionPago: datos['condicionPago'],
    medioPago: datos['medioPago'] ?? null,
    vendedorId: datos['vendedorId'],
    emitidoEn: aFecha(datos['emitidoEn']),
    proveedor: datos['proveedor'] ?? null,
    cotizacionId: datos['cotizacionId'] ?? null,
    capturaId: datos['capturaId'] ?? null,
    contacto: datos['contacto'] ?? null,
    intentos: (datos['intentos'] ?? []).map(
      (intento: DocumentData): Comprobante['intentos'][number] => ({
        momento: aFecha(intento['momento']),
        resultado: intento['resultado'],
        razon: intento['razon'] ?? null,
        rastro: intento['rastro'] ?? null,
      }),
    ),
    anulacion:
      datos['anulacion'] === undefined || datos['anulacion'] === null
        ? null
        : {
            ...datos['anulacion'],
            momento: aFecha(datos['anulacion']['momento']),
          },
  }
}

function desdeComprobante(comprobante: Comprobante): DocumentData {
  return {
    estado: comprobante.estado,
    tipoDocumento: comprobante.tipoDocumento,
    serie: comprobante.serie,
    numero: comprobante.numero,
    cliente: comprobante.cliente,
    lineas: comprobante.lineas,
    total: comprobante.total,
    condicionPago: comprobante.condicionPago,
    medioPago: comprobante.medioPago,
    vendedorId: comprobante.vendedorId,
    emitidoEn: Timestamp.fromDate(comprobante.emitidoEn),
    proveedor: comprobante.proveedor,
    cotizacionId: comprobante.cotizacionId,
    capturaId: comprobante.capturaId,
    contacto: comprobante.contacto,
    intentos: comprobante.intentos.map((intento) => ({
      ...intento,
      momento: Timestamp.fromDate(intento.momento),
    })),
    anulacion: comprobante.anulacion,
  }
}

export class AlmacenFirestore implements AlmacenDeEmision {
  private readonly base: Firestore

  constructor(base?: Firestore) {
    this.base = base ?? bd()
  }

  async enTransaccion<T>(
    trabajo: (transaccion: TransaccionDeEmision) => Promise<T>,
  ): Promise<T> {
    return this.base.runTransaction(async (tx) => {
      const puente: TransaccionDeEmision = {
        leerComprobante: async (clave) => {
          const referencia = this.base
            .collection(COLECCIONES.comprobantes)
            .doc(clave)
          const instantanea = await tx.get(referencia)
          return instantanea.exists
            ? aComprobante(clave, instantanea.data() ?? {})
            : undefined
        },

        leerSerie: async (serieId) => {
          const referencia = this.base.collection(COLECCIONES.series).doc(serieId)
          const instantanea = await tx.get(referencia)
          if (!instantanea.exists) return undefined
          const datos = instantanea.data() ?? {}
          const numeroInicial =
            typeof datos['numeroInicial'] === 'number'
              ? datos['numeroInicial']
              : 1
          return {
            id: serieId,
            serie: datos['serie'],
            tipoDocumento: datos['tipoDocumento'],
            vendedorId: datos['vendedorId'],
            numeroInicial,
            ultimoNumero: datos['ultimoNumero'] ?? numeroInicial - 1,
            ultimoNumeroConfirmado:
              datos['ultimoNumeroConfirmado'] ?? numeroInicial - 1,
            activa: datos['activa'] ?? false,
          } satisfies Serie
        },

        leerCotizacion: async (cotizacionId) => {
          const referencia = this.base
            .collection(COLECCIONES.cotizaciones)
            .doc(cotizacionId)
          const instantanea = await tx.get(referencia)
          if (!instantanea.exists) return undefined
          const datos = instantanea.data() ?? {}
          return {
            id: cotizacionId,
            estado: datos['estado'],
          } satisfies Cotizacion
        },

        consumirCorrelativo: (serieId, ultimoNumero) => {
          tx.update(this.base.collection(COLECCIONES.series).doc(serieId), {
            ultimoNumero,
          })
        },

        crearComprobante: (comprobante) => {
          tx.create(
            this.base.collection(COLECCIONES.comprobantes).doc(comprobante.id),
            desdeComprobante(comprobante),
          )
        },

        eliminarCotizacion: (cotizacionId) => {
          tx.delete(
            this.base.collection(COLECCIONES.cotizaciones).doc(cotizacionId),
          )
        },
      }

      return trabajo(puente)
    })
  }

  async leerComprobante(clave: string): Promise<Comprobante | undefined> {
    const instantanea = await this.base
      .collection(COLECCIONES.comprobantes)
      .doc(clave)
      .get()
    return instantanea.exists
      ? aComprobante(clave, instantanea.data() ?? {})
      : undefined
  }

  async actualizarComprobante(
    clave: string,
    cambios: CambiosDelComprobante,
  ): Promise<void> {
    const referencia = this.base.collection(COLECCIONES.comprobantes).doc(clave)
    const { nuevoIntento, ...resto } = cambios
    const payload: DocumentData = { ...resto }
    if (resto.anulacion !== undefined && resto.anulacion !== null) {
      payload['anulacion'] = {
        ...resto.anulacion,
        momento: Timestamp.fromDate(resto.anulacion.momento),
      }
    }

    // El intento se añade con una lectura previa en lugar de con `arrayUnion`
    // porque dos intentos idénticos —mismo momento, mismo resultado— se
    // considerarían el mismo elemento y uno se perdería. La traza tiene que
    // registrar cada invocación, incluidas las repetidas.
    if (nuevoIntento === undefined) {
      await referencia.update(payload)
      return
    }

    await this.base.runTransaction(async (tx) => {
      const instantanea = await tx.get(referencia)
      const previos = (instantanea.data()?.['intentos'] ?? []) as unknown[]
      tx.update(referencia, {
        ...payload,
        intentos: [
          ...previos,
          serializarIntento(nuevoIntento),
        ],
      })
    })
  }

  async confirmarCorrelativo(serieId: string, numero: number): Promise<void> {
    await this.base
      .collection(COLECCIONES.series)
      .doc(serieId)
      .update({ ultimoNumeroConfirmado: numero })
  }

  async comprobantesEnEstado(
    estado: EstadoDeComprobante,
    limite: number,
  ): Promise<readonly Comprobante[]> {
    // Usa el índice compuesto `estado asc, emitidoEn asc` de data-model.md.
    const consulta = await this.base
      .collection(COLECCIONES.comprobantes)
      .where('estado', '==', estado)
      .orderBy('emitidoEn', 'asc')
      .limit(limite)
      .get()

    return consulta.docs.map((documento) =>
      aComprobante(documento.id, documento.data()),
    )
  }

  async leerSerie(serieId: string): Promise<Serie | undefined> {
    const instantanea = await this.base
      .collection(COLECCIONES.series)
      .doc(serieId)
      .get()
    if (!instantanea.exists) return undefined
    const datos = instantanea.data() ?? {}
    const numeroInicial =
      typeof datos['numeroInicial'] === 'number' ? datos['numeroInicial'] : 1
    return {
      id: serieId,
      serie: datos['serie'],
      tipoDocumento: datos['tipoDocumento'],
      vendedorId: datos['vendedorId'],
      numeroInicial,
      ultimoNumero: datos['ultimoNumero'] ?? numeroInicial - 1,
      ultimoNumeroConfirmado:
        datos['ultimoNumeroConfirmado'] ?? numeroInicial - 1,
      activa: datos['activa'] ?? false,
    }
  }

  async listarComprobantes(opciones: {
    readonly emitidoDesde?: Date
    readonly emitidoHastaExclusivo?: Date
    readonly clienteNumeroDocumento?: string
    readonly limite: number
    readonly cursorId?: string
  }): Promise<{
    readonly items: readonly Comprobante[]
    readonly hayMas: boolean
  }> {
    // US4b: universo colaborativo; filtros por día/rango ± cliente (data-model.md).
    let armada: Query = this.base.collection(COLECCIONES.comprobantes)

    if (opciones.clienteNumeroDocumento !== undefined) {
      armada = armada.where(
        'cliente.numeroDocumento',
        '==',
        opciones.clienteNumeroDocumento,
      )
    }
    if (opciones.emitidoDesde !== undefined) {
      armada = armada.where(
        'emitidoEn',
        '>=',
        Timestamp.fromDate(opciones.emitidoDesde),
      )
    }
    if (opciones.emitidoHastaExclusivo !== undefined) {
      armada = armada.where(
        'emitidoEn',
        '<',
        Timestamp.fromDate(opciones.emitidoHastaExclusivo),
      )
    }

    armada = armada.orderBy('emitidoEn', 'desc')

    if (opciones.cursorId !== undefined) {
      const cursor = await this.base
        .collection(COLECCIONES.comprobantes)
        .doc(opciones.cursorId)
        .get()
      if (cursor.exists) {
        armada = armada.startAfter(cursor)
      }
    }

    const instantanea = await armada.limit(opciones.limite + 1).get()
    const docs = instantanea.docs
    const hayMas = docs.length > opciones.limite
    const pagina = docs.slice(0, opciones.limite)
    return {
      items: pagina.map((documento) =>
        aComprobante(documento.id, documento.data()),
      ),
      hayMas,
    }
  }

  async buscarComprobantePorSerieNumero(
    serie: string,
    numero: number,
  ): Promise<Comprobante | undefined> {
    const instantanea = await this.base
      .collection(COLECCIONES.comprobantes)
      .where('serie', '==', serie)
      .where('numero', '==', numero)
      .limit(1)
      .get()
    const documento = instantanea.docs[0]
    if (documento === undefined) return undefined
    return aComprobante(documento.id, documento.data())
  }
}
