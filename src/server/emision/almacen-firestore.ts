import { Timestamp } from 'firebase-admin/firestore'
import type { DocumentData, Firestore } from 'firebase-admin/firestore'
import { COLECCIONES, bd } from '../firebase/admin.ts'
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
          return {
            id: serieId,
            serie: datos['serie'],
            tipoDocumento: datos['tipoDocumento'],
            vendedorId: datos['vendedorId'],
            ultimoNumero: datos['ultimoNumero'] ?? 0,
            ultimoNumeroConfirmado: datos['ultimoNumeroConfirmado'] ?? 0,
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
            comprobanteId: datos['comprobanteId'] ?? null,
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

        marcarCotizacionConvertida: (cotizacionId, comprobanteId) => {
          tx.update(
            this.base.collection(COLECCIONES.cotizaciones).doc(cotizacionId),
            {
              estado: 'convertida',
              comprobanteId,
              convertidaEn: Timestamp.now(),
            },
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

    // El intento se añade con una lectura previa en lugar de con `arrayUnion`
    // porque dos intentos idénticos —mismo momento, mismo resultado— se
    // considerarían el mismo elemento y uno se perdería. La traza tiene que
    // registrar cada invocación, incluidas las repetidas.
    if (nuevoIntento === undefined) {
      await referencia.update(resto)
      return
    }

    await this.base.runTransaction(async (tx) => {
      const instantanea = await tx.get(referencia)
      const previos = (instantanea.data()?.['intentos'] ?? []) as unknown[]
      tx.update(referencia, {
        ...resto,
        intentos: [
          ...previos,
          { ...nuevoIntento, momento: Timestamp.fromDate(nuevoIntento.momento) },
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
    // Usa el índice compuesto `estado asc, emitidoEn asc` de data-model.md, que
    // existe precisamente para este barrido.
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
    return {
      id: serieId,
      serie: datos['serie'],
      tipoDocumento: datos['tipoDocumento'],
      vendedorId: datos['vendedorId'],
      ultimoNumero: datos['ultimoNumero'] ?? 0,
      ultimoNumeroConfirmado: datos['ultimoNumeroConfirmado'] ?? 0,
      activa: datos['activa'] ?? false,
    }
  }
}
