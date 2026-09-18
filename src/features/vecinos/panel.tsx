import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Camera, Eye, EyeClosed, Plus, Trash2 } from 'lucide-react'
import {
  calcularTotal,
  formatearImporte,
} from '../../domain/totales/calculo.ts'
import type { LineaDePedido } from '../../domain/totales/calculo.ts'
import {
  formatearDiaDeDeuda,
  fusionarLineasPorCodigo,
  totalDeGrupos,
  type FechaDeDeudaOrigen,
  type PedidoDeDeuda,
} from '../../domain/vecinos/deudas.ts'
import { CLAVES_DE_CONSULTA } from '../../infra/consultas/cliente.ts'
import { Boton, Casilla } from '../../ui/componentes/primitivas.tsx'
import { EstadoVacio } from '../../ui/componentes/EstadoVacio.tsx'
import {
  CabecerasDeColumna,
  LineaPedido,
} from '../../ui/componentes/LineaPedido.tsx'
import { Modal } from '../../ui/componentes/Modal.tsx'
import { listarCotizacionesPendientes } from '../cotizaciones/leer.ts'
import type { Cotizacion } from '../cotizaciones/tipos.ts'
import { usarCatalogo } from '../catalogo/almacen.ts'
import { mutarLineasDeVecino, asegurarCorteDeDia } from './persistir.ts'
import {
  hayAltaPendiente,
  parcharLineasDeVecinoEnCache,
} from './lineas.ts'
import {
  capturarDeudasDeVecino,
  capturarListaDeProductos,
} from './captura.ts'
import { eliminarDeudaDeDia, listarDeudasDeVecino } from './deudas.ts'
import { ModalDeVecino } from './modal.tsx'
import type { PropuestaCrearVecino } from '../comandos/crear-vecino.ts'
import { mostrarNotificacion } from '../notificaciones/almacen.ts'

export interface OrigenDeConversionDeVecino {
  readonly cotizacion: Cotizacion
  readonly lineas: readonly LineaDePedido[]
  readonly fechasDeuda: readonly FechaDeDeudaOrigen[] | null
}

/**
 * Tab Vecinos: sub-tabs por alias + líneas + deudas (FR-034, FR-035, FR-035g).
 */
