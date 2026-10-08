export function mensajeDeFalloAlGuardar(
  error:
    | {
        readonly mensaje?: string
        readonly detalle?: { readonly motivo?: unknown }
      }
    | undefined,
  respaldo = 'No se pudo publicar el catálogo.',
): string {
  const base =
    error?.mensaje && error.mensaje.length > 0 ? error.mensaje : respaldo
  const motivo = error?.detalle?.motivo
  if (typeof motivo !== 'string' || motivo.trim().length === 0) return base
  return `${base} Motivo: ${motivo}.`
}
