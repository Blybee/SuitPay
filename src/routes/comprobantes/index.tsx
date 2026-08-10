import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { ListRestart } from 'lucide-react'
import { useEffect, useState } from 'react'
import { REGLAS } from '../../domain/documentos/tipos.ts'
import type { TipoDeDocumento } from '../../domain/documentos/tipos.ts'
import { formatearImporte } from '../../domain/totales/calculo.ts'
import { listarComprobantes } from '../../features/emision/emitir.funciones.ts'
import type { Comprobante } from '../../features/emision/emitir.funciones.ts'
import { usarNotificaciones } from '../../features/notificaciones/almacen.ts'
import { usarPedido } from '../../features/pedido/almacen.ts'
import {
  confirmarYPrepararReutilizacion,
  etiquetaDeComprobante,
} from '../../features/pedido/reutilizar-desde-comprobante.ts'
import { GuardaSesion } from '../../features/sesion/GuardaSesion.tsx'
import { MarcaDeEstado } from '../../ui/componentes/Sello.tsx'
import { Boton } from '../../ui/componentes/primitivas.tsx'

/**
 * Consulta de comprobantes con paginación por cursor (T103).
 * Acción rápida «Reutilizar pedido» en cada fila (FR-056).
 */
export const Route = createFileRoute('/comprobantes/')({
  component: ListaConGuarda,
})

function ListaConGuarda() {
  return (
    <GuardaSesion>
      <ListaDeComprobantes />
    </GuardaSesion>
  )
}

function ListaDeComprobantes() {
  const navigate = useNavigate()
  const cargarDesdeComprobante = usarPedido((s) => s.cargarDesdeComprobante)
  const lineasEnCurso = usarPedido((s) => s.lineas.length)
  const mostrar = usarNotificaciones((s) => s.mostrar)
  const [items, setItems] = useState<readonly Comprobante[]>([])
  const [hayMas, setHayMas] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function cargar(cursorId?: string, acumular = false): Promise<void> {
    setCargando(true)
    setError(null)
    try {
      const respuesta = await listarComprobantes({
        data: { limite: 20, cursorId },
      })
      if (!respuesta.ok || respuesta.items === undefined) {
        setError(
          respuesta.error?.mensaje ??
            'No se pudieron cargar los comprobantes.',
        )
        return
      }
      setItems((previos) =>
        acumular ? [...previos, ...respuesta.items!] : respuesta.items!,
      )
      setHayMas(respuesta.hayMas ?? false)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    void cargar()
  }, [])

  function reutilizar(comprobante: Comprobante): void {
    const preparado = confirmarYPrepararReutilizacion(
      comprobante,
      lineasEnCurso,
    )
    if (preparado === null) return

    cargarDesdeComprobante({
      lineas: preparado.lineas,
      cliente: preparado.cliente,
    })
    mostrar({
      tono: 'info',
      mensaje: `Pedido cargado desde ${preparado.etiqueta}. El comprobante original no se modifica.`,
    })
    void navigate({ to: '/' })
  }

  const ultimo = items[items.length - 1]

  return (
    <section className="flex min-h-full flex-col px-4 py-6 sm:px-8">
      <header className="mb-6">
        <h1 className="text-cabecera font-bold text-tinta">Comprobantes</h1>
        <p className="mt-1 text-cuerpo text-desvaida">
          Consulta y anulación del mismo día. Un comprobante no se borra: se
          anula.
        </p>
      </header>

      {error ? (
        <p className="mb-4 text-cuerpo font-bold text-aviso" role="alert">
          {error}
        </p>
      ) : null}

      <ul className="flex flex-col gap-2">
        {items.map((cada) => {
          const puedeReutilizar = cada.lineas.length > 0
          return (
            <li key={cada.id} className="flex items-stretch gap-2">
              {/*
                Identidad a la izquierda, estado/total a la derecha del enlace.
                La acción secundaria va fuera del Link, al final de la fila
                (mismo patrón que el trash de cotizaciones): ni izquierda
                (compite con la serie) ni centro (rompe el escaneo).
              */}
              <Link
                to="/comprobantes/$comprobanteId"
                params={{ comprobanteId: cada.id }}
                className={[
                  'flex min-h-14 min-w-0 flex-1 items-center justify-between gap-3 rounded-2xl',
                  'border border-borde bg-papel px-4 py-3 shadow-sm',
                  'hover:border-tinta focus-visible:outline-none focus-visible:border-tinta',
                ].join(' ')}
              >
                <span className="min-w-0">
                  <span className="block font-mono text-cuerpo font-bold text-tinta">
                    {etiquetaDeComprobante(cada)}
                  </span>
                  <span className="block truncate text-etiqueta text-desvaida">
                    {nombreDeTipo(cada.tipoDocumento)}
                    {cada.cliente
                      ? ` · ${cada.cliente.denominacion}`
                      : ' · Cliente eventual'}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <MarcaDeEstado estado={cada.estado} />
                  <span className="font-mono tabular-nums text-cuerpo text-tinta">
                    {formatearImporte(cada.total)}
                  </span>
                </span>
              </Link>
              <button
                type="button"
                disabled={!puedeReutilizar}
                aria-label={`Reutilizar pedido de ${etiquetaDeComprobante(cada)}`}
                title="Reutilizar pedido"
                onClick={() => reutilizar(cada)}
                className={[
                  'inline-flex size-11 shrink-0 items-center justify-center self-center rounded-full',
                  'text-desvaida transition-colors',
                  'hover:bg-mesa hover:text-tinta',
                  'focus-visible:outline-none focus-visible:border focus-visible:border-tinta',
                  'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent',
                ].join(' ')}
              >
                <ListRestart className="size-5" aria-hidden />
              </button>
            </li>
          )
        })}
      </ul>

      {items.length === 0 && !cargando && error === null ? (
        <p className="mt-8 text-cuerpo text-desvaida">
          Aún no hay comprobantes para mostrar.
        </p>
      ) : null}

      {hayMas && ultimo ? (
        <div className="mt-6">
          <Boton
            variante="secundario"
            disabled={cargando}
            onClick={() => void cargar(ultimo.id, true)}
          >
            {cargando ? 'Cargando…' : 'Cargar más'}
          </Boton>
        </div>
      ) : null}
    </section>
  )
}

function nombreDeTipo(tipo: string): string {
  if (tipo in REGLAS) {
    return REGLAS[tipo as TipoDeDocumento].nombre
  }
  return tipo
}
