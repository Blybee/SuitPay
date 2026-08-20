import { PapeletaContexto } from '../../ui/componentes/PapeletaContexto.tsx'
import { Boton, Campo, Etiqueta } from '../../ui/componentes/primitivas.tsx'
import { useState } from 'react'
import type { OperacionDeConsulta } from './catalogo.ts'

/**
 * FR-049: si falta un dato, se pide en la papeleta en lugar de fallar.
 */
export function InstruccionIncompleta({
  abierta,
  operacion,
  faltantes,
  onCompletar,
  onCerrar,
}: {
  readonly abierta: boolean
  readonly operacion: OperacionDeConsulta | null
  readonly faltantes: readonly string[]
  readonly onCompletar: (argumentos: readonly string[]) => void
  readonly onCerrar: () => void
}) {
  const [valor, setValor] = useState('')
  const etiqueta = faltantes[0] ?? 'dato'

  return (
    <PapeletaContexto
      abierta={abierta && operacion !== null}
      alCambiar={(abiertaSiguiente) => {
        if (!abiertaSiguiente) onCerrar()
      }}
      titulo="Falta un dato"
      descripcion={
        operacion === null
          ? undefined
          : `Para ${operacion.prefijo} hace falta ${etiqueta}.`
      }
      pie={
        <>
          <Boton onClick={onCerrar}>Cancelar</Boton>
          <Boton
            variante="principal"
            disabled={valor.trim().length === 0}
            onClick={() => {
              onCompletar([valor.trim()])
              setValor('')
            }}
          >
            Consultar
          </Boton>
        </>
      }
    >
      <label className="flex flex-col gap-1">
        <Etiqueta htmlFor="comando-faltante">{etiqueta}</Etiqueta>
        <Campo
          id="comando-faltante"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && valor.trim().length > 0) {
              e.preventDefault()
              onCompletar([valor.trim()])
              setValor('')
            }
          }}
        />
      </label>
    </PapeletaContexto>
  )
}