export function PanelDeVecinos({
  activaId,
  onCambiarActiva,
  onConvertir,
  aviso,
  onVolverAlBuscador,
  onCrearDesdeModal,
  creandoVecino,
  senalAlta = 0,
}: {
  readonly activaId: string | null
  readonly onCambiarActiva: (id: string) => void
  readonly onConvertir: (origen: OrigenDeConversionDeVecino) => void
  readonly aviso?: string | null
  readonly onVolverAlBuscador?: () => void
  readonly onCrearDesdeModal: (propuesta: PropuestaCrearVecino) => void
  readonly creandoVecino: boolean
  readonly senalAlta?: number
}) {
  const queryClient = useQueryClient()
  const productoPorCodigo = usarCatalogo((s) => s.productoPorCodigo)

  const vecinos = useQuery({
    queryKey: CLAVES_DE_CONSULTA.cotizacionesVecinos,
    queryFn: () => listarCotizacionesPendientes('vecino'),
    staleTime: 15_000,
  })

  const lista = vecinos.data ?? []
  const activa = lista.find((cada) => cada.id === activaId) ?? lista[0] ?? null
  const [modalAbierto, setModalAbierto] = useState(false)
  const [capturandoId, setCapturandoId] = useState<string | null>(null)
  const [vistaDeudas, setVistaDeudas] = useState(false)
  const [fechasMarcadas, setFechasMarcadas] = useState<ReadonlySet<string>>(
    new Set(),
  )
  const [deudaAEliminar, setDeudaAEliminar] = useState<PedidoDeDeuda | null>(
    null,
  )
  const [eliminandoDeuda, setEliminandoDeuda] = useState(false)

  const deudas = useQuery({
    queryKey: CLAVES_DE_CONSULTA.deudasVecino(activa?.id ?? ''),
    queryFn: () => listarDeudasDeVecino(activa!.id),
    enabled: vistaDeudas && activa !== null,
    staleTime: 15_000,
  })

  useEffect(() => {
    if (activa !== null && activa.id !== activaId) {
      onCambiarActiva(activa.id)
    }
  }, [activa, activaId, onCambiarActiva])

  useEffect(() => {
    setVistaDeudas(false)
    setFechasMarcadas(new Set())
  }, [activa?.id])

  useEffect(() => {
    if (senalAlta > 0) {
      setVistaDeudas(false)
      setFechasMarcadas(new Set())
    }
  }, [senalAlta])

  useEffect(() => {
    if (activa === null) return
    void asegurarCorteDeDia(activa.id).then((resultado) => {
      if (resultado.ok && resultado.archivo) {
        void queryClient.invalidateQueries({
          queryKey: CLAVES_DE_CONSULTA.cotizacionesVecinos,
        })
      }
    })
  }, [activa?.id, queryClient])

  useEffect(() => {
    function alVisibilidad(): void {
      if (document.visibilityState !== 'visible' || activa === null) return
      void asegurarCorteDeDia(activa.id).then((resultado) => {
        if (resultado.ok && resultado.archivo) {
          void queryClient.invalidateQueries({
            queryKey: CLAVES_DE_CONSULTA.cotizacionesVecinos,
          })
          void queryClient.invalidateQueries({
            queryKey: CLAVES_DE_CONSULTA.deudasVecino(activa.id),
          })
        }
      })
    }
    document.addEventListener('visibilitychange', alVisibilidad)
    return () => document.removeEventListener('visibilitychange', alVisibilidad)
  }, [activa, queryClient])

  async function refrescar(): Promise<void> {
    await queryClient.invalidateQueries({
      queryKey: CLAVES_DE_CONSULTA.cotizacionesVecinos,
    })
    if (activa !== null) {
      await queryClient.invalidateQueries({
        queryKey: CLAVES_DE_CONSULTA.deudasVecino(activa.id),
      })
    }
  }

  async function aplicarResultadoDeMutacion(
    resultado: Awaited<ReturnType<typeof mutarLineasDeVecino>>,
  ): Promise<void> {
    if (!resultado.ok || activa === null) return
    if (resultado.archivo === true) {
      await refrescar()
      return
    }
    if (
      resultado.lineas !== undefined &&
      resultado.total !== undefined &&
      !hayAltaPendiente(activa.id)
    ) {
      parcharLineasDeVecinoEnCache(
        queryClient,
        activa.id,
        resultado.lineas,
        resultado.total,
      )
      return
    }
    if (!hayAltaPendiente(activa.id)) await refrescar()
  }

  async function cambiarCantidad(
    indice: number,
    cantidad: number,
  ): Promise<void> {
    if (activa === null) return
    const resultado = await mutarLineasDeVecino({
      cotizacionId: activa.id,
      mutar: (lineas) =>
        lineas.map((linea, i) =>
          i === indice ? { ...linea, cantidad } : linea,
        ),
    })
    if (resultado.ok) await aplicarResultadoDeMutacion(resultado)
  }

  async function cambiarPrecio(indice: number, precio: number): Promise<void> {
    if (activa === null) return
    const resultado = await mutarLineasDeVecino({
      cotizacionId: activa.id,
      mutar: (lineas) =>
        lineas.map((linea, i) => (i === indice ? { ...linea, precio } : linea)),
    })
    if (resultado.ok) await aplicarResultadoDeMutacion(resultado)
  }

  async function quitarLinea(indice: number): Promise<void> {
    if (activa === null) return
    const resultado = await mutarLineasDeVecino({
      cotizacionId: activa.id,
      mutar: (lineas) => lineas.filter((_, i) => i !== indice),
    })
    if (resultado.ok) await aplicarResultadoDeMutacion(resultado)
  }

  const listaDeudas = deudas.data ?? []
  const seleccionadas = listaDeudas.filter((cada) =>
    fechasMarcadas.has(cada.fecha),
  )
  const montoDeudas =
    vistaDeudas && fechasMarcadas.size > 0
      ? totalDeGrupos(seleccionadas)
      : vistaDeudas && listaDeudas.length > 0
        ? totalDeGrupos(listaDeudas)
        : (activa?.totalDeudas ?? 0)

  async function capturarVecino(cotizacion: Cotizacion): Promise<void> {
    if (capturandoId !== null) return
    setCapturandoId(cotizacion.id)
    try {
      const esActiva = activa?.id === cotizacion.id
      if (esActiva && vistaDeudas) {
        const gruposFuente =
          fechasMarcadas.size > 0 ? seleccionadas : listaDeudas
        const fusionadas = fechasMarcadas.size > 0
        const lineasFusionadas = fusionadas
          ? fusionarLineasPorCodigo(gruposFuente)
          : []
        await capturarDeudasDeVecino({
          titulo: cotizacion.aliasVecino ?? `H${cotizacion.numero}`,
          telefono: cotizacion.telefonoVecino,
          grupos: gruposFuente.map((cada) => ({
            etiqueta: formatearDiaDeDeuda(cada.fecha),
            lineas: cada.lineas,
          })),
          total: fusionadas
            ? calcularTotal(lineasFusionadas)
            : totalDeGrupos(gruposFuente),
          fusionadas,
          lineasFusionadas,
        })
      } else {
        await capturarListaDeProductos({
          titulo: cotizacion.aliasVecino ?? `H${cotizacion.numero}`,
          lineas: cotizacion.lineas,
          total: calcularTotal(cotizacion.lineas),
          telefono: cotizacion.telefonoVecino,
        })
      }
    } finally {
      setCapturandoId(null)
    }
  }

  async function confirmarEliminarDeuda(): Promise<void> {
    if (activa === null || deudaAEliminar === null) return
    setEliminandoDeuda(true)
    try {
      const resultado = await eliminarDeudaDeDia({
        cotizacionId: activa.id,
        fecha: deudaAEliminar.fecha,
      })
      if (!resultado.ok) {
        mostrarNotificacion({
          tono: 'error',
          mensaje: resultado.mensaje ?? 'No se pudo eliminar esa deuda.',
        })
        return
      }
      setFechasMarcadas((prev) => {
        const siguiente = new Set(prev)
        siguiente.delete(deudaAEliminar.fecha)
        return siguiente
      })
      setDeudaAEliminar(null)
      await refrescar()
    } finally {
      setEliminandoDeuda(false)
    }
  }

  const totalHoy = activa !== null ? calcularTotal(activa.lineas) : 0
  const convertirDeshabilitado = vistaDeudas
    ? fechasMarcadas.size === 0
    : activa === null || activa.lineas.length === 0

  function convertir(): void {
    if (activa === null) return
    if (vistaDeudas) {
      if (seleccionadas.length === 0) return
      onConvertir({
        cotizacion: activa,
        lineas: fusionarLineasPorCodigo(seleccionadas),
        fechasDeuda: seleccionadas.map((cada) => ({
          fecha: cada.fecha,
          generacion: cada.generacion,
        })),
      })
      return
    }
    onConvertir({
      cotizacion: activa,
      lineas: activa.lineas,
      fechasDeuda: null,
    })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        role="tablist"
        aria-label="Vecinos"
        className="flex flex-wrap gap-2 border-b border-borde px-4 pt-3 pb-3"
      >
        {lista.map((cada) => {
          const seleccionada = activa?.id === cada.id
          return (
            <div
              key={cada.id}
              className={[
                'flex items-center gap-1 rounded-full border py-1 pl-2 pr-1',
                seleccionada
                  ? 'border-tinta bg-tinta text-papel'
                  : 'border-borde bg-papel text-tinta',
              ].join(' ')}
            >
              <button
                type="button"
                role="tab"
                aria-selected={seleccionada}
                className={[
                  'rounded-full px-3 py-1 text-cuerpo font-bold',
                  'focus-visible:outline-none focus-visible:border-tinta',
                  seleccionada ? 'text-papel' : 'text-tinta hover:bg-mesa',
                ].join(' ')}
                onClick={() => onCambiarActiva(cada.id)}
              >
                {cada.aliasVecino ?? `H${cada.numero}`}
              </button>
              <button
                type="button"
                aria-label={`Capturar lista de ${cada.aliasVecino ?? cada.numero}`}
                disabled={capturandoId !== null}
                className={[
                  'flex size-9 items-center justify-center rounded-full border',
                  seleccionada
                    ? 'border-papel text-papel hover:bg-papel/15'
                    : 'border-borde text-tinta hover:bg-mesa',
                ].join(' ')}
                onClick={(evento) => {
                  evento.stopPropagation()
                  void capturarVecino(cada)
                }}
              >
                <Camera className="size-4" aria-hidden />
              </button>
            </div>
          )
        })}
        <button
          type="button"
          aria-label="Agregar vecino"
          className="flex size-11 items-center justify-center rounded-full border border-borde bg-papel text-tinta hover:bg-mesa"
          onClick={() => setModalAbierto(true)}
        >
          <Plus className="size-5" aria-hidden />
        </button>
      </div>

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
        <EstadoVacio titulo="No hay vecinos todavía.">
          Pulsa{' '}
          <span
            className="mx-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-borde bg-papel align-text-bottom text-tinta"
            aria-hidden
          >
            <Plus className="size-3.5" />
          </span>{' '}
          o escribe{' '}
          <span className="font-mono text-tinta">
            /crear vecino wilmer 12345678901 987654321
          </span>{' '}
          y confirma la propuesta.
        </EstadoVacio>
      ) : null}

      {activa !== null ? (
        <>
          <div className="flex items-baseline justify-between gap-3 border-b border-borde px-4 py-2">
            <p className="text-cuerpo text-desvaida">
              {activa.cliente?.denominacion ?? 'Sin cliente'} ·{' '}
              <span className="font-mono">#{activa.numero}</span>
            </p>
            <p className="font-mono tabular-nums text-entrada font-bold text-tinta">
              {formatearImporte(totalHoy)}
            </p>
          </div>

          <div className="relative grid min-h-0 flex-1">
            <div
              className={[
                'col-start-1 row-start-1 min-h-0 overflow-y-auto overscroll-contain pb-2 vista-vecino',
                vistaDeudas ? 'pointer-events-none opacity-0' : 'opacity-100',
              ].join(' ')}
              aria-hidden={vistaDeudas}
            >
              {activa.lineas.length === 0 ? (
                <EstadoVacio titulo="No hay productos en la lista.">
                  Búscalos arriba o dicta con el micrófono.
                </EstadoVacio>
              ) : (
                <>
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
                </>
              )}
            </div>

            <div
              className={[
                'col-start-1 row-start-1 min-h-0 overflow-y-auto overscroll-contain pb-2 vista-vecino',
                vistaDeudas ? 'opacity-100' : 'pointer-events-none opacity-0',
              ].join(' ')}
              aria-hidden={!vistaDeudas}
            >
              {deudas.isLoading ? (
                <p className="px-4 py-6 text-cuerpo text-desvaida">Cargando…</p>
              ) : listaDeudas.length === 0 ? (
                <EstadoVacio titulo="No hay deudas.">
                  Los pedidos de días anteriores que no se emitieron aparecen
                  aquí.
                </EstadoVacio>
              ) : (
                <ul className="flex flex-col gap-4 px-2 pt-2 sm:px-3">
                  {listaDeudas.map((deuda) => {
                    const marcada = fechasMarcadas.has(deuda.fecha)
                    return (
                      <li
                        key={deuda.fecha}
                        className="rounded-2xl border border-borde bg-papel"
                      >
                        <div className="flex items-center justify-between gap-3 border-b border-borde px-3 py-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <Casilla
                              checked={marcada}
                              onCheckedChange={(valor) => {
                                setFechasMarcadas((prev) => {
                                  const siguiente = new Set(prev)
                                  if (valor === true) siguiente.add(deuda.fecha)
                                  else siguiente.delete(deuda.fecha)
                                  return siguiente
                                })
                              }}
                              aria-label={`Seleccionar deuda del ${formatearDiaDeDeuda(deuda.fecha)}`}
                            />
                            <p className="text-cuerpo font-bold text-tinta">
                              {formatearDiaDeDeuda(deuda.fecha)}
                            </p>
                            <button
                              type="button"
                              aria-label={`Eliminar deuda del ${formatearDiaDeDeuda(deuda.fecha)}`}
                              className="flex size-9 items-center justify-center rounded-full text-desvaida hover:bg-aviso/15 hover:text-aviso"
                              onClick={() => setDeudaAEliminar(deuda)}
                            >
                              <Trash2 className="size-4" aria-hidden />
                            </button>
                          </div>
                          <p className="font-mono tabular-nums font-bold text-tinta">
                            {formatearImporte(deuda.total)}
                          </p>
                        </div>
                        {deuda.lineas.length === 0 ? (
                          <p className="px-3 py-2 text-cuerpo text-desvaida">
                            Sin productos.
                          </p>
                        ) : (
                          <ul>
                            {deuda.lineas.map((linea, indice) => (
                              <li
                                key={`${linea.codigo}-${indice}`}
                                className="flex items-baseline justify-between gap-3 px-3 py-2 text-cuerpo"
                              >
                                <span className="min-w-0 truncate font-bold text-tinta">
                                  {linea.descripcion}
                                </span>
                                <span className="shrink-0 font-mono tabular-nums text-desvaida">
                                  {linea.cantidad} ·{' '}
                                  {formatearImporte(
                                    linea.precio * linea.cantidad,
                                  )}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-borde bg-papel px-4 py-3">
            <div className="flex items-center gap-1 rounded-full border border-tinta bg-tinta py-1 pl-2 pr-1 text-papel">
              <p className="px-3 py-1 text-cuerpo font-bold">
                Deudas {formatearImporte(montoDeudas)}
              </p>
              <button
                type="button"
                aria-pressed={vistaDeudas}
                aria-label={
                  vistaDeudas
                    ? 'Ver pedido de hoy'
                    : 'Ver deudas'
                }
                className="flex size-9 items-center justify-center rounded-full border border-papel text-papel hover:bg-papel/15"
                onClick={() => setVistaDeudas((actual) => !actual)}
              >
                <span
                  className="t-icon-swap"
                  data-state={vistaDeudas ? 'b' : 'a'}
                >
                  <EyeClosed className="t-icon size-4" data-icon="a" aria-hidden />
                  <Eye className="t-icon size-4" data-icon="b" aria-hidden />
                </span>
              </button>
            </div>
            <Boton
              variante="principal"
              disabled={convertirDeshabilitado}
              onClick={convertir}
            >
              Convertir en documento
            </Boton>
          </div>
        </>
      ) : null}

      <ModalDeVecino
        abierta={modalAbierto}
        onCerrar={() => setModalAbierto(false)}
        vecinos={lista}
        creando={creandoVecino}
        onCrear={(propuesta) => {
          setModalAbierto(false)
          onCrearDesdeModal(propuesta)
        }}
        onRefrescar={() => {
          void refrescar()
        }}
        onEliminado={(id) => {
          queryClient.setQueryData<Cotizacion[]>(
            CLAVES_DE_CONSULTA.cotizacionesVecinos,
            (actual) => (actual ?? []).filter((cada) => cada.id !== id),
          )
        }}
      />

      <Modal
        abierta={deudaAEliminar !== null}
        alCambiar={(abierta) => {
          if (!abierta && !eliminandoDeuda) setDeudaAEliminar(null)
        }}
        titulo="Eliminar deuda"
        descripcion={
          deudaAEliminar !== null
            ? `Se eliminará el pedido del ${formatearDiaDeDeuda(deudaAEliminar.fecha)}. Esta acción no se puede deshacer.`
            : undefined
        }
        pie={
          <div className="flex flex-wrap justify-end gap-2">
            <Boton
              variante="secundario"
              disabled={eliminandoDeuda}
              onClick={() => setDeudaAEliminar(null)}
            >
              Cancelar
            </Boton>
            <Boton
              variante="peligro"
              disabled={eliminandoDeuda}
              onClick={() => void confirmarEliminarDeuda()}
            >
              {eliminandoDeuda ? 'Eliminando…' : 'Confirmar'}
            </Boton>
          </div>
        }
      >
        <p className="text-cuerpo text-tinta">
          {deudaAEliminar !== null
            ? `${deudaAEliminar.lineas.length} productos · ${formatearImporte(deudaAEliminar.total)}`
            : null}
        </p>
      </Modal>
    </div>
  )
}
