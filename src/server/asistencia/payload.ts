import type { CandidatoDeAsistencia, TipoDeCaptura } from './tipos.ts'

/**
 * Único builder del payload hacia el servicio de asistencia (principio IV).
 *
 * Solo medio + lote de productos. Ningún campo de cliente, historial ni
 * identificación. T116 / SC-012 inspeccionan esta función.
 */

export interface MedioEnPayload {
  readonly mimeType: string
  readonly dataBase64: string
}

export interface PayloadDeAsistencia {
  readonly tipo: TipoDeCaptura
  readonly medio: MedioEnPayload
  readonly candidatos: readonly CandidatoDeAsistencia[]
}

const CLAVES_PROHIBIDAS = new Set([
  'razonsocial',
  'razon_social',
  'ruc',
  'dni',
  'direccion',
  'telefono',
  'teléfono',
  'correo',
  'email',
  'historial',
  'historialdecompras',
  'cliente',
  'clientname',
  'clientnames',
  'denominacion',
  'numeroDocumento',
  'numerodocumento',
  'tipodocumento',
])

export function construirPayloadDeAsistencia(entrada: {
  readonly tipo: TipoDeCaptura
  readonly medio: MedioEnPayload
  readonly candidatos: readonly CandidatoDeAsistencia[]
}): PayloadDeAsistencia {
  const candidatos = entrada.candidatos.map((c) => ({
    codigo: c.codigo,
    descripcion: c.descripcion,
    unidad: c.unidad,
    ...(c.aliases !== undefined && c.aliases.length > 0
      ? { aliases: [...c.aliases] }
      : {}),
    ...(c.etiquetas !== undefined && c.etiquetas.length > 0
      ? { etiquetas: [...c.etiquetas] }
      : {}),
  }))

  return {
    tipo: entrada.tipo,
    medio: {
      mimeType: entrada.medio.mimeType,
      dataBase64: entrada.medio.dataBase64,
    },
    candidatos,
  }
}

/**
 * Serializa el fragmento de texto del prompt que describe el lote.
 * No incluye el medio binario (va como inlineData aparte).
 */
export function textoDeCandidatosParaPrompt(
  candidatos: readonly CandidatoDeAsistencia[],
): string {
  return JSON.stringify(
    candidatos.map((c) => ({
      id: c.codigo,
      n: c.descripcion,
      a: c.aliases ?? [],
      e: c.etiquetas ?? [],
    })),
  )
}

function recopilarClaves(valor: unknown, destino: Set<string>): void {
  if (Array.isArray(valor)) {
    for (const elemento of valor) recopilarClaves(elemento, destino)
    return
  }
  if (valor !== null && typeof valor === 'object') {
    for (const [clave, hijo] of Object.entries(valor)) {
      destino.add(clave.toLowerCase())
      recopilarClaves(hijo, destino)
    }
  }
}

/** Verdadero si aparecen claves identificatorias de cliente en el payload. */
export function payloadContieneDatosDeCliente(valor: unknown): boolean {
  const claves = new Set<string>()
  recopilarClaves(valor, claves)
  for (const prohibida of CLAVES_PROHIBIDAS) {
    if (claves.has(prohibida)) return true
  }
  return false
}

export function clavesDelPayload(payload: PayloadDeAsistencia): readonly string[] {
  return Object.keys(payload)
}
