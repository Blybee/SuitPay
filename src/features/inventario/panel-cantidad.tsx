import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Boton, Campo, Etiqueta } from '../../ui/componentes/primitivas.tsx'
import {
  escribirInventarioFn,
  leerInventarioFn,
} from './inventario.funciones.ts'
import { vaciarCacheInventario } from './consultar.ts'
import type { Existencia } from '../../domain/inventario/tipos.ts'

/**
 * Popover de cantidad orientativa (fuera de la fila virtualizada).
 * `getDoc` al abrir. Vacío = sin control; escribir un número nace el doc.
 */

export function PanelCantidad({
  codigo,
  descripcion,
  puedeEscribir,
  onCerrar,
  onGuardado,
}: {
  readonly codigo: string
  readonly descripcion: string
  readonly puedeEscribir: boolean
  readonly onCerrar: () => void
  readonly onGuardado?: () => void
}) {
  const [existencia, setExistencia] = useState<Existencia | null | undefined>(
    undefined,
  )
  const [cantidad, setCantidad] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    setExistencia(undefined)
    setError(null)
    void (async () => {
      const respuesta = await leerInventarioFn({ data: { codigo } })
      if (!vivo) return
      if (!respuesta?.ok) {
        setError(respuesta?.error?.mensaje ?? 'No se pudo leer la cantidad.')
        setExistencia(null)
        setCantidad('')
        return
      }
      const leida = respuesta.existencia ?? null
      setExistencia(leida)
      setCantidad(leida === null ? '' : String(leida.cantidad))
    })()
    return () => {
      vivo = false
    }
  }, [codigo])

  async function guardar(): Promise<void> {
    if (!puedeEscribir) return
    const n = Number.parseFloat(cantidad.replace(',', '.'))
    if (!Number.isFinite(n)) {
      setError('Escribe un número. Los negativos se admiten.')
      return
    }
    setGuardando(true)
    setError(null)
    try {
      const respuesta = await escribirInventarioFn({
        data: { codigo, cantidad: n },
      })
      if (!respuesta?.ok || respuesta.existencia == null) {
        setError(respuesta?.error?.mensaje ?? 'No se pudo guardar.')
        return
      }
      setExistencia(respuesta.existencia)
      setCantidad(String(respuesta.existencia.cantidad))
      vaciarCacheInventario()
      onGuardado?.()
    } finally {
      setGuardando(false)
    }
  }

  const cargando = existencia === undefined

  return (
    <aside
      aria-label={`Cantidad orientativa de ${codigo}`}
      className="rounded-2xl border border-borde bg-mesa p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-etiqueta uppercase text-desvaida">
            {codigo}
          </p>
          <p className="truncate text-cuerpo font-bold text-tinta">
            {descripcion}
          </p>
          <p className="mt-1 text-cuerpo text-desvaida">
            Cifra orientativa del almacén. No es el inventario de registro.
          </p>
        </div>
        <Boton variante="discreto" onClick={onCerrar}>
          Cerrar
        </Boton>
      </div>

      {cargando ? (
        <p className="mt-4 flex items-center gap-2 text-cuerpo text-desvaida">
          <Loader2 className="size-5 animate-spin" aria-hidden />
          Leyendo…
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {existencia === null ? (
            <p className="text-cuerpo text-desvaida">
              Sin control de cantidad. Escribe un número para empezar.
            </p>
          ) : existencia.alerta ? (
            <p className="font-mono text-etiqueta font-bold uppercase text-aviso">
              Bajo umbral
            </p>
          ) : null}

          <div className="flex min-w-0 flex-wrap items-end gap-2">
            <div className="flex min-w-40 flex-1 flex-col gap-1">
              <Etiqueta htmlFor="cantidad-orientativa">Cantidad</Etiqueta>
              <Campo
                id="cantidad-orientativa"
                numerico
                inputMode="decimal"
                value={cantidad}
                disabled={!puedeEscribir || guardando}
                onChange={(e) => setCantidad(e.target.value)}
              />
            </div>
            {puedeEscribir ? (
              <Boton
                variante="principal"
                disabled={guardando || cantidad.trim().length === 0}
                aria-busy={guardando || undefined}
                onClick={() => void guardar()}
              >
                {guardando ? (
                  <Loader2 className="size-5 animate-spin" aria-hidden />
                ) : null}
                {guardando ? 'Guardando…' : 'Guardar'}
              </Boton>
            ) : (
              <p className="text-cuerpo text-desvaida">Solo lectura</p>
            )}
          </div>
          {error !== null ? (
            <p className="font-mono text-etiqueta text-aviso" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      )}
    </aside>
  )
}
