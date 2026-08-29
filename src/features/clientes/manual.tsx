import { Campo, Etiqueta } from '../../ui/componentes/primitivas.tsx'
import { Selector } from '../../ui/componentes/Selector.tsx'
import type { Cliente } from '../../domain/esquemas/comunes.ts'

/**
 * Introducción manual cuando la consulta oficial no responde (FR-026).
 * No bloquea la venta.
 */

export type DatosManualesDeCliente = Pick<
  Cliente,
  'tipoDocumento' | 'numeroDocumento' | 'denominacion' | 'direccion'
>

const TIPOS_MANUALES_POR_DEFECTO: readonly Cliente['tipoDocumento'][] = [
  'RUC',
  'DNI',
  'CE',
  'PAS',
]

export function FormularioManualDeCliente({
  valor,
  onCambiar,
  modo = 'alta',
  documentoBloqueado = false,
  tiposPermitidos = TIPOS_MANUALES_POR_DEFECTO,
}: {
  readonly valor: DatosManualesDeCliente
  readonly onCambiar: (valor: DatosManualesDeCliente) => void
  /** Alta por fallo de padrón vs edición de un cliente ya listado. */
  readonly modo?: 'alta' | 'edicion'
  readonly documentoBloqueado?: boolean
  readonly tiposPermitidos?: readonly Cliente['tipoDocumento'][]
}) {
  const opciones =
    tiposPermitidos.length > 0 ? tiposPermitidos : TIPOS_MANUALES_POR_DEFECTO

  return (
    <div className="flex flex-col gap-3">
      <p className="text-cuerpo text-desvaida">
        {modo === 'edicion'
          ? 'Corrige los datos del cliente. El documento no se puede cambiar.'
          : 'La consulta oficial no responde. Escribe los datos y continúa la venta.'}
      </p>
      <Selector
        id="cliente-tipo"
        etiqueta="Tipo"
        disposicion="columna"
        valor={valor.tipoDocumento}
        disabled={documentoBloqueado || opciones.length === 1}
        onCambiar={(tipoDocumento) =>
          onCambiar({
            ...valor,
            tipoDocumento,
          })
        }
        opciones={opciones.map((tipo) => ({
          valor: tipo,
          etiqueta: tipo,
        }))}
      />
      <div>
        <Etiqueta htmlFor="cliente-numero">Documento</Etiqueta>
        <Campo
          id="cliente-numero"
          className="mt-1"
          value={valor.numeroDocumento}
          disabled={documentoBloqueado}
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
