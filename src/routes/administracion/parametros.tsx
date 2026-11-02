import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { CabeceraAdmin } from '../../features/administracion/cabecera-admin.tsx'
import { PanelDiagnosticoAsistencia } from '../../features/asistencia/panel-diagnostico.tsx'
import { usarNotificaciones } from '../../features/notificaciones/almacen.ts'
import {
  guardarParametrosFn,
  leerParametrosFn,
} from '../../features/parametros/parametros.funciones.ts'
import type {
  ModelosVisibles,
  Parametros,
} from '../../features/parametros/parametros.funciones.ts'
import { GuardaSesion } from '../../features/sesion/GuardaSesion.tsx'
import { formatearImporte } from '../../domain/totales/calculo.ts'
import { Boton, Campo, Etiqueta } from '../../ui/componentes/primitivas.tsx'
import { Selector } from '../../ui/componentes/Selector.tsx'

/**
 * Parámetros del sistema (T085): umbral, ventana de anulación, formato.
 */

export const Route = createFileRoute('/administracion/parametros')({
  component: () => (
    <GuardaSesion roles={['administrador']}>
      <PantallaDeParametros />
    </GuardaSesion>
  ),
})

function PantallaDeParametros() {
  const [parametros, setParametros] = useState<Parametros | null>(null)
  const [modelos, setModelos] = useState<ModelosVisibles | null>(null)
  const [umbralSoles, setUmbralSoles] = useState('700')
  const [formato, setFormato] = useState<'a4' | 'rollo'>('a4')
  const [iaTexto, setIaTexto] = useState<'openrouter' | 'gemini'>('openrouter')
  const [iaImagen, setIaImagen] = useState<'openrouter' | 'gemini'>('gemini')
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    void (async () => {
      setOcupado(true)
      const respuesta = await leerParametrosFn()
      if (!respuesta.ok || respuesta.parametros === undefined) {
        usarNotificaciones.getState().mostrar({
          tono: 'error',
          mensaje: respuesta.error?.mensaje ?? 'No se leyeron parámetros.',
        })
        setOcupado(false)
        return
      }
      setParametros(respuesta.parametros)
      setModelos(respuesta.modelos ?? null)
      setUmbralSoles(
        String(respuesta.parametros.umbralIdentificacionBoleta / 100),
      )
      setFormato(respuesta.parametros.formatoImpresionPorDefecto)
      setIaTexto(respuesta.parametros.iaTexto)
      setIaImagen(respuesta.parametros.iaImagen)
      setOcupado(false)
    })()
  }, [])

  async function guardar(evento: FormEvent): Promise<void> {
    evento.preventDefault()
    setOcupado(true)
    const soles = Number(umbralSoles)
    if (!Number.isFinite(soles) || soles <= 0) {
      usarNotificaciones.getState().mostrar({
        tono: 'error',
        mensaje: 'El umbral debe ser un importe positivo en soles.',
      })
      setOcupado(false)
      return
    }
    const centimos = Math.round(soles * 100)
    try {
      const respuesta = await guardarParametrosFn({
        data: {
          umbralIdentificacionBoleta: centimos,
          ventanaAnulacion: 'mismo_dia',
          formatoImpresionPorDefecto: formato,
          iaTexto,
          iaImagen,
        },
      })
      if (!respuesta.ok || respuesta.parametros === undefined) {
        usarNotificaciones.getState().mostrar({
          tono: 'error',
          mensaje: respuesta.error?.mensaje ?? 'No se guardaron.',
        })
        return
      }
      setParametros(respuesta.parametros)
      usarNotificaciones.getState().mostrar({
        tono: 'exito',
        mensaje: `Guardado. Umbral: ${formatearImporte(respuesta.parametros.umbralIdentificacionBoleta)}.`,
      })
    } catch (err) {
      usarNotificaciones.getState().mostrar({
        tono: 'error',
        mensaje: err instanceof Error ? err.message : 'Error de red.',
      })
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 px-6 py-8">
      <CabeceraAdmin
        titulo="Parámetros"
        descripcion="El umbral de identificación es de origen regulatorio: cámbialo aquí sin desplegar código."
      />

      <form
        onSubmit={guardar}
        className="flex flex-col gap-4 rounded-3xl border border-borde bg-papel p-6"
      >
        <div>
          <Etiqueta htmlFor="umbral">
            Umbral identificación boleta (soles)
          </Etiqueta>
          <Campo
            id="umbral"
            type="number"
            min={1}
            step="0.01"
            required
            numerico
            value={umbralSoles}
            onChange={(e) => setUmbralSoles(e.target.value)}
            disabled={ocupado}
          />
          {parametros !== null && (
            <p className="mt-1 font-mono text-etiqueta text-desvaida">
              Vigente: {formatearImporte(parametros.umbralIdentificacionBoleta)}
            </p>
          )}
        </div>
        <div>
          <Etiqueta htmlFor="ventana">Ventana de anulación</Etiqueta>
          <Campo id="ventana" value="mismo_dia" disabled readOnly />
        </div>
        <Selector
          id="formato"
          etiqueta="Formato de impresión"
          disposicion="columna"
          valor={formato}
          onCambiar={setFormato}
          disabled={ocupado}
          opciones={[
            { valor: 'a4', etiqueta: 'A4' },
            { valor: 'rollo', etiqueta: 'Rollo' },
          ]}
        />
        <fieldset className="flex flex-col gap-4 border-t border-borde pt-4">
          <legend className="text-cuerpo font-bold text-tinta">
            Inteligencia artificial
          </legend>
          <p className="text-cuerpo text-desvaida">
            Solo un administrador cambia estos interruptores. Audio, PDF y
            Compras siguen en Gemini.
          </p>
          <Interruptor
            id="ia-texto"
            etiqueta="Tareas de solo texto"
            activo={iaTexto === 'openrouter'}
            proveedor={iaTexto === 'openrouter' ? 'OpenRouter' : 'Gemini'}
            disabled={ocupado}
            onCambiar={(activo) =>
              setIaTexto(activo ? 'openrouter' : 'gemini')
            }
          />
          <Interruptor
            id="ia-imagen"
            etiqueta="Tareas con imagen"
            activo={iaImagen === 'openrouter'}
            proveedor={iaImagen === 'openrouter' ? 'OpenRouter' : 'Gemini'}
            disabled={ocupado}
            onCambiar={(activo) =>
              setIaImagen(activo ? 'openrouter' : 'gemini')
            }
          />
          {modelos !== null && (
            <ul className="flex flex-col gap-1 font-mono text-etiqueta text-desvaida">
              <li>OpenRouter texto: {modelos.openrouterTexto}</li>
              <li>OpenRouter imagen: {modelos.openrouterImagen}</li>
              <li>Gemini principal: {modelos.geminiPrincipal}</li>
              <li>Gemini respaldo: {modelos.geminiRespaldo}</li>
            </ul>
          )}
        </fieldset>
        <Boton type="submit" variante="principal" disabled={ocupado} aria-busy={ocupado}>
          Guardar
        </Boton>
      </form>

      <PanelDiagnosticoAsistencia />
    </div>
  )
}

