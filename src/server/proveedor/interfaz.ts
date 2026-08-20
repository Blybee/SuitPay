/**
 * La interfaz propia de SuitPay hacia cualquier proveedor de comprobantes
 * electrónicos.
 *
 * Existe para cumplir el principio III: el proveedor debe poder cambiarse sin
 * reescribir la lógica de venta. El módulo que implementa esta interfaz es el
 * **único** lugar del sistema que conoce al proveedor concreto. Nada más —ni el
 * modelo de datos, ni la interfaz de usuario, ni los mensajes de error— menciona
 * su nombre, sus códigos ni sus campos.
 *
 * La comprobación de que la frontera es real es buscar el nombre del proveedor
 * en el repositorio y no encontrarlo fuera de `src/server/proveedor/`. El linter
 * ya lo impone para los imports; la revisión cubre el resto.
 *
 * Todo lo que entra y sale de aquí está en el vocabulario de SuitPay.
 */

import type { TipoDeDocumento } from '../../domain/documentos/tipos.ts'
import type { TrasladoDeGuia } from '../../domain/guia/tipos.ts'

/** Un importe en céntimos. Ver src/domain/totales/. */
type Centimos = number

// ---------------------------------------------------------------------------
// Estados normalizados
// ---------------------------------------------------------------------------

/**
 * El estado que informa el proveedor, traducido a nuestro vocabulario.
 *
 * `sin_respuesta_autoridad` merece una nota porque confundirlo cuesta caro: es
 * un estado **normal**, no un error. Significa que el proveedor tiene el
 * documento y la autoridad todavía no ha contestado. **No equivale a nuestro
 * `indeterminado`**, que expresa incertidumbre nuestra sobre si la petición
 * llegó siquiera. Ver research.md, decisión 4b: tratarlos como lo mismo
 * produciría lógica de reconciliación equivocada.
 */
export const ESTADOS_NORMALIZADOS = [
  'registrado',
  'aceptado',
  'rechazado',
  'anulado',
  'sin_respuesta_autoridad',
] as const

export type EstadoNormalizado = (typeof ESTADOS_NORMALIZADOS)[number]

// ---------------------------------------------------------------------------
// Clasificación de fallos
// ---------------------------------------------------------------------------

/**
 * La parte más importante de esta frontera: de ella depende la garantía de no
 * duplicar.
 *
 * - `rechazo_definitivo`: el proveedor respondió que el documento no es válido.
 *   Se sabe con certeza que **no** se emitió. La venta puede corregirse y
 *   volver a intentarse con una clave nueva.
 *
 * - `indisponible`: no se pudo contactar, o contestó que no puede atender. Se
 *   sabe con certeza que **no llegó a procesar**. La venta queda `pendiente`.
 *
 * - `indeterminado`: la llamada se cortó, agotó su espera, o respondió de forma
 *   que no permite saber si el documento se creó. **Éste es el caso peligroso.**
 *   Está prohibido reintentar la emisión: solo la reconciliación lo resuelve.
 *
 * Confundir `indeterminado` con `indisponible` es exactamente el error que
 * produce comprobantes duplicados. **Ante la duda, la clasificación correcta es
 * `indeterminado`**, que es la conservadora: cuesta una consulta de
 * reconciliación, mientras que equivocarse al contrario cuesta un documento
 * fiscal de más y su anulación.
 */
export const CLASES_DE_FALLO = [
  'rechazo_definitivo',
  'indisponible',
  'indeterminado',
] as const

export type ClaseDeFallo = (typeof CLASES_DE_FALLO)[number]

/**
 * Rastro original del proveedor, aislado. Se guarda en la traza del comprobante
 * para diagnosticar y **no se muestra al vendedor ni se usa para decidir nada**.
 * Va marcado como opaco a propósito: quien lo lea tiene que ser consciente de
 * que está mirando vocabulario ajeno.
 */
export interface RastroDelProveedor {
  readonly codigoOriginal: string | undefined
  readonly mensajeOriginal: string | undefined
  readonly cuerpoOriginal: string | undefined
  readonly estadoHttp: number | undefined
}

export interface FalloDelProveedor {
  readonly clase: ClaseDeFallo
  /** Por qué se clasificó así. Es lo que hace auditable la decisión. */
  readonly razon: string
  readonly rastro: RastroDelProveedor
}

export type Resultado<T> =
  | { readonly ok: true; readonly valor: T }
  | { readonly ok: false; readonly fallo: FalloDelProveedor }

// ---------------------------------------------------------------------------
// Emitir
// ---------------------------------------------------------------------------

export interface ClienteParaEmitir {
  readonly tipoDocumento: string
  readonly numeroDocumento: string
  readonly denominacion: string
  readonly direccion: string | undefined
  readonly ubigeo: string | undefined
  readonly correo: string | undefined
}

export interface LineaParaEmitir {
  readonly codigo: string
  readonly descripcion: string
  readonly unidad: string
  readonly cantidad: number
  /** Precio unitario con el impuesto ya incluido. Ver FR-032. */
  readonly precio: Centimos
  readonly importe: Centimos
}

