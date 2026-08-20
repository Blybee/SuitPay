/**
 * Los tipos de documento y sus reglas.
 *
 * La distinción que este módulo existe para sostener es la que separa un
 * documento con valor tributario de uno sin él. No es una etiqueta informativa:
 * la especificación exige que una nota de venta y el documento interno de
 * contingencia se distingan **sin margen de duda** de una factura real, y el
 * sistema no puede confundirlos ni al mostrarlos ni al numerarlos.
 */

export const TIPOS_DE_DOCUMENTO = [
  'boleta',
  'factura',
  'guia',
  'nota_venta',
  'interno_contingencia',
] as const

export type TipoDeDocumento = (typeof TIPOS_DE_DOCUMENTO)[number]

interface ReglasDelTipo {
  /** Cómo se nombra en la interfaz y en la salida impresa. */
  readonly nombre: string
  /**
   * Si el documento existe ante la autoridad tributaria. Solo los que lo tienen
   * llevan sello, y solo ellos pueden anularse ante el proveedor.
   */
  readonly valorTributario: boolean
  /**
   * Si consume un correlativo de una serie regulada. Un documento interno no lo
   * consume: gastar numeración regulada en un papel que no existe ante SUNAT
   * abriría un hueco en la secuencia que después habría que justificar.
   */
  readonly consumeSerieRegulada: boolean
  /** Si admite cliente eventual, o exige identificación siempre. */
  readonly exigeClienteIdentificado: boolean
  /**
   * Si el importe alto obliga a identificar al comprador. Solo la boleta tiene
   * umbral, porque la factura ya exige identificación por su naturaleza.
   */
  readonly sujetoAUmbralDeIdentificacion: boolean
  /** Prefijo que la autoridad exige en la serie. Vacío si no lleva serie. */
  readonly prefijoDeSerie: string
}

export const REGLAS: Record<TipoDeDocumento, ReglasDelTipo> = {
  boleta: {
    nombre: 'Boleta de venta',
    valorTributario: true,
    consumeSerieRegulada: true,
    exigeClienteIdentificado: false,
    sujetoAUmbralDeIdentificacion: true,
    prefijoDeSerie: 'B',
  },
  factura: {
    nombre: 'Factura',
    valorTributario: true,
    consumeSerieRegulada: true,
    exigeClienteIdentificado: true,
    sujetoAUmbralDeIdentificacion: false,
    prefijoDeSerie: 'F',
  },
  guia: {
    nombre: 'Guía de remisión',
    valorTributario: true,
    consumeSerieRegulada: true,
    exigeClienteIdentificado: false,
    sujetoAUmbralDeIdentificacion: false,
    prefijoDeSerie: 'T',
  },
  nota_venta: {
    nombre: 'Nota de venta',
    valorTributario: false,
    consumeSerieRegulada: false,
    exigeClienteIdentificado: false,
    sujetoAUmbralDeIdentificacion: false,
    prefijoDeSerie: '',
  },
  interno_contingencia: {
    nombre: 'Documento interno',
    valorTributario: false,
    consumeSerieRegulada: false,
    exigeClienteIdentificado: false,
    sujetoAUmbralDeIdentificacion: false,
    prefijoDeSerie: '',
  },
}

export function tieneValorTributario(tipo: TipoDeDocumento): boolean {
  return REGLAS[tipo].valorTributario
}

export function consumeSerieRegulada(tipo: TipoDeDocumento): boolean {
  return REGLAS[tipo].consumeSerieRegulada
}

/**
 * Los tipos que el vendedor puede elegir al documentar una venta. El documento
 * interno de contingencia no está: no se elige, lo ofrece el sistema cuando el
 * proveedor no responde.
 */
export const TIPOS_ELEGIBLES = [
  'boleta',
  'factura',
  'nota_venta',
] as const satisfies readonly TipoDeDocumento[]

export type TipoElegible = (typeof TIPOS_ELEGIBLES)[number]

/** Tipos a los que el administrador asigna serie regulada (incluye guía). */
export const TIPOS_CON_SERIE_ADMINISTRABLE = [
  'boleta',
  'factura',
  'guia',
] as const satisfies readonly TipoDeDocumento[]

export type TipoConSerieAdministrable =
  (typeof TIPOS_CON_SERIE_ADMINISTRABLE)[number]

/**
 * Todo documento sin valor tributario tiene que declararlo en la interfaz. La
 * etiqueta viaja con el tipo, y no como decisión de cada pantalla, para que no
 * haya ninguna superficie donde alguien olvide ponerla.
 */
export function etiquetaDeAdvertencia(tipo: TipoDeDocumento): string | null {
  if (tieneValorTributario(tipo)) return null
  return tipo === 'interno_contingencia'
    ? 'SIN VALOR TRIBUTARIO — COMPROBANTE PENDIENTE'
    : 'SIN VALOR TRIBUTARIO'
}

/** Serie válida: hasta cuatro caracteres y con el prefijo que exige el tipo. */
export function serieEsValida(tipo: TipoDeDocumento, serie: string): boolean {
  const reglas = REGLAS[tipo]
  if (!reglas.consumeSerieRegulada) return serie === ''
  if (serie.length === 0 || serie.length > 4) return false
  return serie.startsWith(reglas.prefijoDeSerie)
}

/** Los estados por los que pasa un comprobante. Ver data-model.md. */
export const ESTADOS_DE_COMPROBANTE = [
  'reclamado',
  'enviado',
  'aceptado',
  'rechazado',
  'indeterminado',
  'pendiente',
  'anulado',
  'requiere_intervencion',
] as const

export type EstadoDeComprobante = (typeof ESTADOS_DE_COMPROBANTE)[number]

/**
 * Un comprobante puede anularse cuando ya existe ante el proveedor: `enviado`
 * (registrado / sin respuesta de la autoridad) o `aceptado`. No hace falta
 * esperar la constancia de la autoridad — la máquina de estados ya permite
 * `enviado → anulado` el mismo día. La ventana temporal es aparte, en
 * `src/domain/anulacion/`.
 */
export function estadoEsAnulable(estado: EstadoDeComprobante): boolean {
  return estado === 'aceptado' || estado === 'enviado'
}
