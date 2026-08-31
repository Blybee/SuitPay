import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Mic, Square, X } from 'lucide-react'
import { horaEnLima } from '../../domain/captura/hora-lima.ts'
import { usarCatalogo } from '../catalogo/almacen.ts'
import { usarDegradacion } from '../degradacion/estado.ts'
import { usarSesion } from '../sesion/almacen.ts'
import { interpretarCapturaFn } from './captura.funciones.ts'
import {
  esErrorDeLoteDemasiadoGrande,
  MENSAJE_LOTE_DEMASIADO_GRANDE,
} from './errores-inesperados.ts'
import { audiosVisibles, usarHistorialDeAudios } from './historial.ts'
import { subirMedioDeCaptura } from './almacenamiento.ts'
import { usarCaptura } from './estado.ts'
import type { ContextoDeAudio, RegistroDeAudio } from '../../infra/local/almacenes.ts'

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
  termino: _termino,
  abierto,
  onCerrar,
  contexto,
  vecinoId,
}: {
  readonly termino: string
  readonly abierto: boolean
  readonly onCerrar: () => void
  readonly contexto: ContextoDeAudio
  readonly vecinoId: string | null
}) {
  const uid = usarSesion((s) => s.uid)
  const indice = usarCatalogo((s) => s.indice)
  const captura = usarCaptura()
  const [durationSec, setDurationSec] = useState(0)
  const [errorLocal, setErrorLocal] = useState<string | null>(null)
  const [listaAbierta, setListaAbierta] = useState(false)
  const entradas = usarHistorialDeAudios((s) => s.entradas)
  const visibles = audiosVisibles({ entradas, contexto, vecinoId })

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!abierto) return
    captura.iniciarGrabacion('audio')
    setListaAbierta(false)
    void usarHistorialDeAudios.getState().cargar()
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

    void usarHistorialDeAudios.getState().registrar({
      id: capturaId,
      grabadoEn: Date.now(),
      contexto,
      vecinoId: contexto === 'vecino' ? vecinoId : null,
      mimeType: blob.type || 'audio/webm',
      blob,
    })

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
      const respuesta = await interpretarCapturaFn({
        data: {
          tipo: 'audio',
          medioUrl: storagePath,
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
          <button
            type="button"
            popoverTarget="lista-audios-hoy"
            popoverTargetAction="toggle"
            aria-label="Audios grabados hoy"
            className="flex min-h-12 items-center gap-1 rounded-full border border-borde px-3 text-tinta"
            onClick={() => {
              if (!('popover' in HTMLElement.prototype)) {
                setListaAbierta((abierta) => !abierta)
              }
            }}
          >
            <ChevronDown className="size-4" aria-hidden />
            <span className="font-mono text-etiqueta">
              {visibles.length}
            </span>
          </button>
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

      <div
        id="lista-audios-hoy"
        popover="auto"
        className="desplegable-audios w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-borde bg-papel p-3 shadow-md"
      >
        <ListaDeReproductores visibles={visibles} />
      </div>
      {listaAbierta ? (
        <div className="mt-3 rounded-2xl border border-borde bg-papel p-3">
          <ListaDeReproductores visibles={visibles} />
        </div>
      ) : null}

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

function ListaDeReproductores({
  visibles,
}: {
  readonly visibles: readonly RegistroDeAudio[]
}) {
  if (visibles.length === 0) {
    return (
      <p className="text-cuerpo text-desvaida">No hay audios de hoy.</p>
    )
  }
  return (
    <ul className="max-h-64 space-y-3 overflow-y-auto">
      {visibles
        .slice()
        .sort((a, b) => b.grabadoEn - a.grabadoEn)
        .map((registro) => (
          <ItemDeAudio key={registro.id} registro={registro} />
        ))}
    </ul>
  )
}

function ItemDeAudio({ registro }: { readonly registro: RegistroDeAudio }) {
  const urlRef = useRef<string | null>(null)
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    const creado = URL.createObjectURL(registro.blob)
    urlRef.current = creado
    setUrl(creado)
    return () => {
      if (urlRef.current !== null) URL.revokeObjectURL(urlRef.current)
    }
  }, [registro.blob])

  return (
    <li className="space-y-1">
      <p className="font-mono text-etiqueta text-desvaida">
        {horaEnLima(new Date(registro.grabadoEn))}
      </p>
      {url !== null ? (
        <audio controls src={url} className="w-full" preload="metadata" />
      ) : null}
    </li>
  )
}