export interface CondicionDePagoParaEmitir {
  readonly tipo: 'contado' | 'credito'
  readonly fechaVencimiento: string | undefined
}

export interface PeticionDeEmision {
  readonly tipoDocumento: TipoDeDocumento
  readonly serie: string
  /**
   * El correlativo que SuitPay reclamó en su transacción.
   *
   * `null` significa "asígnalo tú". Esa flexibilidad no es indecisión: es lo que
   * hace que el diseño funcione en los dos escenarios posibles. Con número
   * explícito, la reconciliación es una consulta directa por serie y número; sin
   * él, hay que sondear los números siguientes al último confirmado comparando
   * cliente, total y fecha. La primera vía es mucho mejor, y confirmar que el
   * proveedor la admite es la tarea T027.
   *
   * **Ninguna operación de esta interfaz decide sobre el correlativo.** Lo
   * gobierna SuitPay; la frontera solo lo transporta.
   */
  readonly numero: number | null
  readonly cliente: ClienteParaEmitir | null
  readonly lineas: readonly LineaParaEmitir[]
  readonly total: Centimos
  readonly condicionPago: CondicionDePagoParaEmitir
  readonly formatoImpresion: 'a4' | 'rollo'
  readonly emitidoEn: Date
}

/** Enlaces a lo que el proveedor genera. */
export interface ArchivosDelDocumento {
  readonly pdf: string | undefined
  readonly xml: string | undefined
  readonly cdr: string | undefined
}

export interface DocumentoEmitido {
  readonly serie: string
  readonly numero: number
  readonly estado: EstadoNormalizado
  readonly archivos: ArchivosDelDocumento
  /** Identificador del documento en el sistema del proveedor, si lo da. */
  readonly referenciaExterna: string | undefined
  readonly rastro: RastroDelProveedor
}

// ---------------------------------------------------------------------------
// Guía de remisión (vocabulario SuitPay; códigos del proveedor solo en adaptador)
// ---------------------------------------------------------------------------

export interface PeticionDeGuiaRemision {
  readonly serie: string
  readonly numero: number | null
  readonly destinatario: ClienteParaEmitir | null
  readonly traslado: TrasladoDeGuia
  readonly formatoImpresion: 'a4' | 'rollo'
  readonly emitidoEn: Date
}

// ---------------------------------------------------------------------------
// Anular
// ---------------------------------------------------------------------------

export interface PeticionDeAnulacion {
  readonly tipoDocumento: TipoDeDocumento
  readonly serie: string
  readonly numero: number
  readonly motivo: string
  readonly emitidoEn: Date
}

export interface DocumentoAnulado {
  readonly estado: EstadoNormalizado
  readonly referenciaExterna: string | undefined
  readonly rastro: RastroDelProveedor
}

// ---------------------------------------------------------------------------
// Consultar documento
// ---------------------------------------------------------------------------

/**
 * Lo que devuelve una consulta. Es la primitiva de la que depende **toda** la
 * reconciliación, y por eso incluye contenido suficiente para identificar una
 * venta —cliente, total y fecha— y no solo el estado: cuando el número no era
 * conocido de antemano, esos tres datos son lo único que permite decidir si el
 * documento encontrado es el nuestro.
 */
export interface DocumentoConsultado {
  readonly existe: boolean
  readonly serie: string
  readonly numero: number
  readonly estado: EstadoNormalizado | undefined
  readonly total: Centimos | undefined
  readonly numeroDocumentoCliente: string | undefined
  readonly emitidoEn: Date | undefined
  readonly archivos: ArchivosDelDocumento
  readonly rastro: RastroDelProveedor
}

export interface PeticionDeConsulta {
  readonly tipoDocumento: TipoDeDocumento
  readonly serie: string
  readonly numero: number
}

// ---------------------------------------------------------------------------
// Consultar contribuyente
// ---------------------------------------------------------------------------

export interface PeticionDeContribuyente {
  readonly tipoDocumento: 'DNI' | 'RUC'
  readonly numeroDocumento: string
}

export interface Contribuyente {
  readonly denominacion: string
  readonly direccion: string | undefined
  readonly ubigeo: string | undefined
  /**
   * Estado ante el registro oficial. Alimenta la advertencia de FR-024: hay que
   * poder avisar al vendedor de que el contribuyente está señalado como no
   * habido, sin impedirle facturar.
   */
  readonly condicion: string | undefined
  readonly estadoRegistro: string | undefined
}

// ---------------------------------------------------------------------------
// Nota de crédito
// ---------------------------------------------------------------------------

export interface PeticionDeNotaDeCredito {
  readonly serie: string
  readonly numero: number | null
  readonly documentoDeReferencia: {
    readonly tipoDocumento: TipoDeDocumento
    readonly serie: string
    readonly numero: number
  }
  readonly motivo: string
  readonly cliente: ClienteParaEmitir | null
  readonly lineas: readonly LineaParaEmitir[]
  readonly total: Centimos
  readonly emitidoEn: Date
}

