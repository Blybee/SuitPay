import { useRef, useState } from 'react'
import { Camera, ImagePlus, Loader2, X } from 'lucide-react'
import { Boton } from '../../ui/componentes/primitivas.tsx'
import { usarCatalogo } from '../catalogo/almacen.ts'
import { usarDegradacion } from '../degradacion/estado.ts'
import {
  esFalloDeStorage,
  formatearFalloDeCliente,
  formatearMotivoAsistencia,
} from '../degradacion/motivo-asistencia.ts'
import { usarSesion } from '../sesion/almacen.ts'
import { interpretarCapturaFn } from './captura.funciones.ts'
import {
  esErrorDeLoteDemasiadoGrande,
  MENSAJE_LOTE_DEMASIADO_GRANDE,
} from './errores-inesperados.ts'
import { subirMedioDeCaptura } from './almacenamiento.ts'
import { usarCaptura } from './estado.ts'

const MAX_LADO = 2048
const JPEG_QUALITY = 0.85

async function redimensionarSiHaceFalta(file: Blob): Promise<Blob> {
  if (typeof createImageBitmap === 'undefined') return file
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    // Formato que el navegador no decodifica (HEIC, JPEG raro): se manda el
    // original y decide la asistencia. Antes esto rechazaba fuera del try del
    // llamador y el panel quedaba en «Procesando…» para siempre.
    return file
  }
  const escala = Math.min(1, MAX_LADO / Math.max(bitmap.width, bitmap.height))
  if (escala >= 1 && file.type === 'image/jpeg') {
    bitmap.close()
    return file
  }
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * escala)
  canvas.height = Math.round(bitmap.height * escala)
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    return file
  }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
  )
  return blob ?? file
}

/**
 * Captura / selección de fotografía + subida + interpretación (T131).
 */
export function PanelFotografia({
  termino: _termino,
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
  const inputRef = useRef<HTMLInputElement>(null)
  const [enviando, setEnviando] = useState(false)

  if (!abierto) return null

  async function procesarArchivo(file: File): Promise<void> {
    if (uid === null || indice === null) {
      captura.marcarError('No hay sesión o catálogo para interpretar.')
      return
    }
    setEnviando(true)
    captura.iniciarGrabacion('imagen')
    captura.marcarSubiendo()

    const blob = await redimensionarSiHaceFalta(file)
    const objectUrl = URL.createObjectURL(blob)
    const capturaId = crypto.randomUUID()

    try {
      const { medioUrl, storagePath } = await subirMedioDeCaptura({
        uid,
        capturaId,
        blob,
        tipo: 'imagen',
      })

      captura.marcarProcesando()
      const respuesta = await interpretarCapturaFn({
        data: {
          tipo: 'imagen',
          medioUrl: storagePath,
        },
      })

      if (!respuesta.ok || !respuesta.resultado) {
        const codigo = respuesta.error?.codigo
        if (codigo === 'asistencia_no_disponible') {
          const motivo = formatearMotivoAsistencia(respuesta.error?.detalle)
          console.warn('[SuitPay] foto: asistencia no disponible', respuesta.error?.detalle)
          usarDegradacion.getState().declarar('asistencia', motivo)
          URL.revokeObjectURL(objectUrl)
          captura.cancelar()
          onCerrar()
          return
        }
        if (codigo === 'medio_ilegible') {
          captura.marcarIlegible(
            respuesta.error?.mensaje ?? 'Fotografía ilegible',
            objectUrl,
          )
          return
        }
        captura.marcarError(
          respuesta.error?.mensaje ?? 'No se pudo leer la fotografía.',
        )
        URL.revokeObjectURL(objectUrl)
        return
      }

      usarDegradacion.getState().resolver('asistencia')
      captura.recibirPropuesta({
        capturaId: respuesta.resultado.capturaId,
        medioUrl,
        medioObjectUrl: objectUrl,
        tipo: 'imagen',
        lineas: respuesta.resultado.lineas,
        pasoTextoPrimero: true,
      })
      onCerrar()
    } catch (error) {
      console.error('[SuitPay] foto: fallo inesperado', error)
      if (esErrorDeLoteDemasiadoGrande(error)) {
        captura.marcarError(MENSAJE_LOTE_DEMASIADO_GRANDE)
        URL.revokeObjectURL(objectUrl)
        return
      }
      if (esFalloDeStorage(error)) {
        // No es la asistencia: la foto ni siquiera llegó al servidor.
        captura.marcarError(
          'No se pudo guardar la fotografía. Revisa la conexión y vuelve a intentarlo.',
        )
        URL.revokeObjectURL(objectUrl)
        return
      }
      usarDegradacion
        .getState()
        .declarar('asistencia', formatearFalloDeCliente(error))
      URL.revokeObjectURL(objectUrl)
      captura.cancelar()
      onCerrar()
    } finally {
      setEnviando(false)
    }
  }

  function abandonar(): void {
    captura.cancelar()
    onCerrar()
  }

  const ocupado =
    enviando ||
    captura.fase === 'subiendo' ||
    captura.fase === 'procesando'

  return (
    <div
      className="border-b border-borde bg-mesa px-4 py-3"
      data-testid="panel-fotografia"
      aria-busy={ocupado || undefined}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-cuerpo font-bold text-tinta">
            {ocupado ? (
              <Loader2 className="size-5 animate-spin" aria-hidden />
            ) : null}
            {ocupado ? 'Procesando fotografía…' : 'Fotografiar guía'}
          </p>
          <p className="font-mono text-etiqueta text-desvaida">
            {ocupado
              ? 'Puedes cancelar y seguir escribiendo'
              : 'Cámara o imagen de la galería'}
          </p>
          {captura.fase === 'error' && (
            <p className="mt-1 text-cuerpo text-aviso">{captura.mensajeError}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!ocupado && (
            <>
              <Boton
                variante="secundario"
                data-testid="elegir-foto"
                aria-label="Elegir fotografía"
                onClick={() => inputRef.current?.click()}
              >
                <ImagePlus className="size-5" aria-hidden />
                Galería
              </Boton>
              <Boton variante="principal" asChild>
                <label>
                  <Camera className="size-5" aria-hidden />
                  Cámara
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="sr-only"
                    data-testid="input-camara"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) void procesarArchivo(f)
                    }}
                  />
                </label>
              </Boton>
            </>
          )}
          <Boton
            variante="discreto"
            tamano="icono"
            aria-label="Cancelar fotografía"
            onClick={abandonar}
          >
            <X className="size-5" aria-hidden />
          </Boton>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        data-testid="input-galeria"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void procesarArchivo(f)
        }}
      />
    </div>
  )
}
