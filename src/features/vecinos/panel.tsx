import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { calcularTotal, formatearImporte } from '../../domain/totales/calculo.ts'
import { CLAVES_DE_CONSULTA } from '../../infra/consultas/cliente.ts'
import { Boton } from '../../ui/componentes/primitivas.tsx'
import {
  CabecerasDeColumna,
  LineaPedido,
} from '../../ui/componentes/LineaPedido.tsx'
import { listarCotizacionesPendientes } from '../cotizaciones/leer.ts'
import type { Cotizacion } from '../cotizaciones/tipos.ts'
import { usarCatalogo } from '../catalogo/almacen.ts'
import { persistirLineasDeVecino } from './persistir.ts'

/**
 * Tab Vecinos: sub-tabs por alias + líneas + total (FR-034, FR-035).
 */
export function PanelDeVecinos({
  activaId,
  onCambiarActiva,
  onConvertir,
  aviso,
  onVolverAlBuscador,
}: {
  readonly activaId: string | null
  readonly onCambiarActiva: (id: string) => void
  readonly onConvertir: (cotizacion: Cotizacion) => void
  readonly aviso?: string | null
  readonly onVolverAlBuscador?: () => void
}) {
  const queryClient = useQueryClient()
  const productoPorCodigo = usarCatalogo((s) => s.productoPorCodigo)

  const vecinos = useQuery({
    queryKey: CLAVES_DE_CONSULTA.cotizacionesVecinos,
    queryFn: () => listarCotizacionesPendientes('vecino'),
    staleTime: 15_000,
  })

  const lista = vecinos.data ?? []
  const activa =
    lista.find((cada) => cada.id === activaId) ?? lista[0] ?? null

  useEffect(() => {
    if (activa !== null && activa.id !== activaId) {
      onCambiarActiva(activa.id)
    }
  }, [activa, activaId, onCambiarActiva])

  async function refrescar(): Promise<void> {
    await queryClient.invalidateQueries({
      queryKey: CLAVES_DE_CONSULTA.cotizacionesVecinos,
    })
  }

  async function cambiarCantidad(
    indice: number,
    cantidad: number,
  ): Promise<void> {
    if (activa === null) return
    const lineas = activa.lineas.map((linea, i) =>
      i === indice ? { ...linea, cantidad } : linea,
    )
    const resultado = await persistirLineasDeVecino({
      cotizacionId: activa.id,
      lineas,
    })
    if (resultado.ok) await refrescar()
  }

  async function cambiarPrecio(indice: number, precio: number): Promise<void> {
    if (activa === null) return
    const lineas = activa.lineas.map((linea, i) =>
      i === indice ? { ...linea, precio } : linea,
    )
    const resultado = await persistirLineasDeVecino({
      cotizacionId: activa.id,
      lineas,
    })
    if (resultado.ok) await refrescar()
  }

  async function quitarLinea(indice: number): Promise<void> {
    if (activa === null) return
    const lineas = activa.lineas.filter((_, i) => i !== indice)
    const resultado = await persistirLineasDeVecino({
      cotizacionId: activa.id,
      lineas,
    })
    if (resultado.ok) await refrescar()
  }

  const total = activa !== null ? calcularTotal(activa.lineas) : 0

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {lista.length > 0 ? (
        <div
          role="tablist"
          aria-label="Vecinos"
          className="flex flex-wrap gap-2 border-b border-borde px-4 pt-3 pb-3"
        >
          {lista.map((cada) => {
            const seleccionada = activa?.id === cada.id
            return (
              <button
                key={cada.id}
                type="button"
                role="tab"
                aria-selected={seleccionada}
                className={[
                  'rounded-full px-4 py-2 text-cuerpo font-bold',
                  'border focus-visible:outline-none focus-visible:border-tinta',
                  seleccionada
                    ? 'border-tinta bg-tinta text-papel'
                    : 'border-borde bg-papel text-tinta hover:bg-mesa',
                ].join(' ')}
                onClick={() => onCambiarActiva(cada.id)}
              >
                {cada.aliasVecino ?? `H${cada.numero}`}
              </button>
            )
          })}
        </div>
      ) : null}

      {aviso !== null && aviso !== undefined && aviso !== '' ? (
        <p
          role="status"
          className="border-b border-borde px-4 py-2 text-cuerpo font-bold text-tinta"
        >
          {aviso}
        </p>
      ) : null}

      {vecinos.isLoading ? (
        <p className="px-4 py-6 text-cuerpo text-desvaida">Cargando…</p>
      ) : null}

      {!vecinos.isLoading && lista.length === 0 ? (
        <p className="px-4 py-6 text-cuerpo text-desvaida">
          No hay vecinos todavía. Escribe en el buscador{' '}
          <span className="font-mono text-tinta">
            /crear vecino wilmer 12345678901
          </span>{' '}
          y confirma la propuesta.
        </p>
      ) : null}

      {activa !== null ? (
        <>
          <div className="flex items-baseline justify-between gap-3 border-b border-borde px-4 py-2">
            <p className="text-cuerpo text-desvaida">
              {activa.cliente?.denominacion ?? 'Sin cliente'} ·{' '}
              <span className="font-mono">#{activa.numero}</span>
            </p>
            <p className="font-mono tabular-nums text-entrada font-bold text-tinta">
              {formatearImporte(total)}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto pb-2">
            <CabecerasDeColumna numeroDeLineas={activa.lineas.length} />
            <ul>
              {activa.lineas.map((linea, indice) => (
                <LineaPedido
                  key={`${linea.codigo}-${indice}`}
                  linea={linea}
                  indice={indice}
                  precioDeCatalogo={productoPorCodigo(linea.codigo)?.precio}
                  onCambiarCantidad={(cantidad) => {
                    void cambiarCantidad(indice, cantidad)
                  }}
                  onCambiarPrecio={(precio) => {
                    void cambiarPrecio(indice, precio)
                  }}
                  onQuitar={() => {
                    void quitarLinea(indice)
                  }}
                  onVolverAlBuscador={onVolverAlBuscador}
                />
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-borde bg-papel px-4 py-3">
            <p className="font-mono tabular-nums text-cabecera font-bold text-tinta">
              {formatearImporte(total)}
            </p>
            <Boton
              variante="principal"
              disabled={activa.lineas.length === 0}
              onClick={() => onConvertir(activa)}
            >
              Convertir en documento
            </Boton>
          </div>
        </>
      ) : null}
    </div>
  )
}
