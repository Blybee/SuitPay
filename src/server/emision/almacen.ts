import type { EstadoDeComprobante, TipoDeDocumento  } from '../../domain/documentos/tipos.ts'
import type { TrasladoDeGuia } from '../../domain/guia/tipos.ts'
import type { ClaseDeFallo, RastroDelProveedor } from '../proveedor/interfaz.ts'

/**
 * La frontera de persistencia de la emisión.
 *
 * ## Por qué existe esta abstracción
 *
 * Podría haberse hablado con Firestore directamente. No se hace por una razón
 * concreta: **la constitución exige probar el reintento, la respuesta ausente y
 * el fallo del proveedor**, y esas pruebas no pueden depender de tener la Emulator
 * Suite levantada. Con esta frontera corren en milisegundos y en cualquier
 * máquina; sin ella, las pruebas que protegen la garantía más importante del
 * sistema serían las más frágiles de ejecutar, y unas pruebas incómodas son unas
 * pruebas que se acaban saltando.
 *
 * ## La transacción es parte de la abstracción, no un detalle
 *
 * Esto es lo que hace que la abstracción sirva de algo. La garantía de no
 * duplicar no vive en ninguna operación individual: vive en que **buscar la clave,
 * consumir el correlativo y crear el comprobante ocurran o no ocurran juntos**.
 * Si la frontera expusiera solo lecturas y escrituras sueltas, la prueba en
 * memoria validaría un orden de llamadas y no la propiedad que importa.
 *
 * De modo que la implementación en memoria tiene que simular de verdad el
 * aislamiento y el reintento por conflicto, no simplemente ejecutar el trabajo.
 * Es más código, y es el código que hace que la prueba signifique algo.
 */

// ---------------------------------------------------------------------------
// Lo que se guarda
// ---------------------------------------------------------------------------

export interface LineaDelComprobante {
  readonly codigo: string
  readonly descripcion: string
  readonly unidad: string
  readonly cantidad: number
  readonly precio: number
  readonly importe: number
}

export interface ClienteDelComprobante {
  readonly tipoDocumento: string
  readonly numeroDocumento: string
  readonly denominacion: string
  readonly direccion: string | null
  readonly eventual: boolean
}

export interface IntentoDeEmision {
  readonly momento: Date
  readonly resultado: 'exito' | ClaseDeFallo
  readonly razon: string | null
  /** El rastro crudo del proveedor. Nunca se muestra al vendedor. */
  readonly rastro: RastroDelProveedor | null
}

export interface DatosDelProveedor {
  readonly nombre: string
  readonly referenciaExterna: string | null
  readonly estadoInformado: string | null
  readonly pdf: string | null
  readonly xml: string | null
  readonly cdr: string | null
}

export interface Comprobante {
  /** La clave de idempotencia. Es el identificador del documento. */
  readonly id: string
  readonly estado: EstadoDeComprobante
  readonly tipoDocumento: TipoDeDocumento
  readonly serie: string
  readonly numero: number | null
  readonly cliente: ClienteDelComprobante | null
  readonly lineas: readonly LineaDelComprobante[]
  readonly total: number
  readonly condicionPago: {
    readonly tipo: 'contado' | 'credito'
    readonly fechaVencimiento: string | null
    readonly estadoCobro: 'no_aplica' | 'pendiente' | 'cobrado'
  }
  readonly medioPago: {
    readonly medio: string
    readonly montoRecibido: number
  } | null
  readonly vendedorId: string
  readonly emitidoEn: Date
  readonly proveedor: DatosDelProveedor | null
  readonly cotizacionId: string | null
  readonly capturaId: string | null
  readonly contacto: {
    readonly telefono: string
    readonly tipoDocumentoDeseado: TipoDeDocumento
  } | null
  readonly intentos: readonly IntentoDeEmision[]
  readonly anulacion: {
    readonly motivo: string
    readonly autor: string
    readonly momento: Date
    readonly estado: string
  } | null
  readonly traslado?: TrasladoDeGuia | null
  readonly comprobanteOrigenId?: string | null
  readonly guiaAsociadaId?: string | null
  readonly inventarioAplicado?: boolean
  readonly inventarioAplicadoPor?: string | null
  readonly inventarioRestaurado?: boolean
}

export interface Serie {
  readonly id: string
  readonly serie: string
  readonly tipoDocumento: TipoDeDocumento
  readonly vendedorId: string
  /**
   * Origen configurado al dar de alta la serie (FR-031a). El primer correlativo
   * reclamado es este valor. `ultimoNumero` arranca en `numeroInicial - 1`.
   */
  readonly numeroInicial: number
  readonly ultimoNumero: number
  /** Último correlativo con emisión confirmada. Punto de partida del sondeo. */
  readonly ultimoNumeroConfirmado: number
  readonly activa: boolean
}

