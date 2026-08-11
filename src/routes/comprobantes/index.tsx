import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Ban, ListRestart, Printer, Search, UserRound, X } from 'lucide-react'
import { useState } from 'react'
import {
  diaEnLima,
  estaDentroDeLaVentanaDeAnulacion,
} from '../../domain/anulacion/ventana.ts'
import { totalDeVentasParaCierre } from '../../domain/comprobantes/resumen.ts'
import { estadoEsAnulable, REGLAS } from '../../domain/documentos/tipos.ts'
import type { TipoDeDocumento } from '../../domain/documentos/tipos.ts'
import { formatearImporte } from '../../domain/totales/calculo.ts'
import { usarCatalogo } from '../../features/catalogo/almacen.ts'
import { buscarCoincidenciasDeCliente } from '../../features/clientes/coincidencias.ts'
import { ConfirmarAnulacion } from '../../features/emision/confirmar-anulacion.tsx'
import {
  buscarComprobantePorSerieNumero,
  listarComprobantes,
} from '../../features/emision/emitir.funciones.ts'
import type { Comprobante } from '../../features/emision/emitir.funciones.ts'
import { reimprimir } from '../../features/emision/reimprimir.ts'
import { usarNotificaciones } from '../../features/notificaciones/almacen.ts'
import { usarPedido } from '../../features/pedido/almacen.ts'
import {
  confirmarYPrepararReutilizacion,
  etiquetaDeComprobante,
} from '../../features/pedido/reutilizar-desde-comprobante.ts'
import { GuardaSesion } from '../../features/sesion/GuardaSesion.tsx'
import type { ClienteEnIndice } from '../../infra/local/catalogo.ts'
import { Modal } from '../../ui/componentes/Modal.tsx'
import { MarcaDeEstado } from '../../ui/componentes/Sello.tsx'
import { Boton } from '../../ui/componentes/primitivas.tsx'

