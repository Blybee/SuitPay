import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { formatearImporte } from '../../domain/totales/calculo.ts'
import { CLAVES_DE_CONSULTA } from '../../infra/consultas/cliente.ts'
import { Boton, Campo, Etiqueta } from '../../ui/componentes/primitivas.tsx'
import { usarCatalogo } from '../catalogo/almacen.ts'
import { usarPedido } from '../pedido/almacen.ts'
import { diferenciasContraCatalogo } from './diferencias.ts'
import type { DiferenciaDeCotizacion } from './diferencias.ts'
import {
  buscarCotizacionPorNumero,
  listarCotizacionesPendientes,
} from './leer.ts'
import type { Cotizacion } from './tipos.ts'
import { YaConvertida } from './ya-convertida.tsx'

/**
 * Lista y recuperación de cotizaciones (FR-017, FR-018).
 * Montable en el tab del mostrador y en `/cotizaciones`.
 */
export function PanelDeCotizaciones({
  numeroInicial,
  onRecuperada,
}: {
  readonly numeroInicial?: number | null
  readonly onRecuperada?: () => void
}) {
  const queryClient = useQueryClient()
  const catalogo = usarCatalogo()
  const cargarDesdeCotizacion = usarPedido((s) => s.cargarDesdeCotizacion)

  const [consulta, setConsulta] = useState(
    numeroInicial !== null && numeroInicial !== undefined
      ? String(numeroInicial)
      : '',
  )
  const [buscada, setBuscada] = useState<Cotizacion | null>(null)
  const [diferencias, setDiferencias] = useState<
    readonly DiferenciaDeCotizacion[]
  >([])
  const [aviso, setAviso] = useState<string | null>(null)
  const [buscando, setBuscando] = useState(false)

  const pendientes = useQuery({
    queryKey: CLAVES_DE_CONSULTA.cotizacionesPendientes,
    queryFn: () => listarCotizacionesPendientes(),
    staleTime: 30_000,
  })

  const deepLinkHecho = useRef(false)
  useEffect(() => {
    if (
      deepLinkHecho.current ||
      numeroInicial === null ||
      numeroInicial === undefined
    ) {
      return
    }
    deepLinkHecho.current = true
    void recuperarPorNumero(numeroInicial)
  }, [numeroInicial])

  useEffect(() => {
    if (buscada === null || buscada.estado !== 'pendiente') return
    setDiferencias(
      diferenciasContraCatalogo(buscada.lineas, (codigo) =>
        catalogo.productoPorCodigo(codigo),
      ),
    )
  }, [buscada, catalogo.listo, catalogo.version])

  async function recuperarPorNumero(numero: number): Promise<void> {
    setBuscando(true)
    setAviso(null)
    setBuscada(null)
    setDiferencias([])
    try {
      const hallada = await buscarCotizacionPorNumero(numero)
      if (hallada === null) {
        setAviso(`No hay cotización con el número ${numero}.`)
        return
      }
      setBuscada(hallada)
    } finally {
      setBuscando(false)
    }
  }

  function presentar(cotizacion: Cotizacion): void {
    setBuscada(cotizacion)
  }

  function abrirEnPedido(cotizacion: Cotizacion): void {
    if (cotizacion.estado === 'convertida') return
    cargarDesdeCotizacion({
      cotizacionId: cotizacion.id,
      lineas: cotizacion.lineas,
      cliente: cotizacion.cliente,
    })
    void queryClient.invalidateQueries({
      queryKey: CLAVES_DE_CONSULTA.cotizacionesPendientes,
    })
    onRecuperada?.()
  }

  return (
    <div className="flex flex-1 flex-col gap-6 px-6 py-6">
      <header>
        <h2 className="text-cabecera font-bold text-tinta">Cotizaciones</h2>
        <p className="mt-1 text-cuerpo text-desvaida">
          Recupera por número desde cualquier dispositivo. Cualquier vendedor
          autorizado puede abrirla.
        </p>
      </header>

      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(evento) => {
          evento.preventDefault()
          const numero = Number.parseInt(consulta.trim(), 10)
          if (!Number.isFinite(numero) || numero <= 0) {
            setAviso('Escribe un número de cotización válido.')
            return
          }
          void recuperarPorNumero(numero)
        }}
      >
        <div className="min-w-40 flex-1">
          <Etiqueta htmlFor="numero-cotizacion">Número</Etiqueta>
          <Campo
            id="numero-cotizacion"
            inputMode="numeric"
            value={consulta}
            onChange={(evento) => setConsulta(evento.target.value)}
            placeholder="ej. 1042"
            autoComplete="off"
          />
        </div>
        <Boton variante="principal" type="submit" disabled={buscando}>
          {buscando ? 'Buscando…' : 'Recuperar'}
        </Boton>
      </form>

      {aviso !== null ? (
        <p className="text-cuerpo font-bold text-aviso" role="alert">
          {aviso}
        </p>
      ) : null}

      {buscada !== null && buscada.estado === 'convertida' ? (
        <div className="rounded-3xl border border-borde bg-papel p-5 shadow-sm">
          <p className="mb-2 font-mono text-etiqueta uppercase text-desvaida">
            Cotización {buscada.numero}
          </p>
          <YaConvertida comprobanteId={buscada.comprobanteId} />
        </div>
      ) : null}

      {buscada !== null && buscada.estado === 'pendiente' ? (
        <article className="rounded-3xl border border-borde bg-papel p-5 shadow-sm">
          <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-entrada font-bold text-tinta">
              Cotización {buscada.numero}
            </h3>
            <p className="font-mono tabular-nums text-cuerpo font-bold text-tinta">
              {formatearImporte(buscada.total)}
            </p>
          </header>

          {diferencias.length > 0 ? (
            <div
              className="mb-3 rounded-2xl border border-aviso px-3 py-2"
              role="status"
            >
              <p className="text-cuerpo font-bold text-aviso">
                Hay cambios respecto al catálogo actual
              </p>
              <ul className="mt-1 list-disc pl-5 text-cuerpo text-tinta">
                {diferencias.map((cada) => (
                  <li key={`${cada.codigo}-${cada.indice}`}>
                    {cada.clase === 'producto_desaparecido'
                      ? `${cada.descripcion} (${cada.codigo}) ya no está en el catálogo.`
                      : `${cada.descripcion}: precio guardado ${formatearImporte(cada.precioGuardado)}, actual ${formatearImporte(cada.precioActual ?? 0)}.`}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <ul className="mb-4 space-y-1 text-cuerpo text-tinta">
            {buscada.lineas.map((linea, indice) => (
              <li key={`${linea.codigo}-${indice}`}>
                {linea.cantidad} × {linea.descripcion} —{' '}
                {formatearImporte(linea.precio)}
              </li>
            ))}
          </ul>

          <Boton
            variante="principal"
            onClick={() => abrirEnPedido(buscada)}
          >
            Abrir en el pedido
          </Boton>
        </article>
      ) : null}

      <section>
        <h3 className="mb-2 font-mono text-etiqueta uppercase text-desvaida">
          Pendientes recientes
        </h3>
        {pendientes.isLoading ? (
          <p className="text-cuerpo text-desvaida">Cargando…</p>
        ) : null}
        {pendientes.isError ? (
          <p className="text-cuerpo font-bold text-aviso" role="alert">
            No se pudieron cargar las cotizaciones.
          </p>
        ) : null}
        {(pendientes.data?.length ?? 0) === 0 && !pendientes.isLoading ? (
          <p className="text-cuerpo text-desvaida">
            No hay cotizaciones pendientes.
          </p>
        ) : null}
        <ul className="flex flex-col gap-2">
          {(pendientes.data ?? []).map((cada) => (
            <li key={cada.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 rounded-2xl border border-borde bg-papel px-4 py-3 text-left hover:bg-mesa"
                onClick={() => {
                  presentar(cada)
                  setConsulta(String(cada.numero))
                }}
              >
                <span className="font-mono font-bold text-tinta">
                  #{cada.numero}
                </span>
                <span className="truncate text-cuerpo text-desvaida">
                  {cada.cliente?.denominacion ?? 'Sin cliente'} ·{' '}
                  {cada.lineas.length}{' '}
                  {cada.lineas.length === 1 ? 'línea' : 'líneas'}
                </span>
                <span className="shrink-0 font-mono tabular-nums font-bold text-tinta">
                  {formatearImporte(cada.total)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
