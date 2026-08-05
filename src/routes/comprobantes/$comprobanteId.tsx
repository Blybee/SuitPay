import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { estaDentroDeLaVentanaDeAnulacion } from '../../domain/anulacion/ventana.ts'
import { estadoEsAnulable, REGLAS } from '../../domain/documentos/tipos.ts'
import { formatearImporte } from '../../domain/totales/calculo.ts'
import { ConfirmarAnulacion } from '../../features/emision/confirmar-anulacion.tsx'
import { leerComprobante } from '../../features/emision/emitir.funciones.ts'
import type { Comprobante } from '../../features/emision/emitir.funciones.ts'
import { FueraDeVentana } from '../../features/emision/fuera-de-ventana.tsx'
import { GuardaSesion } from '../../features/sesion/GuardaSesion.tsx'
import { MarcaDeEstado } from '../../ui/componentes/Sello.tsx'
import { Boton } from '../../ui/componentes/primitivas.tsx'

/**
 * Detalle del comprobante + anulación (T104–T106).
 */
export const Route = createFileRoute('/comprobantes/$comprobanteId')({
  component: DetalleConGuarda,
})

function DetalleConGuarda() {
  return (
    <GuardaSesion>
      <DetalleDeComprobante />
    </GuardaSesion>
  )
}

function DetalleDeComprobante() {
  const { comprobanteId } = Route.useParams()
  const [comprobante, setComprobante] = useState<Comprobante | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmarAbierta, setConfirmarAbierta] = useState(false)

  async function cargar(): Promise<void> {
    setError(null)
    try {
      const leido = await leerComprobante({ data: { comprobanteId } })
      setComprobante(normalizarFechas(leido))
    } catch (fallo) {
      setError(
        fallo instanceof Error
          ? fallo.message
          : 'No se pudo cargar el comprobante.',
      )
    }
  }

  useEffect(() => {
    void cargar()
  }, [comprobanteId])

  if (error) {
    return (
      <section className="px-4 py-6 sm:px-8">
        <p className="text-cuerpo font-bold text-aviso" role="alert">
          {error}
        </p>
        <Link
          to="/comprobantes"
          className="mt-4 inline-block text-cuerpo text-tinta underline"
        >
          Volver al listado
        </Link>
      </section>
    )
  }

  if (comprobante === null) {
    return (
      <section className="px-4 py-6 sm:px-8">
        <p className="text-cuerpo text-desvaida">Cargando…</p>
      </section>
    )
  }

  const nombreTipo = REGLAS[comprobante.tipoDocumento].nombre
  const numeracion =
    comprobante.numero === null
      ? comprobante.serie
      : `${comprobante.serie}-${String(comprobante.numero).padStart(8, '0')}`

  const ventana = estaDentroDeLaVentanaDeAnulacion(
    comprobante.emitidoEn,
    new Date(),
  )
  const anulable =
    estadoEsAnulable(comprobante.estado) && ventana.dentroDeVentana
  const fueraDeVentana =
    estadoEsAnulable(comprobante.estado) && !ventana.dentroDeVentana

  return (
    <section className="flex min-h-full flex-col px-4 py-6 sm:px-8">
      <Link
        to="/comprobantes"
        className="mb-4 text-etiqueta uppercase text-desvaida hover:text-tinta"
      >
        ← Comprobantes
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-mono text-cabecera font-bold text-tinta">
            {numeracion}
          </h1>
          <p className="mt-1 text-cuerpo text-desvaida">
            {nombreTipo}
            {comprobante.cliente
              ? ` · ${comprobante.cliente.denominacion}`
              : ' · Cliente eventual'}
          </p>
        </div>
        <MarcaDeEstado estado={comprobante.estado} />
      </header>

      <dl className="mb-6 grid gap-3 rounded-3xl border border-borde bg-papel p-5 shadow-sm sm:grid-cols-2">
        <div>
          <dt className="font-mono text-etiqueta uppercase text-desvaida">
            Total
          </dt>
          <dd className="font-mono text-subtitulo font-bold tabular-nums text-tinta">
            {formatearImporte(comprobante.total)}
          </dd>
        </div>
        <div>
          <dt className="font-mono text-etiqueta uppercase text-desvaida">
            Emitido
          </dt>
          <dd className="text-cuerpo text-tinta">
            {comprobante.emitidoEn.toLocaleString('es-PE', {
              timeZone: 'America/Lima',
            })}
          </dd>
        </div>
        {comprobante.anulacion ? (
          <div className="sm:col-span-2">
            <dt className="font-mono text-etiqueta uppercase text-desvaida">
              Anulación
            </dt>
            <dd className="text-cuerpo text-tinta">
              {comprobante.anulacion.motivo}
              <span className="mt-1 block text-etiqueta text-desvaida">
                {comprobante.anulacion.momento.toLocaleString('es-PE', {
                  timeZone: 'America/Lima',
                })}
              </span>
            </dd>
          </div>
        ) : null}
      </dl>

      <ul className="mb-8 divide-y divide-borde rounded-3xl border border-borde bg-papel">
        {comprobante.lineas.map((linea, indice) => (
          <li
            key={`${linea.codigo}-${indice}`}
            className="flex items-baseline justify-between gap-3 px-4 py-2"
          >
            <span className="min-w-0">
              <span className="block truncate text-cuerpo uppercase text-tinta">
                {linea.descripcion}
              </span>
              <span className="font-mono text-etiqueta text-desvaida">
                {linea.codigo} · {linea.cantidad} {linea.unidad}
              </span>
            </span>
            <span className="font-mono tabular-nums text-cuerpo text-tinta">
              {formatearImporte(linea.importe)}
            </span>
          </li>
        ))}
      </ul>

      {fueraDeVentana ? (
        <FueraDeVentana diaDeEmision={ventana.diaDeEmision} />
      ) : null}

      {anulable ? (
        <div className="mt-4">
          <Boton
            variante="peligro"
            onClick={() => setConfirmarAbierta(true)}
          >
            Anular comprobante
          </Boton>
        </div>
      ) : null}

      <ConfirmarAnulacion
        abierta={confirmarAbierta}
        onCerrar={() => setConfirmarAbierta(false)}
        comprobanteId={comprobante.id}
        serie={comprobante.serie}
        numero={comprobante.numero}
        tipoNombre={nombreTipo}
        onAnulado={() => void cargar()}
      />
    </section>
  )
}

function normalizarFechas(comprobante: Comprobante): Comprobante {
  return {
    ...comprobante,
    emitidoEn: new Date(comprobante.emitidoEn),
    anulacion:
      comprobante.anulacion === null
        ? null
        : {
            ...comprobante.anulacion,
            momento: new Date(comprobante.anulacion.momento),
          },
    intentos: comprobante.intentos.map((intento) => ({
      ...intento,
      momento: new Date(intento.momento),
    })),
  }
}
