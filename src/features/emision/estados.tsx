import { AlertTriangle, Loader2, Printer, Share2 } from 'lucide-react'
import { useState } from 'react'
import { formatearImporte } from '../../domain/totales/calculo.ts'
import { PapeletaContexto } from '../../ui/componentes/PapeletaContexto.tsx'
import { MarcaDeEstado } from '../../ui/componentes/Sello.tsx'
import { Boton } from '../../ui/componentes/primitivas.tsx'
import { consultarEstado } from './emitir.funciones.ts'
import { sePuedeReintentar, usarEmision } from './flujo.ts'
import type { FaseDeEmision } from './flujo.ts'

/**
 * Estados de emisión en la interfaz (decisión 10).
 * `en_verificacion` ofrece «Consultar estado», nunca reemitir.
 */

export interface PropsDeEstadoDeEmision {
  readonly fase: FaseDeEmision
  readonly onCerrar: () => void
  readonly onReintentar: () => void
  readonly onImprimir: (comprobanteId: string) => void
  readonly onCompartir: (comprobanteId: string) => void
}

export function EstadoDeEmision({
  fase,
  onCerrar,
  onReintentar,
  onImprimir,
  onCompartir,
}: PropsDeEstadoDeEmision) {
  if (fase.nombre === 'inactiva') return null

  if (fase.nombre === 'en_vuelo') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed inset-0 z-30 flex items-center justify-center bg-tinta/25"
      >
        <div className="flex items-center gap-3 rounded-3xl border border-borde bg-papel px-6 py-4 shadow-md">
          <Loader2 className="size-6 animate-spin text-tinta" aria-hidden />
          <p className="text-cabecera font-bold text-tinta">Emitiendo…</p>
        </div>
      </div>
    )
  }

  if (fase.nombre === 'emitida') {
    const { comprobante, yaExistia } = fase
    return (
      <PapeletaContexto
        abierta
        alCambiar={(abierta) => {
          if (!abierta) onCerrar()
        }}
        titulo={
          yaExistia ? 'Este comprobante ya estaba emitido' : 'Comprobante emitido'
        }
      >
        <div className="space-y-3">
          <MarcaDeEstado estado={comprobante.estado} />

          {yaExistia && (
            <p className="text-cuerpo text-tinta">
              No se emitió nada nuevo. Es el mismo comprobante de antes, así que
              no hay nada que corregir ni anular.
            </p>
          )}

          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt className="font-mono text-etiqueta uppercase text-desvaida">
              Número
            </dt>
            <dd className="font-mono text-cuerpo text-tinta">
              {comprobante.serie === ''
                ? 'sin numeración regulada'
                : `${comprobante.serie}-${String(comprobante.numero ?? 0).padStart(8, '0')}`}
            </dd>
            <dt className="font-mono text-etiqueta uppercase text-desvaida">
              Total
            </dt>
            <dd className="font-mono tabular-nums text-cuerpo font-bold text-tinta">
              {formatearImporte(comprobante.total)}
            </dd>
          </dl>

          {comprobante.totalCorregido && (
            <p className="rounded-2xl border border-aviso px-3 py-2 text-cuerpo font-bold text-aviso">
              El total se recalculó en el servidor. Comprueba lo cobrado contra el
              importe de arriba.
            </p>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <Boton
              variante="principal"
              onClick={() => onImprimir(comprobante.comprobanteId)}
            >
              <Printer className="size-5" aria-hidden />
              Imprimir
            </Boton>
            <Boton onClick={() => onCompartir(comprobante.comprobanteId)}>
              <Share2 className="size-5" aria-hidden />
              Compartir
            </Boton>
            <Boton variante="discreto" onClick={onCerrar}>
              Siguiente venta
            </Boton>
          </div>
        </div>
      </PapeletaContexto>
    )
  }

  if (fase.nombre === 'en_verificacion') {
    return <Verificacion fase={fase} onCerrar={onCerrar} />
  }

  const reintentable = sePuedeReintentar(fase)

  return (
    <PapeletaContexto
      abierta
      alCambiar={(abierta) => {
        if (!abierta) onCerrar()
      }}
      titulo={
        fase.nombre === 'rechazada' ? 'Comprobante rechazado' : 'No se pudo emitir'
      }
    >
      <div className="space-y-3">
        <p className="text-cuerpo font-bold text-aviso">{fase.mensaje}</p>

        {fase.nombre === 'rechazada' && (
          <p className="text-cuerpo text-tinta">
            El pedido sigue como estaba. Corrige lo que haga falta y vuelve a
            emitir: será un comprobante nuevo, con su propia numeración.
          </p>
        )}

        {fase.nombre === 'no_se_pudo' &&
          fase.codigo === 'proveedor_no_disponible' && (
            <p className="text-cuerpo text-tinta">
              El pedido no se ha perdido. Cuando el servicio responda, pulsa
              «Volver a intentar» — es la misma venta, no una nueva.
            </p>
          )}

        <div className="flex flex-wrap gap-2">
          {reintentable && (
            <Boton variante="principal" onClick={onReintentar}>
              Volver a intentar
            </Boton>
          )}
          <Boton variante="secundario" onClick={onCerrar}>
            Volver al pedido
          </Boton>
        </div>
      </div>
    </PapeletaContexto>
  )
}

function Verificacion({
  fase,
  onCerrar,
}: {
  readonly fase: Extract<FaseDeEmision, { nombre: 'en_verificacion' }>
  readonly onCerrar: () => void
}) {
  const [consultando, setConsultando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const adoptarConsulta = usarEmision((s) => s.adoptarConsulta)
  const marcarReintentable = usarEmision((s) => s.marcarReintentableTrasConsulta)

  async function consultar(): Promise<void> {
    if (fase.comprobanteId === null || consultando) return
    setConsultando(true)
    setAviso(null)
    try {
      const respuesta = await consultarEstado({
        data: { comprobanteId: fase.comprobanteId },
      })
      if (!respuesta.ok || respuesta.resultado === undefined) {
        setAviso(
          respuesta.error?.mensaje ??
            'No se pudo consultar. Inténtalo de nuevo en unos minutos.',
        )
        return
      }

      const { desenlace, comprobante } = respuesta.resultado

      if (desenlace === 'resuelto' || desenlace === 'ya_cerrado') {
        adoptarConsulta({
          comprobanteId: comprobante.id,
          estado: comprobante.estado,
          serie: comprobante.serie,
          numero: comprobante.numero,
          total: comprobante.total,
          archivos: {
            pdf: comprobante.proveedor?.pdf ?? null,
            xml: comprobante.proveedor?.xml ?? null,
            cdr: comprobante.proveedor?.cdr ?? null,
          },
          yaExistia: true,
          totalCorregido: false,
        })
        return
      }

      if (desenlace === 'sin_documento') {
        marcarReintentable(
          'El proveedor no tiene ese documento. Ya puedes volver a intentar la emisión con seguridad.',
        )
        return
      }

      if (desenlace === 'intervencion') {
        setAviso(
          'No se pudo aclarar solo. Habla con el administrador y no emitas otra vez.',
        )
        return
      }

      setAviso(
        'La consulta no respondió. Espera un momento e inténtalo de nuevo. No emitas otra vez.',
      )
    } catch {
      setAviso(
        'No se pudo consultar. Inténtalo de nuevo en unos minutos. No emitas otra vez.',
      )
    } finally {
      setConsultando(false)
    }
  }

  return (
    <PapeletaContexto
      abierta
      noSeCierraSola
      alCambiar={() => undefined}
      titulo="No se pudo confirmar la emisión"
    >
      <div className="space-y-3">
        <div className="flex items-start gap-3 rounded-2xl border border-aviso px-3 py-2">
          <AlertTriangle
            className="mt-0.5 size-6 shrink-0 text-aviso"
            aria-hidden
          />
          <p className="text-aviso font-bold">
            NO vuelvas a emitir esta venta a ciegas.
          </p>
        </div>

        <p className="text-cuerpo text-tinta">{fase.mensaje}</p>

        <p className="text-cuerpo text-tinta">
          Puede que el comprobante exista y no nos haya llegado la respuesta.
          Usa «Consultar estado» para preguntarle al proveedor. Emitir otra vez
          sin eso podría crear un duplicado.
        </p>

        {fase.comprobanteId !== null && (
          <p className="font-mono text-etiqueta uppercase text-desvaida">
            Referencia: {fase.comprobanteId}
          </p>
        )}

        {aviso !== null && (
          <p className="rounded-2xl border border-aviso px-3 py-2 text-cuerpo text-aviso">
            {aviso}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Boton
            variante="principal"
            disabled={fase.comprobanteId === null || consultando}
            onClick={() => void consultar()}
          >
            {consultando ? 'Consultando…' : 'Consultar estado'}
          </Boton>
          <Boton variante="secundario" onClick={onCerrar} disabled={consultando}>
            Volver al pedido
          </Boton>
        </div>
      </div>
    </PapeletaContexto>
  )
}
