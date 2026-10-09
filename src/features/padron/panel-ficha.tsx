import { useId } from 'react'
import { Loader2 } from 'lucide-react'
import { Boton, Campo, Etiqueta } from '../../ui/componentes/primitivas.tsx'
import type {
  FichaDeCliente,
  FichaDePadron,
  FichaDeTransportista,
  VistaDePadron,
} from './borrador.ts'

/**
 * Ficha fuera de la fila virtualizada. No guarda por su cuenta:
 * los cambios entran en el mismo Guardar de la página.
 */
export function PanelFicha({
  vista,
  numero,
  denominacion,
  ficha,
  cargando,
  error,
  onCerrar,
  onCambiar,
}: {
  readonly vista: VistaDePadron
  readonly numero: string
  readonly denominacion: string
  readonly ficha: FichaDePadron | null
  readonly cargando: boolean
  readonly error: string | null
  readonly onCerrar: () => void
  readonly onCambiar: (ficha: FichaDePadron) => void
}) {
  const base = useId()
  const titulo =
    denominacion.trim() !== ''
      ? denominacion
      : numero.trim() !== ''
        ? numero
        : 'Fila nueva'

  return (
    <aside
      aria-label={`Ficha de ${titulo}`}
      className="rounded-2xl border border-borde bg-mesa p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-etiqueta uppercase text-desvaida">
            {numero.trim() !== '' ? numero : 'Sin documento'}
          </p>
          <p className="truncate text-cuerpo font-bold text-tinta">{titulo}</p>
        </div>
        <Boton variante="discreto" onClick={onCerrar}>
          Cerrar
        </Boton>
      </div>

      {cargando ? (
        <p className="mt-4 flex items-center gap-2 text-cuerpo text-desvaida">
          <Loader2
            className="size-5 animate-spin motion-reduce:animate-none"
            aria-hidden
          />
          Leyendo ficha…
        </p>
      ) : error !== null ? (
        <p className="mt-4 text-cuerpo text-aviso" role="alert">
          {error}
        </p>
      ) : ficha === null ? null : vista === 'clientes' && 'telefono' in ficha ? (
        <CamposDeCliente
          base={base}
          ficha={ficha}
          onCambiar={onCambiar}
        />
      ) : 'numeroRegistroMtc' in ficha ? (
        <CamposDeTransportista
          base={base}
          ficha={ficha}
          onCambiar={onCambiar}
        />
      ) : null}
    </aside>
  )
}

function CamposDeCliente({
  base,
  ficha,
  onCambiar,
}: {
  readonly base: string
  readonly ficha: FichaDeCliente
  readonly onCambiar: (ficha: FichaDePadron) => void
}) {
  return (
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      <CampoDeFicha
        id={`${base}-direccion`}
        etiqueta="Dirección"
        value={ficha.direccion}
        onChange={(valor) => onCambiar({ ...ficha, direccion: valor })}
      />
      <CampoDeFicha
        id={`${base}-telefono`}
        etiqueta="Teléfono"
        value={ficha.telefono}
        onChange={(valor) => onCambiar({ ...ficha, telefono: valor })}
      />
      <CampoDeFicha
        id={`${base}-correo`}
        etiqueta="Correo"
        value={ficha.correo}
        type="email"
        onChange={(valor) => onCambiar({ ...ficha, correo: valor })}
      />
      <CampoDeFicha
        id={`${base}-ubigeo`}
        etiqueta="Ubigeo"
        value={ficha.ubigeo}
        onChange={(valor) => onCambiar({ ...ficha, ubigeo: valor })}
      />
      <CampoDeFicha
        id={`${base}-condicion`}
        etiqueta="Condición"
        value={ficha.condicion}
        onChange={(valor) => onCambiar({ ...ficha, condicion: valor })}
      />
    </div>
  )
}

function CamposDeTransportista({
  base,
  ficha,
  onCambiar,
}: {
  readonly base: string
  readonly ficha: FichaDeTransportista
  readonly onCambiar: (ficha: FichaDePadron) => void
}) {
  return (
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      <CampoDeFicha
        id={`${base}-direccion`}
        etiqueta="Dirección"
        value={ficha.direccion}
        onChange={(valor) => onCambiar({ ...ficha, direccion: valor })}
      />
      <CampoDeFicha
        id={`${base}-mtc`}
        etiqueta="Registro MTC"
        value={ficha.numeroRegistroMtc}
        onChange={(valor) => onCambiar({ ...ficha, numeroRegistroMtc: valor })}
      />
    </div>
  )
}

function CampoDeFicha({
  id,
  etiqueta,
  value,
  type = 'text',
  onChange,
}: {
  readonly id: string
  readonly etiqueta: string
  readonly value: string
  readonly type?: 'text' | 'email'
  readonly onChange: (valor: string) => void
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <Etiqueta htmlFor={id}>{etiqueta}</Etiqueta>
      <Campo
        id={id}
        type={type}
        value={value}
        autoComplete="off"
        onChange={(evento) => onChange(evento.target.value)}
      />
    </div>
  )
}
