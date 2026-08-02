import { AdvertenciaNoHabido } from './advertencia.tsx'
import type { DatosDeContribuyenteParaRevision } from './clientes.funciones.ts'

/**
 * Revisión de datos traídos por la consulta oficial (FR-023).
 * Guardar solo tras confirmación del vendedor — este componente no escribe.
 */

export function RevisionDeContribuyente({
  datos,
}: {
  readonly datos: DatosDeContribuyenteParaRevision
}) {
  return (
    <div className="flex flex-col gap-3">
      {datos.noHabido ? (
        <AdvertenciaNoHabido condicion={datos.condicion} />
      ) : null}
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-cuerpo">
        <dt className="font-mono text-etiqueta uppercase text-desvaida">
          Documento
        </dt>
        <dd className="font-mono text-tinta">
          {datos.tipoDocumento} {datos.numeroDocumento}
        </dd>
        <dt className="font-mono text-etiqueta uppercase text-desvaida">
          Denominación
        </dt>
        <dd className="text-tinta">{datos.denominacion}</dd>
        {datos.direccion ? (
          <>
            <dt className="font-mono text-etiqueta uppercase text-desvaida">
              Dirección
            </dt>
            <dd className="text-tinta">{datos.direccion}</dd>
          </>
        ) : null}
        {datos.condicion ? (
          <>
            <dt className="font-mono text-etiqueta uppercase text-desvaida">
              Condición
            </dt>
            <dd className="text-tinta">{datos.condicion}</dd>
          </>
        ) : null}
      </dl>
      <p className="text-cuerpo text-desvaida">
        Confirma solo si los datos coinciden con lo que el cliente te mostró.
      </p>
    </div>
  )
}
