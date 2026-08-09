/**
 * Intro de página admin (bajo el encabezado de migas del layout).
 * Las migas viven en `EncabezadoMigasAdmin` / `route.tsx`, no aquí.
 */
export function CabeceraAdmin({
  titulo,
  descripcion,
}: {
  /** Accesible; la etiqueta visible está en las migas del layout. */
  readonly titulo: string
  readonly descripcion?: string
}) {
  return (
    <>
      <h1 className="sr-only">{titulo}</h1>
      {descripcion !== undefined ? (
        <p className="text-cuerpo text-desvaida">{descripcion}</p>
      ) : null}
    </>
  )
}