// ---------------------------------------------------------------------------
// Administración (establecimientos y series) — T083
// ---------------------------------------------------------------------------

/** Establecimiento / sede del emisor ante el proveedor. */
export interface Establecimiento {
  readonly id: string
  readonly nombre: string
  readonly codigoAnexo: string
  readonly direccion: string
  readonly ubigeoId: string
  readonly correo: string | undefined
}

export interface PeticionDeCrearEstablecimiento {
  readonly nombre?: string
  readonly codigoAnexo: string
  readonly direccion: string
  readonly ubigeoId: string
  readonly correo?: string
}

export interface SerieEnProveedor {
  readonly id: string
  readonly serie: string
  readonly tipoDocumento: TipoDeDocumento
  readonly numeroInicial: number
  readonly establecimientoId: string
}

export interface PeticionDeCrearSerieEnProveedor {
  readonly tipoDocumento: TipoDeDocumento
  readonly serie: string
  readonly numeroInicial: number
  readonly establecimientoId: string
}

// ---------------------------------------------------------------------------
// La interfaz
// ---------------------------------------------------------------------------

/**
 * Todo implementador debe cumplir además tres cosas que el tipo no puede
 * expresar:
 *
 * - **Los tiempos de espera son explícitos y cortos.** Una espera indefinida en
 *   el mostrador es peor que un estado indeterminado bien gestionado, porque
 *   bloquea al vendedor delante del cliente.
 * - **La frontera no reintenta por su cuenta.** Reintentar es una decisión de la
 *   lógica de emisión, la única que conoce el estado del comprobante.
 * - **Los secretos no salen de aquí.** Nunca en un resultado, nunca en un rastro.
 */
export interface ProveedorDeEmision {
  /** Nombre para la traza y los registros. No se muestra al vendedor. */
  readonly nombre: string

  emitir: (peticion: PeticionDeEmision) => Promise<Resultado<DocumentoEmitido>>

  emitirGuiaRemision: (
    peticion: PeticionDeGuiaRemision,
  ) => Promise<Resultado<DocumentoEmitido>>

  anular: (peticion: PeticionDeAnulacion) => Promise<Resultado<DocumentoAnulado>>

  consultarDocumento: (
    peticion: PeticionDeConsulta,
  ) => Promise<Resultado<DocumentoConsultado>>

  consultarContribuyente: (
    peticion: PeticionDeContribuyente,
  ) => Promise<Resultado<Contribuyente>>

  emitirNotaCredito: (
    peticion: PeticionDeNotaDeCredito,
  ) => Promise<Resultado<DocumentoEmitido>>

  crearEstablecimiento: (
    peticion: PeticionDeCrearEstablecimiento,
  ) => Promise<Resultado<Establecimiento>>

  listarEstablecimientos: () => Promise<Resultado<readonly Establecimiento[]>>

  eliminarEstablecimiento: (
    establecimientoId: string,
  ) => Promise<Resultado<{ readonly eliminado: true }>>

  crearSerie: (
    peticion: PeticionDeCrearSerieEnProveedor,
  ) => Promise<Resultado<SerieEnProveedor>>

  eliminarSerie: (
    serieIdEnProveedor: string,
  ) => Promise<Resultado<{ readonly eliminado: true }>>
}

// ---------------------------------------------------------------------------
// Ayudas para construir resultados
// ---------------------------------------------------------------------------

export const RASTRO_VACIO: RastroDelProveedor = {
  codigoOriginal: undefined,
  mensajeOriginal: undefined,
  cuerpoOriginal: undefined,
  estadoHttp: undefined,
}

export function exito<T>(valor: T): Resultado<T> {
  return { ok: true, valor }
}

export function fallo<T>(
  clase: ClaseDeFallo,
  razon: string,
  rastro: RastroDelProveedor = RASTRO_VACIO,
): Resultado<T> {
  return { ok: false, fallo: { clase, razon, rastro } }
}

/**
 * Traslada un fallo de un resultado a otro de distinto tipo. Se usa cuando una
 * operación se apoya en otra y no puede añadir nada al diagnóstico: conserva la
 * clasificación original en lugar de reclasificar, que es lo que la degradaría.
 */
export function propagarFallo<T>(elFallo: FalloDelProveedor): Resultado<T> {
  return { ok: false, fallo: elFallo }
}

/**
 * Si un fallo permite volver a emitir la misma venta con una clave nueva. Sale
 * de la clasificación y no del criterio de quien la lea, porque es la decisión
 * que el principio II protege.
 */
export function permiteVolverAEmitir(elFallo: FalloDelProveedor): boolean {
  return elFallo.clase === 'rechazo_definitivo'
}

/** Si un fallo prohíbe reintentar y obliga a reconciliar. */
export function obligaAReconciliar(elFallo: FalloDelProveedor): boolean {
  return elFallo.clase === 'indeterminado'
}
