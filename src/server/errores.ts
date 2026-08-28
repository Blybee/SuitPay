/**
 * Los errores que el backend puede devolver.
 *
 * ## Dos reglas que este archivo existe para imponer
 *
 * **El código es estable y el mensaje es para el vendedor.** El cliente decide
 * qué hacer mirando el código, nunca leyendo el texto. Un texto que se usa para
 * decidir es un texto que no se puede mejorar.
 *
 * **Nunca se propaga el mensaje crudo del proveedor.** Por tres razones que se
 * refuerzan: sus mensajes están escritos para un integrador y no para alguien de
 * pie en un mostrador; pueden filtrar detalles de la integración que no le
 * incumben a nadie del otro lado; y si su texto llegase a la pantalla, un cambio
 * de proveedor cambiaría lo que lee el vendedor, que es exactamente lo que el
 * principio III existe para evitar. El texto crudo se guarda en la traza del
 * comprobante, donde sirve para diagnosticar, y no sale de ahí.
 */

export const CODIGOS_DE_ERROR = {
  // --- Sesión y permisos ---------------------------------------------------
  sesion_ausente: 'sesion_ausente',
  sesion_invalida: 'sesion_invalida',
  usuario_desactivado: 'usuario_desactivado',
  rol_insuficiente: 'rol_insuficiente',

  // --- Emisión -------------------------------------------------------------
  peticion_invalida: 'peticion_invalida',
  serie_no_configurada: 'serie_no_configurada',
  cliente_requerido: 'cliente_requerido',
  importe_no_positivo: 'importe_no_positivo',
  precio_bajo_catalogo: 'precio_bajo_catalogo',
  cotizacion_ya_usada: 'cotizacion_ya_usada',
  cotizacion_no_pendiente: 'cotizacion_no_pendiente',
  emision_indeterminada: 'emision_indeterminada',
  proveedor_no_disponible: 'proveedor_no_disponible',
  emision_rechazada: 'emision_rechazada',
  guia_asociada_existente: 'guia_asociada_existente',

  // --- Anulación -----------------------------------------------------------
  fuera_de_ventana_anulacion: 'fuera_de_ventana_anulacion',
  estado_no_anulable: 'estado_no_anulable',
  comprobante_no_encontrado: 'comprobante_no_encontrado',

  // --- Contribuyentes ------------------------------------------------------
  no_encontrado: 'no_encontrado',
  servicio_no_disponible: 'servicio_no_disponible',

  // --- Administración / sync proveedor ------------------------------------
  proveedor_admin_no_disponible: 'proveedor_admin_no_disponible',

  // --- Asistencia ----------------------------------------------------------
  medio_ilegible: 'medio_ilegible',
  asistencia_no_disponible: 'asistencia_no_disponible',

  // --- Catálogo ------------------------------------------------------------
  archivo_no_interpretable: 'archivo_no_interpretable',
  codigos_duplicados: 'codigos_duplicados',

  // --- Otros ---------------------------------------------------------------
  fallo_inesperado: 'fallo_inesperado',
} as const

export type CodigoDeError =
  (typeof CODIGOS_DE_ERROR)[keyof typeof CODIGOS_DE_ERROR]

/**
 * Mensajes para mostrar al vendedor. Están escritos para leerse de pie, con
 * prisa y a distancia, así que dicen qué pasó y qué hacer, en ese orden.
 *
 * Ninguno usa la palabra "eliminar" referida a un comprobante (FR-039).
 */
const MENSAJES: Record<CodigoDeError, string> = {
  sesion_ausente: 'Tu sesión no está activa. Vuelve a entrar.',
  sesion_invalida: 'Tu sesión caducó. Vuelve a entrar.',
  usuario_desactivado:
    'Tu usuario está desactivado. Habla con el administrador.',
  rol_insuficiente: 'Tu usuario no tiene permiso para esta operación.',

  peticion_invalida: 'Faltan datos o alguno no es válido. Revisa el pedido.',
  serie_no_configurada:
    'No tienes serie configurada para este tipo de documento. El administrador debe asignártela antes de emitir.',
  cliente_requerido:
    'Este importe obliga a identificar al cliente. Ingresa su documento para continuar.',
  importe_no_positivo:
    'Hay una línea con cantidad o precio en cero. Corrígela para poder emitir.',
  precio_bajo_catalogo:
    'Hay un precio por debajo del mayorista. Súbelo al precio de catálogo o más para poder emitir.',
  cotizacion_ya_usada:
    'Esta cotización ya no existe: se convirtió o se quitó. No se puede emitir otra vez con ella.',
  cotizacion_no_pendiente:
    'Esa cotización no se puede convertir. Comprueba que exista y siga pendiente.',
  emision_indeterminada:
    'No se pudo confirmar si el comprobante se emitió. NO vuelvas a emitir a ciegas: usa «Consultar estado».',
  proveedor_no_disponible:
    'El servicio de emisión no responde. El pedido se conserva: inténtalo de nuevo en unos minutos.',
  emision_rechazada:
    'El comprobante fue rechazado. Revisa el motivo en su detalle antes de volver a intentarlo.',
  guia_asociada_existente:
    'Ese comprobante ya tiene una guía vigente. Anúlala antes de emitir otra.',

  fuera_de_ventana_anulacion:
    'Este comprobante es de un día anterior y ya no puede anularse. Corresponde una nota de crédito.',
  estado_no_anulable:
    'Este comprobante no está en un estado que admita anulación.',
  comprobante_no_encontrado: 'No se encontró ese comprobante.',

  no_encontrado: 'No se encontraron datos para ese documento de identidad.',
  servicio_no_disponible:
    'La consulta de datos oficiales no responde. Puedes escribir los datos del cliente a mano y continuar.',
  proveedor_admin_no_disponible:
    'El proveedor no aceptó la configuración (serie o establecimiento). En DEMO puedes usar series locales; en PRODUCCION hay que crearlas en el panel del proveedor.',

  medio_ilegible:
    'No se pudo leer la captura. Vuelve a tomarla con mejor luz, o escribe el pedido.',
  asistencia_no_disponible:
    'La asistencia por voz, foto y PDF no está disponible. Puedes escribir el pedido con normalidad.',

  archivo_no_interpretable:
    'No se pudo interpretar el archivo. Revisa su formato.',
  codigos_duplicados:
    'El archivo tiene códigos de producto repetidos. Hay que resolverlos antes de publicar.',

  fallo_inesperado:
    'Ocurrió un fallo inesperado. Si vuelve a pasar, avisa al administrador.',
}