function Interruptor({
  id,
  etiqueta,
  activo,
  proveedor,
  disabled,
  onCambiar,
}: {
  readonly id: string
  readonly etiqueta: string
  readonly activo: boolean
  readonly proveedor: string
  readonly disabled: boolean
  readonly onCambiar: (activo: boolean) => void
}) {
  const etiquetaId = `${id}-etiqueta`
  return (
    <div className="flex min-h-11 items-center justify-between gap-4">
      <div>
        <p id={etiquetaId} className="text-cuerpo font-bold text-tinta">
          {etiqueta}
        </p>
        <p className="font-mono text-etiqueta text-desvaida">{proveedor}</p>
      </div>
      <span className="relative inline-flex h-11 w-14 shrink-0 items-center">
        <input
          id={id}
          type="checkbox"
          role="switch"
          aria-checked={activo}
          aria-labelledby={etiquetaId}
          checked={activo}
          disabled={disabled}
          onChange={(evento) => onCambiar(evento.target.checked)}
          className="peer absolute inset-0 z-10 m-0 h-full w-full cursor-pointer appearance-none rounded-full border border-borde bg-mesa transition-[background-color] duration-rapida ease-salida checked:border-tinta checked:bg-tinta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tinta/20 disabled:cursor-not-allowed motion-reduce:transition-none"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute left-1 size-6 rounded-full bg-papel shadow-sm transition-transform duration-rapida ease-salida peer-checked:translate-x-6 motion-reduce:transition-none"
        />
      </span>
    </div>
  )
}