export interface Cotizacion {
  readonly id: string
  /** Solo `pendiente` mientras el documento exista. Legacy puede traer otros. */
  readonly estado: 'pendiente' | 'convertida' | 'descartada'
}

/** El identificador de una serie es determinista: vendedor y tipo. */
export function idDeSerie(vendedorId: string, tipo: TipoDeDocumento): string {
  return `${vendedorId}__${tipo}`
}

// ---------------------------------------------------------------------------
// La transacción
// ---------------------------------------------------------------------------

/**
 * Lo que se puede hacer dentro de la transacción de emisión.
 *
 * Es deliberadamente estrecha. No hay forma de escribir el estado final del
 * comprobante desde aquí, porque el estado final depende de lo que conteste el
 * proveedor y **al proveedor se le llama fuera de la transacción**. Mantener una
 * transacción abierta durante una llamada de red la haría durar segundos y
 * bloquearía la serie del vendedor mientras tanto.
 */
export interface TransaccionDeEmision {
  leerComprobante: (clave: string) => Promise<Comprobante | undefined>
  leerSerie: (serieId: string) => Promise<Serie | undefined>
  leerCotizacion: (cotizacionId: string) => Promise<Cotizacion | undefined>
  /**
   * Consume el siguiente correlativo. Registra el consumo **aunque la emisión
   * acabe fallando**, que es lo que FR-030 exige: un hueco en la numeración es
   * explicable, un número reutilizado no.
   */
  consumirCorrelativo: (serieId: string, ultimoNumero: number) => void
  crearComprobante: (comprobante: Comprobante) => void
  /**
   * Actualiza un comprobante ya leído en esta transacción (p. ej. escribir
   * `guiaAsociadaId` en el origen). No crea documentos nuevos.
   */
  actualizarComprobanteEnTransaccion: (comprobante: Comprobante) => void
  /** Borrado duro en la misma transacción que crea el comprobante (FR-019). */
  eliminarCotizacion: (cotizacionId: string) => void
}

export interface CambiosDelComprobante {
  readonly estado?: EstadoDeComprobante
  readonly numero?: number
  readonly proveedor?: DatosDelProveedor
  readonly contacto?: Comprobante['contacto']
  readonly anulacion?: Comprobante['anulacion']
  /** Se añade a la traza; no la reemplaza. */
  readonly nuevoIntento?: IntentoDeEmision
  readonly guiaAsociadaId?: string | null
  readonly comprobanteOrigenId?: string | null
  readonly inventarioAplicado?: boolean
  readonly inventarioAplicadoPor?: string | null
  readonly inventarioRestaurado?: boolean
}

export interface AlmacenDeEmision {
  /**
   * Ejecuta el trabajo en una transacción. Si hay conflicto con otra escritura,
   * el trabajo **se vuelve a ejecutar desde el principio**, así que tiene que ser
   * seguro repetirlo: nada de efectos fuera de la transacción dentro de él.
   */
  enTransaccion: <T>(
    trabajo: (transaccion: TransaccionDeEmision) => Promise<T>,
  ) => Promise<T>

  leerComprobante: (clave: string) => Promise<Comprobante | undefined>

  /**
   * Actualiza el comprobante tras hablar con el proveedor. Fuera de transacción:
   * a estas alturas el documento ya existe y nadie compite por él, porque su
   * identificador es la clave de idempotencia.
   */
  actualizarComprobante: (
    clave: string,
    cambios: CambiosDelComprobante,
  ) => Promise<void>

  /** Confirma el correlativo. Mueve `ultimoNumeroConfirmado` de la serie. */
  confirmarCorrelativo: (serieId: string, numero: number) => Promise<void>

  /** Los comprobantes en un estado dado, para las tareas programadas. */
  comprobantesEnEstado: (
    estado: EstadoDeComprobante,
    limite: number,
  ) => Promise<readonly Comprobante[]>

  leerSerie: (serieId: string) => Promise<Serie | undefined>

  /**
   * Lista comprobantes de la empresa con paginación por cursor (nunca offset).
   * Orden: `emitidoEn` descendente. Sin filtro por emisor (US4b / FR-057c).
   */
  listarComprobantes: (opciones: {
    readonly emitidoDesde?: Date
    readonly emitidoHastaExclusivo?: Date
    readonly clienteNumeroDocumento?: string
    readonly limite: number
    readonly cursorId?: string
  }) => Promise<{
    readonly items: readonly Comprobante[]
    readonly hayMas: boolean
  }>

  /** Búsqueda exacta por serie + número (US4b). */
  buscarComprobantePorSerieNumero: (
    serie: string,
    numero: number,
  ) => Promise<Comprobante | undefined>
}
