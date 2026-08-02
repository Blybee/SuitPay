import { Campo, Etiqueta } from '../../ui/componentes/primitivas.tsx'
import type { Cliente } from '../../domain/esquemas/comunes.ts'

/**
 * Introducción manual cuando la consulta oficial no responde (FR-026).
 * No bloquea la venta.
 */

export type DatosManualesDeCliente = Pick<
  Cliente,
  'tipoDocumento' | 'numeroDocumento' | 'denominacion' | 'direccion'
>

export function FormularioManualDeCliente({
  valor,
  onCambiar,
}: {
  readonly valor: DatosManualesDeCliente
  readonly onCambiar: (valor: DatosManualesDeCliente) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-cuerpo text-desvaida">
        La consulta oficial no responde. Escribe los datos y continúa la venta.
      </p>
      <div>
        <Etiqueta htmlFor="cliente-tipo">Tipo</Etiqueta>
        <select
          id="cliente-tipo"
          className="selector-suitpay mt-1 w-full"
          value={valor.tipoDocumento}
          onChange={(evento) =>
            onCambiar({
              ...valor,
              tipoDocumento: evento.target.value as Cliente['tipoDocumento'],
            })
          }
        >
          <option value="RUC">RUC</option>
          <option value="DNI">DNI</option>
          <option value="CE">CE</option>
          <option value="PAS">PAS</option>
        </select>
      </div>
      <div>
        <Etiqueta htmlFor="cliente-numero">Documento</Etiqueta>
        <Campo
          id="cliente-numero"
          className="mt-1"
          value={valor.numeroDocumento}
          onChange={(evento) =>
            onCambiar({ ...valor, numeroDocumento: evento.target.value })
          }
          autoComplete="off"
        />
      </div>
      <div>
        <Etiqueta htmlFor="cliente-nombre">Razón social / nombres</Etiqueta>
        <Campo
          id="cliente-nombre"
          className="mt-1"
          value={valor.denominacion}
          onChange={(evento) =>
            onCambiar({ ...valor, denominacion: evento.target.value })
          }
          autoComplete="organization"
        />
      </div>
      <div>
        <Etiqueta htmlFor="cliente-direccion">Dirección (opcional)</Etiqueta>
        <Campo
          id="cliente-direccion"
          className="mt-1"
          value={valor.direccion ?? ''}
          onChange={(evento) =>
            onCambiar({
              ...valor,
              direccion: evento.target.value || undefined,
            })
          }
        />
      </div>
    </div>
  )
}
