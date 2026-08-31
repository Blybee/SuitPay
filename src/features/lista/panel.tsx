import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import { FileDown, Share2, X } from 'lucide-react'
import {
  alternarUrgencia,
  etiquetaDeUrgencia,
} from '../../domain/lista/urgencia.ts'
import { bytesDePdfDeRequerimiento } from '../../domain/lista/pdf.ts'
import {
  diaPorDefecto,
  semanaLaboralEnLima,
} from '../../domain/lista/semana.ts'
import type { LineaDeRequerimiento } from '../../domain/lista/tipos.ts'
import { usarNotificaciones } from '../notificaciones/almacen.ts'
import { usarSesion } from '../sesion/almacen.ts'
import { CLAVES_DE_CONSULTA } from '../../infra/consultas/cliente.ts'
import { Boton } from '../../ui/componentes/primitivas.tsx'
import { usarDiaLista } from './dia-activo.ts'
import {
  actualizarCantidadDeLista,
  actualizarUrgenciaDeLista,
  leerListaDeRequerimiento,
  quitarDeLista,
} from './persistir.ts'

function blobDePdf(bytes: Uint8Array): Blob {
  const copia = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(copia).set(bytes)
  return new Blob([copia], { type: 'application/pdf' })
}

async function descargarPdf(
  lineas: readonly LineaDeRequerimiento[],
): Promise<void> {
  const blob = blobDePdf(bytesDePdfDeRequerimiento(lineas, new Date()))
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = 'lista-requerimiento.pdf'
  enlace.rel = 'noopener noreferrer'
  enlace.click()
  URL.revokeObjectURL(url)
}

async function compartirPdfPorWhatsApp(
  lineas: readonly LineaDeRequerimiento[],
): Promise<void> {
  const blob = blobDePdf(bytesDePdfDeRequerimiento(lineas, new Date()))
  const archivo = new File([blob], 'lista-requerimiento.pdf', {
    type: 'application/pdf',
  })
  const puedeCompartir =
    typeof navigator !== 'undefined' &&
    'share' in navigator &&
    (typeof navigator.canShare !== 'function' ||
      navigator.canShare({ files: [archivo] }))

  if (puedeCompartir) {
    try {
      await navigator.share({
        title: 'Lista de requerimiento',
        files: [archivo],
      })
      return
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return
    }
  }

  await descargarPdf(lineas)
  usarNotificaciones.getState().mostrar({
    tono: 'info',
    mensaje:
      'PDF descargado. Adjúntalo en WhatsApp: el navegador no pudo abrir la hoja de compartir.',
  })
}

/**
 * Tab Lista: lista de requerimiento (N° | Producto | Cantidad | Urgencia).
 * No es el catálogo ni el pedido. Un documento por día laboral (lun–sáb,
 * semana actual en Lima); cada día se lee bajo demanda al pulsar su pill.
 */