/**
 * Si el cliente puede reintentar la misma operación tal cual.
 *
 * `emision_indeterminada` es el caso que da sentido a esta tabla: es un fallo
 * cuyo reintento produciría un comprobante duplicado, que es precisamente lo que
 * el principio II prohíbe. La prohibición vive en el dato y no en la disciplina
 * de quien escriba la interfaz.
 */
const REINTENTABLE: Record<CodigoDeError, boolean> = {
  sesion_ausente: false,
  sesion_invalida: false,
  usuario_desactivado: false,
  rol_insuficiente: false,

  peticion_invalida: false,
  serie_no_configurada: false,
  cliente_requerido: false,
  importe_no_positivo: false,
  precio_bajo_catalogo: false,
  cotizacion_ya_usada: false,
  cotizacion_no_pendiente: false,
  emision_indeterminada: false,
  proveedor_no_disponible: true,
  emision_rechazada: false,
  guia_asociada_existente: false,

  fuera_de_ventana_anulacion: false,
  estado_no_anulable: false,
  comprobante_no_encontrado: false,

  no_encontrado: false,
  servicio_no_disponible: true,
  proveedor_admin_no_disponible: true,

  medio_ilegible: false,
  asistencia_no_disponible: true,

  archivo_no_interpretable: false,
  codigos_duplicados: false,

  fallo_inesperado: true,
}

export interface DetalleDeError {
  /** Datos estructurados que la interfaz puede usar para explicar mejor. */
  readonly [clave: string]: string | number | boolean | null
}

export class ErrorDeSuitPay extends Error {
  readonly codigo: CodigoDeError
  readonly mensajeParaVendedor: string
  readonly reintentable: boolean
  readonly detalle: DetalleDeError | undefined

  constructor(codigo: CodigoDeError, detalle?: DetalleDeError) {
    super(`${codigo}: ${MENSAJES[codigo]}`)
    this.name = 'ErrorDeSuitPay'
    this.codigo = codigo
    this.mensajeParaVendedor = MENSAJES[codigo]
    this.reintentable = REINTENTABLE[codigo]
    this.detalle = detalle
  }

  /** La forma en que el error viaja al cliente. Sin rastro del proveedor. */
  aRespuesta(): {
    codigo: CodigoDeError
    mensaje: string
    reintentable: boolean
    detalle?: DetalleDeError
  } {
    return {
      codigo: this.codigo,
      mensaje: this.mensajeParaVendedor,
      reintentable: this.reintentable,
      ...(this.detalle !== undefined ? { detalle: this.detalle } : {}),
    }
  }
}

export function fallar(
  codigo: CodigoDeError,
  detalle?: DetalleDeError,
): never {
  throw new ErrorDeSuitPay(codigo, detalle)
}

export function esErrorDeSuitPay(valor: unknown): valor is ErrorDeSuitPay {
  if (valor instanceof ErrorDeSuitPay) return true
  // Bundles duplicados / réplicas: `instanceof` puede fallar aunque el valor
  // sea el mismo contrato (código estable + aRespuesta).
  if (typeof valor !== 'object' || valor === null) return false
  const candidato = valor as {
    codigo?: unknown
    aRespuesta?: unknown
    name?: unknown
  }
  return (
    candidato.name === 'ErrorDeSuitPay' &&
    typeof candidato.codigo === 'string' &&
    candidato.codigo in CODIGOS_DE_ERROR &&
    typeof candidato.aRespuesta === 'function'
  )
}

export function mensajeDe(codigo: CodigoDeError): string {
  return MENSAJES[codigo]
}
