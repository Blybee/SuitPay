import { AlertTriangle, Clock, Loader2, Printer, Share2 } from 'lucide-react'
import { formatearImporte } from '../../domain/totales/calculo.ts'
import { PapeletaContexto } from '../../ui/componentes/PapeletaContexto.tsx'
import { MarcaDeEstado } from '../../ui/componentes/Sello.tsx'
import { Boton } from '../../ui/componentes/primitivas.tsx'
import { sePuedeReintentar  } from './flujo.ts'
import type {FaseDeEmision} from './flujo.ts';

/**
 * Los estados de la emisión en la interfaz.
 *
 * Cada rama de aquí corresponde a un caso límite de la especificación, y la que
 * justifica que este archivo exista aparte es `en_verificacion`: es el estado que
 * peor se resuelve con un diálogo genérico y el que más daño hace mal resuelto.
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
        <div className="flex items-center gap-3 border-2 border-tinta bg-papel px-6 py-4">
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
        titulo={yaExistia ? 'Este comprobante ya estaba emitido' : 'Comprobante emitido'}
      >
        <div className="space-y-3">
          <MarcaDeEstado estado={comprobante.estado} />

          {yaExistia && (
            // La distinción que evita una anulación innecesaria: el vendedor tiene
            // que saber que no acaba de crear un segundo documento.
            <p className="text-cuerpo text-tinta">
              No se emitió nada nuevo. Es el mismo comprobante de antes, así que no
              hay nada que corregir ni anular.
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
            // Corregir en silencio sería peor que rechazar: el vendedor cobraría
            // una cifra y el comprobante diría otra.
            <p className="border-2 border-aviso px-3 py-2 text-cuerpo font-bold text-aviso">
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
    return (
      <PapeletaContexto
        abierta
        // No se cierra por reflejo. El vendedor tiene que leerlo y decidir qué
        // hace con el cliente que está delante.
        noSeCierraSola
        alCambiar={() => undefined}
        titulo="No se pudo confirmar la emisión"
      >
        <div className="space-y-3">
          <div className="flex items-start gap-3 border-2 border-aviso px-3 py-2">
            <AlertTriangle className="mt-0.5 size-6 shrink-0 text-aviso" aria-hidden />
            <p className="text-aviso font-bold">
              NO vuelvas a emitir esta venta.
            </p>
          </div>

          <p className="text-cuerpo text-tinta">{fase.mensaje}</p>

          <p className="text-cuerpo text-tinta">
            El sistema está averiguando si el comprobante llegó a emitirse. Puede
            que exista y que no nos haya llegado la respuesta; emitir otra vez
            crearía un documento duplicado que habría que anular.
          </p>

          <div className="border-2 border-tinta px-3 py-2">
            <p className="font-mono text-etiqueta uppercase text-desvaida">
              Qué hacer con el cliente ahora
            </p>
            <p className="text-cuerpo text-tinta">
              Cobra y entrégale la mercadería. Toma su teléfono y dile que el
              comprobante le llegará hoy. Si insiste en llevarse un papel,
              imprímele el documento interno desde el detalle de la venta.
            </p>
          </div>

          {fase.comprobanteId !== null && (
            <p className="font-mono text-etiqueta uppercase text-desvaida">
              Referencia: {fase.comprobanteId}
            </p>
          )}

          {/* Aquí NO hay botón de reintentar. No deshabilitado: ausente. */}
          <Boton variante="secundario" onClick={onCerrar}>
            Entendido
          </Boton>
        </div>
      </PapeletaContexto>
    )
  }

  if (fase.nombre === 'en_espera') {
    return (
      <PapeletaContexto
        abierta
        noSeCierraSola
        alCambiar={() => undefined}
        titulo="La venta queda en espera"
      >
        <div className="space-y-3">
          <div className="flex items-start gap-3 border-2 border-aviso px-3 py-2">
            <Clock className="mt-0.5 size-6 shrink-0 text-aviso" aria-hidden />
            <p className="text-cuerpo text-aviso font-bold">{fase.mensaje}</p>
          </div>

          <p className="text-cuerpo text-tinta">
            El comprobante se emitirá en cuanto el servicio vuelva y se le hará
            llegar al cliente. La venta ya está registrada: no hay que volver a
            teclearla.
          </p>

          <div className="flex flex-wrap gap-2">
            <Boton
              variante="principal"
              onClick={() => onImprimir(fase.comprobanteId)}
            >
              <Printer className="size-5" aria-hidden />
              Documento interno
            </Boton>
            <Boton variante="discreto" onClick={onCerrar}>
              Siguiente venta
            </Boton>
          </div>
        </div>
      </PapeletaContexto>
    )
  }

  const reintentable = sePuedeReintentar(fase)

  return (
    <PapeletaContexto
      abierta
      alCambiar={(abierta) => {
        if (!abierta) onCerrar()
      }}
      titulo={fase.nombre === 'rechazada' ? 'Comprobante rechazado' : 'No se pudo emitir'}
    >
      <div className="space-y-3">
        <p className="text-cuerpo font-bold text-aviso">{fase.mensaje}</p>

        {fase.nombre === 'rechazada' && (
          <p className="text-cuerpo text-tinta">
            El pedido sigue como estaba. Corrige lo que haga falta y vuelve a
            emitir: será un comprobante nuevo, con su propia numeración.
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
