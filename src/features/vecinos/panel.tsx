import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Camera, Plus } from 'lucide-react'
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
import { copiarCapturaYAbrirWhatsApp, pintarListaDeVecino } from './captura.ts'
import { ModalDeVecino } from './modal.tsx'
import type { PropuestaCrearVecino } from '../comandos/crear-vecino.ts'
import { usarNotificaciones } from '../notificaciones/almacen.ts'

/**
 * Tab Vecinos: sub-tabs por alias + líneas + total (FR-034, FR-035).
 */
export function PanelDeVecinos({
  activaId,
  onCambiarActiva,
  onConvertir,
  aviso,
  onVolverAlBuscador,
  onCrearDesdeModal,
  creandoVecino,
}: {
  readonly activaId: string | null
  readonly onCambiarActiva: (id: string) => void
  readonly onConvertir: (cotizacion: Cotizacion) => void
  readonly aviso?: string | null
  readonly onVolverAlBuscador?: () => void
  readonly onCrearDesdeModal: (propuesta: PropuestaCrearVecino) => void
  readonly creandoVecino: boolean
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
  const [modalAbierto, setModalAbierto] = useState(false)
  const [capturandoId, setCapturandoId] = useState<string | null>(null)

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

  async function capturarVecino(cotizacion: Cotizacion): Promise<void> {
    if (capturandoId !== null) return
    setCapturandoId(cotizacion.id)
    try {
      const total = calcularTotal(cotizacion.lineas)
      const imagen = await pintarListaDeVecino({
        alias: cotizacion.aliasVecino ?? `H${cotizacion.numero}`,
        lineas: cotizacion.lineas,
        total,
      })
      await copiarCapturaYAbrirWhatsApp({
        imagen,
        telefono: cotizacion.telefonoVecino,
        alias: cotizacion.aliasVecino ?? `H${cotizacion.numero}`,
      })
    } catch (error) {
      console.error('[SuitPay] captura vecino', error)
      usarNotificaciones.getState().mostrar({
        tono: 'error',
        mensaje: 'No se pudo generar la captura.',
      })
    } finally {
      setCapturandoId(null)
    }
  }

  const total = activa !== null ? calcularTotal(activa.lineas) : 0

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
                    'flex size-9 items-center justify-center rounded-full',
                    seleccionada
                      ? 'text-papel hover:bg-papel/15'
                      : 'text-tinta hover:bg-mesa',
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
        <p className="px-4 py-6 text-cuerpo text-desvaida">
          No hay vecinos todavía. Pulsa + o escribe{' '}
          <span className="font-mono text-tinta">
            /crear vecino wilmer 12345678901 987654321
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
      />
    </div>
  )
}
