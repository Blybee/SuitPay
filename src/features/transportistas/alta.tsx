import { useEffect, useState } from 'react'
import { Modal } from '../../ui/componentes/Modal.tsx'
import { Boton, Campo, Etiqueta } from '../../ui/componentes/primitivas.tsx'
import {
  consultarTransportistaFn,
  crearTransportistaFn,
} from './transportistas.funciones.ts'

/**
 * Alta de transportista con confirmación explícita (principio I / FR-007).
 */
export function AltaTransportista({
  abierta,
  rucInicial,
  onCerrar,
  onCreado,
}: {
  readonly abierta: boolean
  readonly rucInicial: string
  readonly onCerrar: () => void
  readonly onCreado: (denominacion: string, ruc: string) => void
}) {
  const [ruc, setRuc] = useState(rucInicial)
  const [denominacion, setDenominacion] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!abierta) return
    setRuc(rucInicial)
    setDenominacion('')
    setError(null)
    if (/^\d{11}$/.test(rucInicial)) {
      void consultarTransportistaFn({ data: { numeroDocumento: rucInicial } }).then(
        (r) => {
          if (r.ok && r.datos?.denominacion) {
            setDenominacion(r.datos.denominacion)
          }
        },
      )
    }
  }, [abierta, rucInicial])

  async function confirmar(): Promise<void> {
    if (!/^\d{11}$/.test(ruc) || denominacion.trim().length === 0) {
      setError('Indica un RUC de 11 dígitos y la denominación.')
      return
    }
    setOcupado(true)
    setError(null)
    try {
      const respuesta = await crearTransportistaFn({
        data: { numeroDocumento: ruc, denominacion: denominacion.trim() },
      })
      if (!respuesta.ok) {
        setError(respuesta.error?.mensaje ?? 'No se pudo crear.')
        return
      }
      onCreado(respuesta.transportista.denominacion, respuesta.transportista.numeroDocumento)
      onCerrar()
    } finally {
      setOcupado(false)
    }
  }

  return (
    <Modal
      abierta={abierta}
      alCambiar={(ahora) => {
        if (!ahora && !ocupado) onCerrar()
      }}
      titulo="Crear transportista"
      descripcion="Confirma el alta. El comando no crea el maestro por sí solo."
      pie={
        <>
          <Boton disabled={ocupado} onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton
            variante="principal"
            disabled={ocupado}
            onClick={() => void confirmar()}
          >
            {ocupado ? 'Guardando…' : 'Confirmar alta'}
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div>
          <Etiqueta htmlFor="tr-ruc">RUC</Etiqueta>
          <Campo
            id="tr-ruc"
            className="mt-1"
            value={ruc}
            onChange={(e) => setRuc(e.target.value.replace(/\D/g, '').slice(0, 11))}
          />
        </div>
        <div>
          <Etiqueta htmlFor="tr-nombre">Denominación</Etiqueta>
          <Campo
            id="tr-nombre"
            className="mt-1"
            value={denominacion}
            onChange={(e) => setDenominacion(e.target.value)}
          />
        </div>
        {error ? (
          <p className="text-cuerpo font-bold text-aviso" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  )
}
