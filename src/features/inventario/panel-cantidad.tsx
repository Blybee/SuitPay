import { useEffect, useId, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Boton, Campo, Etiqueta } from '../../ui/componentes/primitivas.tsx'
import {
  escribirInventarioFn,
  leerInventarioFn,
} from './inventario.funciones.ts'
import { vaciarCacheInventario } from './consultar.ts'
import type { Existencia } from '../../domain/inventario/tipos.ts'
import { tieneControlDeCantidad } from '../../domain/inventario/tipos.ts'
import {
  centimosDesdeSoles,
  solesDesdeCentimos,
} from '../../domain/totales/calculo.ts'

/**
 * Panel de cantidad orientativa y precio de compra (fuera de la fila
 * virtualizada). `getDoc` al abrir. Vacío = sin control; escribir un número
 * nace el doc.
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
  const idCantidad = useId()
  const idPrecio = useId()
  const idFecha = useId()
  const [existencia, setExistencia] = useState<Existencia | null | undefined>(
    undefined,
  )
  const [cantidad, setCantidad] = useState('')
  const [precio, setPrecio] = useState('')
  const [fecha, setFecha] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    setExistencia(undefined)
    setError(null)
    void (async () => {
      const respuesta = await leerInventarioFn({ data: { codigo } })
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- `vivo` se apaga en el cleanup.
      if (!vivo) return
      if (!respuesta.ok) {
        setError(respuesta.error?.mensaje ?? 'No se pudo leer la cantidad.')
        setExistencia(null)
        setCantidad('')
        setPrecio('')
        setFecha('')
        return
      }
      const leida = respuesta.existencia ?? null
      setExistencia(leida)
      setCantidad(
        leida !== null && typeof leida.cantidad === 'number'
          ? String(leida.cantidad)
          : '',
      )
      setPrecio(
        leida?.precioCompraCentimos !== undefined
          ? solesDesdeCentimos(leida.precioCompraCentimos).toFixed(2)
          : '',
      )
      setFecha(leida?.precioCompraEn ?? '')
    })()
    return () => {
      vivo = false
    }
  }, [codigo])

  async function guardar(): Promise<void> {
    if (!puedeEscribir) return
    const cantidadTrim = cantidad.trim()
    const precioTrim = precio.trim()
    const nCantidad =
      cantidadTrim === ''
        ? undefined
        : Number.parseFloat(cantidadTrim.replace(',', '.'))
    if (cantidadTrim !== '' && !Number.isFinite(nCantidad)) {
      setError('Escribe un número. Los negativos se admiten.')
      return
    }
    let precioCentimos: number | null | undefined
    if (precioTrim === '') {
      precioCentimos =
        existencia?.precioCompraCentimos !== undefined ? null : undefined
    } else {
      const nPrecio = Number.parseFloat(precioTrim.replace(',', '.'))
      if (!Number.isFinite(nPrecio) || nPrecio < 0) {
        setError('El precio de compra no puede ser negativo.')
        return
      }
      precioCentimos = centimosDesdeSoles(nPrecio)
    }
    if (nCantidad === undefined && precioCentimos === undefined) {
      setError('Escribe una cantidad o un precio de compra.')
      return
    }
    const fechaTrim = fecha.trim()
    setGuardando(true)
    setError(null)
    try {
      const respuesta = await escribirInventarioFn({
        data: {
          codigo,
          ...(nCantidad !== undefined ? { cantidad: nCantidad } : {}),
          ...(precioCentimos !== undefined
            ? { precioCompraCentimos: precioCentimos }
            : {}),
          ...(precioCentimos === null
            ? { precioCompraEn: null }
            : precioCentimos !== undefined
              ? { precioCompraEn: fechaTrim === '' ? null : fechaTrim }
              : {}),
        },
      })
      if (!respuesta.ok || respuesta.existencia == null) {
        setError(respuesta.error?.mensaje ?? 'No se pudo guardar.')
        return
      }
      const guardada = respuesta.existencia
      setExistencia(guardada)
      setCantidad(
        typeof guardada.cantidad === 'number' ? String(guardada.cantidad) : '',
      )
      setPrecio(
        guardada.precioCompraCentimos !== undefined
          ? solesDesdeCentimos(guardada.precioCompraCentimos).toFixed(2)
          : '',
      )
      setFecha(guardada.precioCompraEn ?? '')
      vaciarCacheInventario()
      onGuardado?.()
    } finally {
      setGuardando(false)
    }
  }

  const cargando = existencia === undefined
  const sinCantidad = !tieneControlDeCantidad(existencia ?? null)

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
            Cifra orientativa del almacén y costo de referencia. No es el
            inventario de registro.
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
          {sinCantidad ? (
            <p className="text-cuerpo text-desvaida">
              Sin control de cantidad. Escribe un número para empezar.
            </p>
          ) : existencia?.alerta ? (
            <p className="font-mono text-etiqueta font-bold uppercase text-aviso">
              Bajo umbral
            </p>
          ) : null}

          <div className="flex min-w-0 flex-wrap items-end gap-2">
            <div className="flex min-w-40 flex-1 flex-col gap-1">
              <Etiqueta htmlFor={idCantidad}>Cantidad</Etiqueta>
              <Campo
                id={idCantidad}
                numerico
                inputMode="decimal"
                value={cantidad}
                disabled={!puedeEscribir || guardando}
                onChange={(e) => setCantidad(e.target.value)}
              />
            </div>
            <div className="flex min-w-40 flex-1 flex-col gap-1">
              <Etiqueta htmlFor={idPrecio}>Precio de compra</Etiqueta>
              <Campo
                id={idPrecio}
                numerico
                inputMode="decimal"
                value={precio}
                disabled={!puedeEscribir || guardando}
                onChange={(e) => setPrecio(e.target.value)}
              />
            </div>
            <div className="flex min-w-36 flex-col gap-1">
              <Etiqueta htmlFor={idFecha}>Fecha de factura</Etiqueta>
              <Campo
                id={idFecha}
                type="date"
                value={fecha}
                disabled={!puedeEscribir || guardando || precio.trim() === ''}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>
            {puedeEscribir ? (
              <Boton
                variante="principal"
                disabled={
                  guardando ||
                  (cantidad.trim().length === 0 && precio.trim().length === 0 &&
                    existencia?.precioCompraCentimos === undefined)
                }
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