/**
 * Resumen, filtros bajo demanda e impresión colaborativa (US4b / T191).
 * Anulación rápida en fila (mismo día) o en detalle. Sin lista al montar.
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

type ModoLista = 'inactivo' | 'hoy' | 'rango'

function ListaDeComprobantes() {
  const navigate = useNavigate()
  const cargarDesdeComprobante = usarPedido((s) => s.cargarDesdeComprobante)
  const lineasEnCurso = usarPedido((s) => s.lineas.length)
  const mostrar = usarNotificaciones((s) => s.mostrar)
  const indiceClientes = usarCatalogo((s) => s.clientes)

  const [modo, setModo] = useState<ModoLista>('inactivo')
  const [fechaInicio, setFechaInicio] = useState(() => diaEnLima(new Date()))
  const [fechaFin, setFechaFin] = useState(() => diaEnLima(new Date()))
  const [cliente, setCliente] = useState<ClienteEnIndice | null>(null)
  const [modalCliente, setModalCliente] = useState(false)
  const [modalBusqueda, setModalBusqueda] = useState(false)

  const [items, setItems] = useState<readonly Comprobante[]>([])
  const [hayMas, setHayMas] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imprimiendoId, setImprimiendoId] = useState<string | null>(null)
  const [anulando, setAnulando] = useState<Comprobante | null>(null)

  async function cargarHoy(clienteDoc?: string | null): Promise<void> {
    setCargando(true)
    setError(null)
    setModo('hoy')
    try {
      const respuesta = await listarComprobantes({
        data: {
          modo: 'hoy',
          clienteNumeroDocumento: clienteDoc ?? undefined,
        },
      })
      if (!respuesta.ok || respuesta.items === undefined) {
        setError(
          respuesta.error?.mensaje ??
            'No se pudieron cargar los comprobantes.',
        )
        setItems([])
        setHayMas(false)
        return
      }
      setItems(respuesta.items)
      setHayMas(false)
    } finally {
      setCargando(false)
    }
  }

  async function cargarRango(
    inicio: string,
    fin: string,
    clienteDoc: string | null | undefined,
    cursorId?: string,
    acumular = false,
  ): Promise<void> {
    setCargando(true)
    setError(null)
    setModo('rango')
    try {
      const respuesta = await listarComprobantes({
        data: {
          modo: 'rango',
          fechaInicio: inicio,
          fechaFin: fin,
          clienteNumeroDocumento: clienteDoc ?? undefined,
          limite: 20,
          cursorId,
        },
      })
      if (!respuesta.ok || respuesta.items === undefined) {
        setError(
          respuesta.error?.mensaje ??
            'No se pudieron cargar los comprobantes.',
        )
        if (!acumular) setItems([])
        setHayMas(false)
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

  function activarHoy(): void {
    void cargarHoy(cliente?.numeroDocumento)
  }

  function aplicarRango(): void {
    if (fechaInicio > fechaFin) {
      mostrar({
        tono: 'error',
        mensaje: 'La fecha de inicio no puede ser posterior a la final.',
      })
      return
    }
    void cargarRango(fechaInicio, fechaFin, cliente?.numeroDocumento)
  }

  function alElegirCliente(elegido: ClienteEnIndice): void {
    setCliente(elegido)
    setModalCliente(false)
    if (modo === 'hoy') {
      void cargarHoy(elegido.numeroDocumento)
    } else if (modo === 'rango') {
      void cargarRango(fechaInicio, fechaFin, elegido.numeroDocumento)
    }
  }

  function quitarCliente(): void {
    setCliente(null)
    if (modo === 'hoy') void cargarHoy(null)
    else if (modo === 'rango') {
      void cargarRango(fechaInicio, fechaFin, null)
    }
  }

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

  async function imprimir(comprobanteId: string): Promise<void> {
    setImprimiendoId(comprobanteId)
    try {
      const resultado = await reimprimir(comprobanteId)
      if (!resultado.ok) {
        const mensaje =
          resultado.motivo === 'sin_archivo_todavia'
            ? 'Este comprobante no tiene PDF del proveedor para imprimir.'
            : resultado.motivo === 'no_encontrado'
              ? 'No se encontró el comprobante.'
              : 'No se pudo abrir el PDF.'
        mostrar({ tono: 'error', mensaje })
        return
      }
      mostrar({
        tono: 'exito',
        mensaje: `Abriendo PDF de ${resultado.nombre}.`,
      })
    } finally {
      setImprimiendoId(null)
    }
  }

  const ultimo = items[items.length - 1]
  const totalCierre =
    modo === 'hoy' ? totalDeVentasParaCierre(items) : null

  return (
    <section className="flex min-h-full flex-col px-4 py-6 sm:px-8">
      <header className="mb-6">
        <h1 className="text-cabecera font-bold text-tinta">Comprobantes</h1>
        <p className="mt-1 text-cuerpo text-desvaida">
          Consulta colaborativa del mismo día. Un comprobante no se borra: se
          anula. Desde la lista puedes imprimir, reutilizar o anular (mismo
          día); la fila abre el detalle.
        </p>
      </header>

      <div className="mb-6 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Boton
            variante={modo === 'hoy' ? 'principal' : 'secundario'}
            disabled={cargando}
            onClick={activarHoy}
          >
            Hoy
          </Boton>
          <Boton
            variante="secundario"
            disabled={cargando}
            onClick={() => setModalBusqueda(true)}
          >
            <span className="inline-flex items-center gap-2">
              <Search className="size-4" aria-hidden />
              Buscar serie-número
            </span>
          </Boton>
          <Boton
            variante="secundario"
            disabled={cargando}
            onClick={() => setModalCliente(true)}
          >
            <span className="inline-flex items-center gap-2">
              <UserRound className="size-4" aria-hidden />
              {cliente ? 'Cambiar cliente' : 'Cliente'}
            </span>
          </Boton>
          {cliente ? (
            <button
              type="button"
              onClick={quitarCliente}
              className="inline-flex items-center gap-1 rounded-full border border-borde bg-papel px-3 py-1.5 text-etiqueta text-tinta"
            >
              {cliente.denominacion}
              <X className="size-3.5" aria-hidden />
              <span className="sr-only">Quitar filtro de cliente</span>
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-borde bg-papel p-4 shadow-sm">
          <label className="flex flex-col gap-1 text-etiqueta text-desvaida">
            Desde
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="rounded-full border border-borde bg-mesa px-3 py-2 font-mono text-cuerpo text-tinta"
            />
          </label>
          <label className="flex flex-col gap-1 text-etiqueta text-desvaida">
            Hasta
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className="rounded-full border border-borde bg-mesa px-3 py-2 font-mono text-cuerpo text-tinta"
            />
          </label>
          <Boton
            variante="secundario"
            disabled={cargando}
            onClick={aplicarRango}
          >
            Aplicar rango
          </Boton>
        </div>
      </div>

      {modo === 'hoy' && totalCierre !== null ? (
        <div className="mb-4 rounded-2xl border border-borde bg-papel px-4 py-3 shadow-sm">
          <p className="text-etiqueta text-desvaida">
            Resumen de ventas de hoy
            {cliente ? ` · ${cliente.denominacion}` : ''}
          </p>
          <p className="font-mono text-cabecera font-bold tabular-nums text-tinta">
            {formatearImporte(totalCierre)}
          </p>
          <p className="mt-1 text-etiqueta text-desvaida">
            {items.length} comprobante{items.length === 1 ? '' : 's'} · los
            anulados no suman al total
          </p>
        </div>
      ) : null}

      {error ? (
        <p className="mb-4 text-cuerpo font-bold text-aviso" role="alert">
          {error}
        </p>
      ) : null}

      {modo === 'inactivo' && !cargando ? (
        <p className="mt-4 text-cuerpo text-desvaida">
          Elige <strong className="font-bold text-tinta">Hoy</strong>, un
          rango de fechas o busca por serie y número. La lista no se carga
          sola.
        </p>
      ) : null}

      {modo !== 'inactivo' ? (
        <ul className="flex flex-col gap-2">
          {items.map((cada) => {
            const puedeReutilizar = cada.lineas.length > 0
            const ventana = estaDentroDeLaVentanaDeAnulacion(
              new Date(cada.emitidoEn),
              new Date(),
            )
            const puedeAnular =
              estadoEsAnulable(cada.estado) && ventana.dentroDeVentana
            const tituloAnular = !estadoEsAnulable(cada.estado)
              ? cada.estado === 'anulado'
                ? 'Ya está anulado'
                : 'No se puede anular en este estado'
              : !ventana.dentroDeVentana
                ? 'Fuera de la ventana del mismo día'
                : 'Anular comprobante'

            return (
              <li key={cada.id} className="flex items-stretch gap-2">
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
                  disabled={imprimiendoId === cada.id}
                  aria-label={`Imprimir PDF de ${etiquetaDeComprobante(cada)}`}
                  title="Imprimir PDF"
                  onClick={() => void imprimir(cada.id)}
                  className={[
                    'inline-flex size-11 shrink-0 items-center justify-center self-center rounded-full',
                    'text-desvaida transition-colors',
                    'hover:bg-mesa hover:text-tinta',
                    'focus-visible:outline-none focus-visible:border focus-visible:border-tinta',
                    'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent',
                  ].join(' ')}
                >
                  <Printer className="size-5" aria-hidden />
                </button>
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
                <button
                  type="button"
                  disabled={!puedeAnular}
                  aria-label={`Anular ${etiquetaDeComprobante(cada)}`}
                  title={tituloAnular}
                  onClick={() => {
                    if (!puedeAnular) return
                    setAnulando(cada)
                  }}
                  className={[
                    'inline-flex size-11 shrink-0 items-center justify-center self-center rounded-full',
                    'text-aviso transition-colors',
                    'hover:bg-aviso/10 hover:text-aviso',
                    'focus-visible:outline-none focus-visible:border focus-visible:border-aviso',
                    'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent',
                  ].join(' ')}
                >
                  <Ban className="size-5" aria-hidden />
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}

      {modo !== 'inactivo' && items.length === 0 && !cargando && error === null ? (
        <p className="mt-8 text-cuerpo text-desvaida">
          No hay comprobantes para este filtro.
        </p>
      ) : null}

      {modo === 'rango' && hayMas && ultimo ? (
        <div className="mt-6">
          <Boton
            variante="secundario"
            disabled={cargando}
            onClick={() =>
              void cargarRango(
                fechaInicio,
                fechaFin,
                cliente?.numeroDocumento,
                ultimo.id,
                true,
              )
            }
          >
            {cargando ? 'Cargando…' : 'Cargar más'}
          </Boton>
        </div>
      ) : null}

      {cargando && modo !== 'inactivo' && items.length === 0 ? (
        <p className="mt-4 text-cuerpo text-desvaida">Cargando…</p>
      ) : null}

      <ModalCliente
        abierta={modalCliente}
        alCambiar={setModalCliente}
        indice={indiceClientes}
        alElegir={alElegirCliente}
      />
      <ModalBusquedaExacta
        abierta={modalBusqueda}
        alCambiar={setModalBusqueda}
        alImprimir={(id) => void imprimir(id)}
        alAbrir={(id) =>
          void navigate({
            to: '/comprobantes/$comprobanteId',
            params: { comprobanteId: id },
          })
        }
        mostrar={mostrar}
      />

      {anulando ? (
        <ConfirmarAnulacion
          abierta
          onCerrar={() => setAnulando(null)}
          comprobanteId={anulando.id}
          serie={anulando.serie}
          numero={anulando.numero}
          tipoNombre={nombreDeTipo(anulando.tipoDocumento)}
          onAnulado={() => {
            mostrar({
              tono: 'exito',
              mensaje: `${etiquetaDeComprobante(anulando)} anulado.`,
            })
            setAnulando(null)
            if (modo === 'hoy') {
              void cargarHoy(cliente?.numeroDocumento)
            } else if (modo === 'rango') {
              void cargarRango(
                fechaInicio,
                fechaFin,
                cliente?.numeroDocumento,
              )
            }
          }}
        />
      ) : null}
    </section>
  )
}

function ModalCliente({
  abierta,
  alCambiar,
  indice,
  alElegir,
}: {
  readonly abierta: boolean
  readonly alCambiar: (v: boolean) => void
  readonly indice: readonly ClienteEnIndice[]
  readonly alElegir: (c: ClienteEnIndice) => void
}) {
  const [texto, setTexto] = useState('')
  const coincidencias = buscarCoincidenciasDeCliente(texto, indice, 12)

  return (
    <Modal
      abierta={abierta}
      alCambiar={alCambiar}
      titulo="Filtrar por cliente"
      descripcion="Busca en el índice local y elige un cliente. Se combina con Hoy o con el rango."
    >
      <input
        type="search"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="RUC, DNI o razón social"
        className="w-full rounded-full border border-borde bg-mesa px-4 py-3 text-cuerpo text-tinta"
        autoFocus
      />
      <ul className="mt-3 flex max-h-64 flex-col gap-1 overflow-auto">
        {coincidencias.map((cada) => (
          <li key={cada.numeroDocumento}>
            <button
              type="button"
              className="flex w-full flex-col rounded-2xl border border-transparent px-3 py-2 text-left hover:border-borde hover:bg-mesa"
              onClick={() => alElegir(cada)}
            >
              <span className="text-cuerpo font-bold text-tinta">
                {cada.denominacion}
              </span>
              <span className="font-mono text-etiqueta text-desvaida">
                {cada.numeroDocumento}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  )
}

function ModalBusquedaExacta({
  abierta,
  alCambiar,
  alImprimir,
  alAbrir,
  mostrar,
}: {
  readonly abierta: boolean
  readonly alCambiar: (v: boolean) => void
  readonly alImprimir: (id: string) => void
  readonly alAbrir: (id: string) => void
  readonly mostrar: (n: {
    readonly tono: 'exito' | 'error' | 'info'
    readonly mensaje: string
  }) => void
}) {
  const [serie, setSerie] = useState('')
  const [numero, setNumero] = useState('')
  const [hallado, setHallado] = useState<Comprobante | null>(null)
  const [buscando, setBuscando] = useState(false)

  async function buscar(): Promise<void> {
    const n = Number.parseInt(numero, 10)
    if (serie.trim() === '' || !Number.isFinite(n)) {
      mostrar({
        tono: 'error',
        mensaje: 'Indica serie y número válidos.',
      })
      return
    }
    setBuscando(true)
    setHallado(null)
    try {
      const respuesta = await buscarComprobantePorSerieNumero({
        data: { serie: serie.trim(), numero: n },
      })
      if (!respuesta.ok || respuesta.comprobante === undefined) {
        mostrar({
          tono: 'error',
          mensaje:
            respuesta.error?.mensaje ?? 'No se encontró ese comprobante.',
        })
        return
      }
      setHallado(respuesta.comprobante)
    } finally {
      setBuscando(false)
    }
  }

  return (
    <Modal
      abierta={abierta}
      alCambiar={(v) => {
        if (!v) {
          setHallado(null)
          setSerie('')
          setNumero('')
        }
        alCambiar(v)
      }}
      titulo="Buscar documento"
      descripcion="Serie y número exactos. Puedes abrir el detalle o imprimir el PDF."
      pie={
        <Boton variante="principal" disabled={buscando} onClick={() => void buscar()}>
          {buscando ? 'Buscando…' : 'Buscar'}
        </Boton>
      }
    >
      <div className="flex flex-wrap gap-3">
        <label className="flex min-w-[8rem] flex-1 flex-col gap-1 text-etiqueta text-desvaida">
          Serie
          <input
            value={serie}
            onChange={(e) => setSerie(e.target.value.toUpperCase())}
            className="rounded-full border border-borde bg-mesa px-3 py-2 font-mono text-cuerpo text-tinta"
            placeholder="B001"
          />
        </label>
        <label className="flex min-w-[8rem] flex-1 flex-col gap-1 text-etiqueta text-desvaida">
          Número
          <input
            value={numero}
            onChange={(e) => setNumero(e.target.value.replace(/\D/g, ''))}
            className="rounded-full border border-borde bg-mesa px-3 py-2 font-mono text-cuerpo text-tinta"
            placeholder="2"
            inputMode="numeric"
          />
        </label>
      </div>

      {hallado ? (
        <div className="mt-4 rounded-2xl border border-borde bg-mesa p-4">
          <p className="font-mono text-cuerpo font-bold text-tinta">
            {etiquetaDeComprobante(hallado)}
          </p>
          <p className="text-etiqueta text-desvaida">
            {nombreDeTipo(hallado.tipoDocumento)}
            {hallado.cliente
              ? ` · ${hallado.cliente.denominacion}`
              : ' · Cliente eventual'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Boton
              variante="secundario"
              onClick={() => {
                alAbrir(hallado.id)
                alCambiar(false)
              }}
            >
              Abrir detalle
            </Boton>
            <Boton
              variante="principal"
              onClick={() => alImprimir(hallado.id)}
            >
              Imprimir PDF
            </Boton>
          </div>
        </div>
      ) : null}
    </Modal>
  )
}

function nombreDeTipo(tipo: string): string {
  if (tipo in REGLAS) {
    return REGLAS[tipo as TipoDeDocumento].nombre
  }
  return tipo
}
