/**
 * Payload auditable de extraerListaPdf (FR-061).
 * Sin catálogo y sin ficha de clientes. El medio es el PDF.
 */

export type ViaDePdf = 'inline' | 'file_api'

export interface PayloadDePdf {
  readonly tipo: 'pdf'
  readonly via: ViaDePdf
  readonly medio: {
    readonly mimeType: 'application/pdf'
    /** Vacío en via file_api: los bytes no se duplican en el payload. */
    readonly dataBase64: string
  }
}

export function construirPayloadDePdf(entrada: {
  readonly via: ViaDePdf
  readonly dataBase64: string
}): PayloadDePdf {
  return {
    tipo: 'pdf',
    via: entrada.via,
    medio: {
      mimeType: 'application/pdf',
      dataBase64: entrada.via === 'inline' ? entrada.dataBase64 : '',
    },
  }
}

export function payloadPdfIncluyeCatalogoOFicha(
  payload: PayloadDePdf,
): boolean {
  const claves = Object.keys(payload)
  if (claves.some((c) => c === 'candidatos' || c === 'cliente' || c === 'clientes')) {
    return true
  }
  const medioClaves = Object.keys(payload.medio)
  return medioClaves.some(
    (c) => c !== 'mimeType' && c !== 'dataBase64',
  )
}
