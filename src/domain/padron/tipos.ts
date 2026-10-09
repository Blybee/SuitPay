/**
 * Fichas que salen de los PDF de padrón.
 * El documento de identidad es la identidad: DNI 8 o RUC 11.
 */

export interface ItemDeTexto {
  readonly str: string
  readonly x: number
  readonly y: number
}

export interface PaginaDeTexto {
  readonly items: readonly ItemDeTexto[]
}

export interface ClienteDePadron {
  readonly tipoDocumento: 'DNI' | 'RUC'
  readonly numeroDocumento: string
  readonly denominacion: string
  readonly direccion?: string
  readonly telefono?: string
}

export interface TransportistaDePadron {
  readonly numeroDocumento: string
  readonly denominacion: string
  readonly direccion?: string
}

export interface LecturaDePadron<T> {
  readonly filas: readonly T[]
  readonly descartados: number
}

export interface ConteoDeLote {
  readonly nuevos: number
  readonly yaExistian: number
}

export interface ResumenDeImportacion extends ConteoDeLote {
  readonly descartados: number
}

export interface ProgresoDeImportacion {
  readonly fase: 'leyendo' | 'guardando'
  readonly hecho: number
  readonly total: number
}

export interface EntradaDeIndice {
  readonly numeroDocumento: string
  readonly denominacion: string
}
