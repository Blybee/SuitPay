export function listaDeEntorno(
  valor: string | undefined,
  porOmision: readonly string[],
): string[] {
  if (valor === undefined || valor.trim() === '') return [...porOmision]
  return valor
    .split(',')
    .map((cada) => cada.trim())
    .filter((cada) => cada !== '')
}

export function milisegundosDeCache(valor: string | undefined): number {
  if (valor === undefined || valor.trim() === '') return 60_000
  const numero = Number(valor)
  if (!Number.isFinite(numero) || numero < 0) {
    throw new Error(
      'MCP_USUARIO_CACHE_MS no es un número de milisegundos válido',
    )
  }
  return numero
}

export function puertoDeEntorno(valor: string | undefined): number {
  if (valor === undefined || valor.trim() === '') return 8787
  const puerto = Number(valor)
  if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535) {
    throw new Error(`PORT no es un puerto válido: ${valor}`)
  }
  return puerto
}
