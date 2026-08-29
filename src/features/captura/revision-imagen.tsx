import { useState } from 'react'
import { Check, Image, X } from 'lucide-react'
import { Modal } from '../../ui/componentes/Modal.tsx'
import { usarCaptura } from './estado.ts'

const CLASE_ICONO = [
  'inline-flex size-11 shrink-0 items-center justify-center rounded-full',
  'transition-[color,background-color,opacity] duration-rapida ease-salida',
  'focus-visible:outline-none focus-visible:border focus-visible:border-tinta',
].join(' ')

/**
 * Revisión en dos pasos para fotografía (T133):
 * 1) texto extraído editable
 * 2) emparejamiento (fase revision)
 *
 * La barra vive en el bloque sticky del mostrador; la lista rueda debajo.
 */
export function BarraPasoTextoExtraido({
  onContinuar,
  onCancelar,
}: {
  readonly onContinuar: () => void
  readonly onCancelar: () => void
}) {
  const lineas = usarCaptura((s) => s.lineas)
  const medioObjectUrl = usarCaptura((s) => s.medioObjectUrl)
  const pasar = usarCaptura((s) => s.pasarAEmparejamiento)
  const [fotoAbierta, setFotoAbierta] = useState(false)
  const hayFoto = medioObjectUrl !== null
  const hayRenglones = lineas.length > 0

  return (
    <div
      className="border-t border-borde bg-papel px-4 py-3"
      data-testid="revision-texto-imagen"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-cuerpo font-bold text-tinta">
            Paso 1 — Texto extraído
          </p>
          <p className="font-mono text-etiqueta text-desvaida">
            Corrige lo leído antes de emparejar con el catálogo.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            data-testid="abrir-foto-captura"
            aria-label="Ver fotografía original"
            title="Ver fotografía original"
            disabled={!hayFoto}
            onClick={() => setFotoAbierta(true)}
            className={[
              CLASE_ICONO,
              hayFoto
                ? 'border border-borde text-tinta hover:bg-mesa'
                : 'cursor-not-allowed border border-borde text-desvaida',
            ].join(' ')}
          >
            <Image className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            data-testid="continuar-emparejamiento"
            aria-label="Emparejar productos"
            title="Emparejar productos"
            disabled={!hayRenglones}
            onClick={() => {
              pasar()
              onContinuar()
            }}
            className={[
              CLASE_ICONO,
              hayRenglones
                ? 'bg-tinta text-papel hover:bg-tinta/90'
                : 'cursor-not-allowed bg-mesa text-desvaida',
            ].join(' ')}
          >
            <Check className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Descartar captura"
            title="Descartar"
            onClick={onCancelar}
            className={[
              CLASE_ICONO,
              'text-desvaida hover:bg-mesa hover:text-tinta',
            ].join(' ')}
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
      </div>

      <Modal
        abierta={fotoAbierta && hayFoto}
        alCambiar={setFotoAbierta}
        titulo="Fotografía original"
        descripcion="Guía que se leyó. Ciérrala para seguir corrigiendo el texto."
      >
        {hayFoto ? (
          <img
            src={medioObjectUrl}
            alt="Fotografía original de la guía"
            className="mx-auto max-h-[min(70vh,36rem)] w-auto max-w-full object-contain"
          />
        ) : null}
      </Modal>
    </div>
  )
}

export function ListaPasoTextoExtraido() {
  const lineas = usarCaptura((s) => s.lineas)
  const actualizar = usarCaptura((s) => s.actualizarTextoOriginal)
  const quitar = usarCaptura((s) => s.quitarLinea)

  return (
    <div className="border-b border-borde bg-papel px-4 py-3">
      {lineas.length === 0 ? (
        <p className="text-cuerpo text-desvaida">
          No quedan renglones. Descarta la captura o vuelve a fotografiar.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {lineas.map((linea, indice) => (
            <li
              key={`texto-${indice}`}
              className="fila-entrada flex items-start gap-2"
            >
              <label className="min-w-0 flex-1 font-mono text-etiqueta text-desvaida">
                Renglón {indice + 1}
                <input
                  value={linea.textoOriginal}
                  onChange={(e) => actualizar(indice, e.target.value)}
                  className="mt-1 min-h-12 w-full rounded-lg border border-borde bg-mesa px-3 text-cuerpo text-tinta"
                />
              </label>
              <button
                type="button"
                data-testid={`quitar-renglon-texto-${indice}`}
                aria-label={`Quitar renglón ${indice + 1}`}
                title="Quitar renglón"
                onClick={() => quitar(indice)}
                className={[
                  CLASE_ICONO,
                  'self-end text-desvaida hover:bg-aviso/15 hover:text-aviso',
                ].join(' ')}
              >
                <X className="size-5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
