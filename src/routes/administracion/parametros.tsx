import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  guardarParametrosFn,
  leerParametrosFn,
} from '../../features/parametros/parametros.funciones.ts'
import type { Parametros } from '../../features/parametros/parametros.funciones.ts'
import { GuardaSesion } from '../../features/sesion/GuardaSesion.tsx'
import { formatearImporte } from '../../domain/totales/calculo.ts'
import { Boton, Campo, Etiqueta } from '../../ui/componentes/primitivas.tsx'

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
  const [umbralSoles, setUmbralSoles] = useState('700')
  const [formato, setFormato] = useState<'a4' | 'rollo'>('a4')
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    void (async () => {
      setOcupado(true)
      const respuesta = await leerParametrosFn()
      if (!respuesta.ok || respuesta.parametros === undefined) {
        setError(respuesta.error?.mensaje ?? 'No se leyeron parámetros.')
        setOcupado(false)
        return
      }
      setParametros(respuesta.parametros)
      setUmbralSoles(
        String(respuesta.parametros.umbralIdentificacionBoleta / 100),
      )
      setFormato(respuesta.parametros.formatoImpresionPorDefecto)
      setOcupado(false)
    })()
  }, [])

  async function guardar(evento: FormEvent): Promise<void> {
    evento.preventDefault()
    setOcupado(true)
    setError(null)
    setOk(null)
    const soles = Number(umbralSoles)
    if (!Number.isFinite(soles) || soles <= 0) {
      setError('El umbral debe ser un importe positivo en soles.')
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
        },
      })
      if (!respuesta.ok || respuesta.parametros === undefined) {
        setError(respuesta.error?.mensaje ?? 'No se guardaron.')
        return
      }
      setParametros(respuesta.parametros)
      setOk(
        `Guardado. Umbral: ${formatearImporte(respuesta.parametros.umbralIdentificacionBoleta)}.`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de red.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 px-6 py-8">
      <header>
        <h1 className="text-cabecera font-bold text-tinta">Parámetros</h1>
        <p className="mt-2 text-cuerpo text-desvaida">
          El umbral de identificación es de origen regulatorio: cámbialo aquí
          sin desplegar código.
        </p>
      </header>

      {error !== null && (
        <p className="text-cuerpo font-bold text-aviso" role="alert">
          {error}
        </p>
      )}
      {ok !== null && (
        <p className="text-cuerpo font-bold text-sello" role="status">
          {ok}
        </p>
      )}

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
        <div>
          <Etiqueta htmlFor="formato">Formato de impresión</Etiqueta>
          <select
            id="formato"
            className="min-h-11 w-full rounded-full border border-borde bg-papel px-4"
            value={formato}
            onChange={(e) => setFormato(e.target.value as 'a4' | 'rollo')}
            disabled={ocupado}
          >
            <option value="a4">A4</option>
            <option value="rollo">Rollo</option>
          </select>
        </div>
        <Boton type="submit" variante="principal" disabled={ocupado}>
          Guardar
        </Boton>
      </form>
    </div>
  )
}