export function PanelDeListaRequerimiento() {
  const uid = usarSesion((s) => s.uid)
  const queryClient = useQueryClient()

  const semana = useMemo(() => semanaLaboralEnLima(), [])
  const fechaEnStore = usarDiaLista((s) => s.fecha)
  const fijarDia = usarDiaLista((s) => s.fijar)
  const fechaActiva = fechaEnStore ?? diaPorDefecto(semana)

  useEffect(() => {
    if (fechaEnStore === null) fijarDia(diaPorDefecto(semana))
  }, [fechaEnStore, fijarDia, semana])

  const consulta = useQuery({
    queryKey: CLAVES_DE_CONSULTA.listaRequerimiento(uid ?? '', fechaActiva),
    queryFn: () => leerListaDeRequerimiento(uid ?? '', fechaActiva),
    enabled: uid !== null,
    staleTime: 15_000,
  })

  const lineas = consulta.data ?? []

  async function refrescar(): Promise<void> {
    await queryClient.invalidateQueries({
      queryKey: CLAVES_DE_CONSULTA.listaRequerimiento(uid ?? '', fechaActiva),
    })
  }

  async function conResultado(
    trabajo: () => Promise<{ ok: boolean; mensaje?: string }>,
  ): Promise<void> {
    const resultado = await trabajo()
    if (!resultado.ok) {
      usarNotificaciones.getState().mostrar({
        tono: 'error',
        mensaje: resultado.mensaje ?? 'No se pudo actualizar la lista.',
      })
      return
    }
    await refrescar()
  }

  if (uid === null) return null

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-borde px-4 py-3">
        <div
          role="tablist"
          aria-label="Día de la lista de requerimiento"
          className="flex flex-wrap gap-1.5"
        >
          {semana.map((dia) => {
            const seleccionado = dia.fecha === fechaActiva
            return (
              <button
                key={dia.fecha}
                type="button"
                role="tab"
                aria-selected={seleccionado}
                aria-label={`${dia.etiqueta} ${dia.corta}`}
                onClick={() => fijarDia(dia.fecha)}
                className={[
                  'min-h-9 rounded-full border px-3 font-mono text-etiqueta font-bold uppercase transition-colors',
                  seleccionado
                    ? 'border-tinta bg-tinta text-papel'
                    : 'border-borde bg-papel text-desvaida hover:text-tinta',
                ].join(' ')}
              >
                <span className="sm:hidden">{dia.corta}</span>
                <span className="hidden sm:inline">{dia.etiqueta}</span>
              </button>
            )
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          <Boton
            variante="secundario"
            disabled={lineas.length === 0}
            onClick={() => void descargarPdf(lineas)}
          >
            <FileDown className="size-4" aria-hidden />
            Exportar PDF
          </Boton>
          <Boton
            variante="principal"
            disabled={lineas.length === 0}
            onClick={() => void compartirPdfPorWhatsApp(lineas)}
          >
            <Share2 className="size-4" aria-hidden />
            WhatsApp
          </Boton>
        </div>
      </div>

      {consulta.isLoading ? (
        <p className="px-4 py-6 text-cuerpo text-desvaida">Cargando…</p>
      ) : null}

      {!consulta.isLoading && lineas.length === 0 ? (
        <p className="px-4 py-8 text-cuerpo text-desvaida" role="status">
          No hay productos en la lista. Búscalos arriba o dicta con el
          micrófono.
        </p>
      ) : null}

      {lineas.length > 0 ? (
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 bg-papel">
              <tr className="border-b border-borde">
                <th className="px-4 py-2 font-mono text-etiqueta uppercase text-desvaida">
                  N°
                </th>
                <th className="px-4 py-2 font-mono text-etiqueta uppercase text-desvaida">
                  Producto
                </th>
                <th className="px-4 py-2 font-mono text-etiqueta uppercase text-desvaida">
                  Cantidad
                </th>
                <th className="px-4 py-2 font-mono text-etiqueta uppercase text-desvaida">
                  Urgencia
                </th>
                <th className="w-12 px-2 py-2">
                  <span className="sr-only">Quitar</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {lineas.map((linea, indice) => (
                <tr key={linea.id} className="border-b border-borde">
                  <td className="px-4 py-3 font-mono tabular-nums text-desvaida">
                    {indice + 1}
                  </td>
                  <td className="px-4 py-3 font-bold uppercase text-tinta">
                    {linea.descripcion}
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min={1}
                      step="any"
                      aria-label={`Cantidad de ${linea.descripcion}`}
                      defaultValue={linea.cantidad}
                      key={`${linea.id}-${linea.cantidad}`}
                      onBlur={(evento) => {
                        const cantidad = Number(evento.target.value)
                        if (cantidad === linea.cantidad) return
                        void conResultado(() =>
                          actualizarCantidadDeLista({
                            uid,
                            fecha: fechaActiva,
                            id: linea.id,
                            cantidad,
                          }),
                        )
                      }}
                      className="min-h-11 w-20 rounded-full border border-borde bg-papel px-3 font-mono tabular-nums text-tinta focus-visible:border-tinta focus-visible:outline-none"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label={`Urgencia: ${etiquetaDeUrgencia(linea.urgencia)}. Clic para cambiar.`}
                      onClick={() => {
                        void conResultado(() =>
                          actualizarUrgenciaDeLista({
                            uid,
                            fecha: fechaActiva,
                            id: linea.id,
                            urgencia: alternarUrgencia(linea.urgencia),
                          }),
                        )
                      }}
                      onKeyDown={(evento) => {
                        if (evento.key !== 'Enter' && evento.key !== ' ') return
                        evento.preventDefault()
                        void conResultado(() =>
                          actualizarUrgenciaDeLista({
                            uid,
                            fecha: fechaActiva,
                            id: linea.id,
                            urgencia: alternarUrgencia(linea.urgencia),
                          }),
                        )
                      }}
                      className={
                        linea.urgencia === 'urgente'
                          ? 'cursor-pointer rounded-full border border-aviso px-3 py-1 font-mono text-etiqueta font-bold uppercase text-aviso'
                          : 'cursor-pointer rounded-full border border-borde px-3 py-1 font-mono text-etiqueta font-bold uppercase text-desvaida'
                      }
                    >
                      {etiquetaDeUrgencia(linea.urgencia)}
                    </span>
                  </td>
                  <td className="px-2 py-3">
                    <button
                      type="button"
                      aria-label={`Quitar ${linea.descripcion}`}
                      onClick={() => {
                        void conResultado(() =>
                          quitarDeLista({
                            uid,
                            fecha: fechaActiva,
                            id: linea.id,
                          }),
                        )
                      }}
                      className="flex size-11 items-center justify-center rounded-full text-desvaida hover:bg-mesa hover:text-aviso"
                    >
                      <X className="size-4" aria-hidden />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}
