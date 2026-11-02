const TIPOS_GEMINI: Record<string, string> = {
  OBJECT: 'object',
  ARRAY: 'array',
  STRING: 'string',
  NUMBER: 'number',
  INTEGER: 'integer',
  BOOLEAN: 'boolean',
}

/** Traduce un `responseSchema` de Gemini al JSON Schema de OpenRouter. */
export function esquemaGeminiAJson(schema: unknown): Record<string, unknown> {
  if (schema === null || typeof schema !== 'object') return { type: 'object' }
  const origen = schema as Record<string, unknown>
  const crudo = typeof origen.type === 'string' ? origen.type : 'OBJECT'
  const tipo = TIPOS_GEMINI[crudo] ?? crudo.toLowerCase()
  const salida: Record<string, unknown> = { type: tipo }
  if (Array.isArray(origen.enum)) salida.enum = origen.enum
  if (Array.isArray(origen.required)) salida.required = origen.required
  if (tipo === 'object') {
    salida.additionalProperties = false
    const propiedades = origen.properties
    if (propiedades !== null && typeof propiedades === 'object') {
      const convertidas: Record<string, unknown> = {}
      for (const [clave, valor] of Object.entries(propiedades)) {
        convertidas[clave] = esquemaGeminiAJson(valor)
      }
      salida.properties = convertidas
    }
  }
  if (tipo === 'array' && origen.items !== undefined) {
    salida.items = esquemaGeminiAJson(origen.items)
  }
  return salida
}

/** El JSON devuelto cumple el schema de Gemini que pidió el llamador. */
export function cumpleEsquema(valor: unknown, schema: unknown): boolean {
  if (schema === null || typeof schema !== 'object') return true
  const origen = schema as Record<string, unknown>
  const tipo = typeof origen.type === 'string' ? origen.type : 'OBJECT'
  if (tipo === 'OBJECT') {
    if (valor === null || typeof valor !== 'object' || Array.isArray(valor)) {
      return false
    }
    const objeto = valor as Record<string, unknown>
    const requeridos = Array.isArray(origen.required) ? origen.required : []
    for (const clave of requeridos) {
      if (typeof clave !== 'string' || !(clave in objeto)) return false
    }
    const propiedades = origen.properties
    if (propiedades !== null && typeof propiedades === 'object') {
      for (const [clave, sub] of Object.entries(propiedades)) {
        if (clave in objeto && !cumpleEsquema(objeto[clave], sub)) return false
      }
    }
    return true
  }
  if (tipo === 'ARRAY') {
    if (!Array.isArray(valor)) return false
    return valor.every((item) => cumpleEsquema(item, origen.items))
  }
  if (tipo === 'STRING') {
    if (typeof valor !== 'string') return false
    return !Array.isArray(origen.enum) || origen.enum.includes(valor)
  }
  if (tipo === 'NUMBER' || tipo === 'INTEGER') {
    return typeof valor === 'number' && Number.isFinite(valor)
  }
  if (tipo === 'BOOLEAN') return typeof valor === 'boolean'
  return true
}
