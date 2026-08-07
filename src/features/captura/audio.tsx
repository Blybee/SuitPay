import { useEffect, useRef, useState } from 'react'
import { Mic, Square, X } from 'lucide-react'
import { usarCatalogo } from '../catalogo/almacen.ts'
import { usarDegradacion } from '../degradacion/estado.ts'
import { usarSesion } from '../sesion/almacen.ts'
import { interpretarCapturaFn } from './captura.funciones.ts'
import {
  esErrorDeLoteDemasiadoGrande,
  MENSAJE_LOTE_DEMASIADO_GRANDE,
} from './errores-inesperados.ts'
import { construirLoteDeCandidatos } from './lote.ts'
import { subirMedioDeCaptura } from './almacenamiento.ts'
import { usarCaptura } from './estado.ts'

function crearCapturaId(): string {
  return crypto.randomUUID()
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/**
 * Grabación de audio + subida + interpretación (T121).
 * Permite abandonar la espera y seguir escribiendo.
 */
export function PanelDictado({
  termino,
  abierto,
  onCerrar,
}: {
  readonly termino: string
  readonly abierto: boolean
  readonly onCerrar: () => void
}) {
  const uid = usarSesion((s) => s.uid)
  const indice = usarCatalogo((s) => s.indice)
  const captura = usarCaptura()
  const [durationSec, setDurationSec] = useState(0)
  const [errorLocal, setErrorLocal] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!abierto) return
    captura.iniciarGrabacion('audio')
    void empezarGrabacion()
    return () => {
      detenerTracks()
      if (timerRef.current) clearInterval(timerRef.current)
    }
    // Solo al abrir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto])

  function detenerTracks(): void {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    mediaRecorderRef.current = null
  }

  async function empezarGrabacion(): Promise<void> {
    setErrorLocal(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mime = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4'
      const recorder = new MediaRecorder(stream, { mimeType: mime })
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      mediaRecorderRef.current = recorder
      recorder.start()
      setDurationSec(0)
      timerRef.current = setInterval(() => {
        setDurationSec((d) => d + 1)
      }, 1000)
    } catch {
      setErrorLocal('No se pudo acceder al micrófono.')
      captura.marcarError('No se pudo acceder al micrófono.')
    }
  }

  async function enviarBlob(blob: Blob): Promise<void> {
    if (uid === null || indice === null) {
      captura.marcarError('No hay sesión o catálogo para interpretar.')
      return
    }

    const capturaId = crearCapturaId()
    const objectUrl = URL.createObjectURL(blob)
    abortRef.current = new AbortController()

    try {
      captura.marcarSubiendo()
      const { medioUrl, storagePath } = await subirMedioDeCaptura({
        uid,
        capturaId,
        blob,
        tipo: 'audio',
      })

      if (abortRef.current.signal.aborted) {
        URL.revokeObjectURL(objectUrl)
        return
      }

      captura.marcarProcesando()
      const candidatos = construirLoteDeCandidatos(indice, termino)
      if (candidatos.length === 0) {
        captura.marcarError('No hay productos en el catálogo para emparejar.')
        URL.revokeObjectURL(objectUrl)
        return
      }

      const respuesta = await interpretarCapturaFn({
        data: {
          tipo: 'audio',
          medioUrl: storagePath,
          candidatos,
        },
      })

      if (abortRef.current.signal.aborted) {
        URL.revokeObjectURL(objectUrl)
        return
      }

      if (!respuesta.ok || !respuesta.resultado) {
        const codigo = respuesta.error?.codigo
        if (codigo === 'asistencia_no_disponible') {
          // Un solo aviso: la banda global. Cierra el panel para no triplicar.
          usarDegradacion.getState().declarar('asistencia')
          URL.revokeObjectURL(objectUrl)
          captura.cancelar()
          onCerrar()
          return
        }
        if (codigo === 'medio_ilegible') {
          captura.marcarIlegible(
            respuesta.error?.mensaje ?? 'Audio ilegible',
            objectUrl,
          )
          return
        }
        captura.marcarError(
          respuesta.error?.mensaje ?? 'No se pudo interpretar el dictado.',
        )
        URL.revokeObjectURL(objectUrl)
        return
      }

      usarDegradacion.getState().resolver('asistencia')
      captura.recibirPropuesta({
        capturaId: respuesta.resultado.capturaId,
        medioUrl,
        medioObjectUrl: objectUrl,
        tipo: 'audio',
        lineas: respuesta.resultado.lineas,
      })
      onCerrar()
    } catch (error) {
      console.error('[SuitPay] dictado: fallo inesperado', error)
      if (!abortRef.current?.signal.aborted) {
        // Errores de validación/RPC no son "asistencia caída": no bloquean el mic.
        if (esErrorDeLoteDemasiadoGrande(error)) {
          captura.marcarError(MENSAJE_LOTE_DEMASIADO_GRANDE)
          URL.revokeObjectURL(objectUrl)
          return
        }
        usarDegradacion.getState().declarar('asistencia')
        URL.revokeObjectURL(objectUrl)
        captura.cancelar()
        onCerrar()
        return
      }
      URL.revokeObjectURL(objectUrl)
    }
  }

  async function detenerYEnviar(): Promise<void> {
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state === 'inactive') return
    if (timerRef.current) clearInterval(timerRef.current)

    const blob = await new Promise<Blob | null>((resolve) => {
      recorder.onstop = () => {
        const mime = recorder.mimeType || 'audio/webm'
        resolve(new Blob(chunksRef.current, { type: mime }))
      }
      recorder.stop()
      detenerTracks()
    })

    if (!blob) {
      captura.marcarError('No se obtuvo audio.')
      return
    }
    await enviarBlob(blob)
  }

  function abandonar(): void {
    abortRef.current?.abort()
    if (timerRef.current) clearInterval(timerRef.current)
    detenerTracks()
    captura.cancelar()
    onCerrar()
  }

  if (!abierto) return null

  const procesando =
    captura.fase === 'subiendo' || captura.fase === 'procesando'
  const grabando = captura.fase === 'grabando'

  return (
    <div
      className="border-b border-borde bg-mesa px-4 py-3"
      data-testid="panel-dictado"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {grabando ? (
            <Mic className="size-6 text-aviso" aria-hidden />
          ) : (
            <Mic className="size-6 text-desvaida" aria-hidden />
          )}
          <div>
            <p className="text-cuerpo font-bold text-tinta">
              {grabando && 'Grabando…'}
              {captura.fase === 'subiendo' && 'Subiendo audio…'}
              {captura.fase === 'procesando' && 'Interpretando dictado…'}
              {captura.fase === 'error' && 'No se pudo dictar'}
            </p>
            <p className="font-mono text-etiqueta text-desvaida">
              {grabando
                ? formatDuration(durationSec)
                : procesando
                  ? 'Puedes cancelar y seguir escribiendo'
                  : errorLocal ?? captura.mensajeError ?? ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {grabando && (
            <button
              type="button"
              data-testid="detener-dictado"
              aria-label="Detener y enviar dictado"
              onClick={() => void detenerYEnviar()}
              className="flex min-h-12 items-center gap-2 rounded-full bg-tinta px-4 text-papel"
            >
              <Square className="size-4 fill-current" aria-hidden />
              Listo
            </button>
          )}
          <button
            type="button"
            data-testid="cancelar-dictado"
            aria-label="Cancelar y seguir escribiendo"
            onClick={abandonar}
            className="flex size-12 items-center justify-center rounded-full border border-borde text-tinta"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
      </div>
      {/* Entrada de archivo para e2e / entornos sin micrófono. */}
      <input
        type="file"
        accept="audio/*,.webm,.mp3,.wav"
        className="sr-only"
        data-testid="input-audio-dictado"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (!f) return
          if (timerRef.current) clearInterval(timerRef.current)
          detenerTracks()
          void enviarBlob(f)
        }}
      />
    </div>
  )
}
