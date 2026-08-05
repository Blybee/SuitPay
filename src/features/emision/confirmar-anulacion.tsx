import { useState } from 'react'
import { Modal } from '../../ui/componentes/Modal.tsx'
import { Boton, Campo, Etiqueta } from '../../ui/componentes/primitivas.tsx'
import { anular } from './emitir.funciones.ts'

/**
 * Confirmación de anulación (T105, FR-037): muestra qué documento se anula
 * y exige motivo. Nunca usa la palabra «eliminar».
 */
export function ConfirmarAnulacion({
  abierta,
  onCerrar,
  comprobanteId,
  serie,
  numero,
  tipoNombre,
  onAnulado,
}: {
  readonly abierta: boolean
  readonly onCerrar: () => void
  readonly comprobanteId: string
  readonly serie: string
  readonly numero: number | null
  readonly tipoNombre: string
  readonly onAnulado: () => void
}) {
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const numeracion =
    numero === null ? serie : `${serie}-${String(numero).padStart(8, '0')}`

  async function confirmar(): Promise<void> {
    if (motivo.trim().length < 4) {
      setError('Escribe un motivo con al menos 4 caracteres.')
      return
    }
    setEnviando(true)
    setError(null)
    try {
      const respuesta = await anular({
        data: { comprobanteId, motivo: motivo.trim() },
      })
      if (!respuesta.ok || respuesta.error) {
        setError(
          respuesta.error?.mensaje ?? 'No se pudo anular el comprobante.',
        )
        return
      }
      setMotivo('')
      onAnulado()
      onCerrar()
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal
      abierta={abierta}
      alCambiar={(ahora) => {
        if (!ahora && !enviando) {
          setMotivo('')
          setError(null)
          onCerrar()
        }
      }}
      titulo="Anular comprobante"
      descripcion={`Vas a anular ${tipoNombre} ${numeracion}. Esta operación no se puede deshacer.`}
      noSeCierraSola={enviando}
      pie={
        <>
          <Boton
            variante="discreto"
            disabled={enviando}
            onClick={() => {
              setMotivo('')
              setError(null)
              onCerrar()
            }}
          >
            Cancelar
          </Boton>
          <Boton
            variante="peligro"
            disabled={enviando}
            onClick={() => void confirmar()}
          >
            {enviando ? 'Anulando…' : 'Confirmar anulación'}
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="rounded-2xl border border-borde bg-mesa px-4 py-3 font-mono text-cuerpo text-tinta">
          {tipoNombre} · {numeracion}
        </p>
        <div>
          <Etiqueta htmlFor="motivo-anulacion">Motivo</Etiqueta>
          <Campo
            id="motivo-anulacion"
            className="mt-1"
            value={motivo}
            disabled={enviando}
            onChange={(evento) => setMotivo(evento.target.value)}
            placeholder="Describe por qué se anula…"
            maxLength={300}
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
