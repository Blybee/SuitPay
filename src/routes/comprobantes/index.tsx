import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { REGLAS } from '../../domain/documentos/tipos.ts'
import type { TipoDeDocumento } from '../../domain/documentos/tipos.ts'
import { formatearImporte } from '../../domain/totales/calculo.ts'
import { listarComprobantes } from '../../features/emision/emitir.funciones.ts'
import type { Comprobante } from '../../features/emision/emitir.funciones.ts'
import { GuardaSesion } from '../../features/sesion/GuardaSesion.tsx'
import { MarcaDeEstado } from '../../ui/componentes/Sello.tsx'
import { Boton } from '../../ui/componentes/primitivas.tsx'

/**
 * Consulta de comprobantes con paginación por cursor (T103).
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
        {items.map((cada) => (
          <li key={cada.id}>
            <Link
              to="/comprobantes/$comprobanteId"
              params={{ comprobanteId: cada.id }}
              className={[
                'flex min-h-14 items-center justify-between gap-3 rounded-2xl',
                'border border-borde bg-papel px-4 py-3 shadow-sm',
                'hover:border-tinta focus-visible:outline-none focus-visible:border-tinta',
              ].join(' ')}
            >
              <span className="min-w-0">
                <span className="block font-mono text-cuerpo font-bold text-tinta">
                  {etiquetaNumeracion(cada)}
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
          </li>
        ))}
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

function etiquetaNumeracion(comprobante: Comprobante): string {
  if (comprobante.numero === null) {
    return comprobante.serie || comprobante.id.slice(0, 8)
  }
  return `${comprobante.serie}-${String(comprobante.numero).padStart(8, '0')}`
}

function nombreDeTipo(tipo: string): string {
  if (tipo in REGLAS) {
    return REGLAS[tipo as TipoDeDocumento].nombre
  }
  return tipo
}
