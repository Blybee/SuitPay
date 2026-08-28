/**
 * Drop zone Soft-Pill de un solo archivo.
 * Estados: vacío, arrastrando, procesando, listo, error.
 * El file picker nativo queda oculto; Cambiar / Quitar no abren el diálogo
 * salvo el propio Cambiar.
 */
import { useId, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent, ReactNode } from 'react'
import { FileJson, FileText, FileUp, X } from 'lucide-react'
import { Boton, Distintivo, Etiqueta } from './primitivas.tsx'

export type ClaseDeArchivo = 'json' | 'pdf'
export type EstadoDeCarga = 'vacio' | 'procesando' | 'listo' | 'error'

export interface ArchivoElegido {
  readonly nombre: string
  readonly bytes: number
  readonly clase: ClaseDeArchivo
}

export function clasificarArchivo(archivo: File): ClaseDeArchivo | null {
  const nombre = archivo.name.toLowerCase()
  if (archivo.type === 'application/pdf' || nombre.endsWith('.pdf')) {
    return 'pdf'
  }
  if (
    archivo.type === 'application/json' ||
    archivo.type === 'text/json' ||
    nombre.endsWith('.json') ||
    nombre.endsWith('.js')
  ) {
    return 'json'
  }
  return null
}

export function formatearTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`
  }
  const megas = bytes / (1024 * 1024)
  return `${megas < 10 ? megas.toFixed(1) : Math.round(megas)} MB`
}

function unir(...clases: readonly (string | false | undefined)[]): string {
  return clases.filter((cada) => typeof cada === 'string').join(' ')
}

function primerArchivoValido(
  lista: FileList | readonly File[],
): File | null {
  const archivos = Array.from(lista)
  for (const archivo of archivos) {
    if (clasificarArchivo(archivo) !== null) return archivo
  }
  return null
}

function arrastreTieneArchivos(transfer: DataTransfer | null): boolean {
  if (transfer === null) return false
  return Array.from(transfer.types).includes('Files')
}

function arrastreEsRechazable(transfer: DataTransfer | null): boolean {
  if (transfer === null) return false
  const items = Array.from(transfer.items).filter((item) => item.kind === 'file')
  if (items.length === 0) return false
  return items.every((item) => {
    if (item.type === '' || item.type === 'application/octet-stream') {
      return false
    }
    return (
      item.type !== 'application/pdf' &&
      item.type !== 'application/json' &&
      item.type !== 'text/json'
    )
  })
}

export function ZonaDeCarga({
  titulo,
  etiqueta,
  nota,
  accept = 'application/json,.json,.js,application/pdf,.pdf',
  archivo,
  estado,
  mensaje,
  deshabilitado = false,
  onArchivo,
  onQuitar,
}: {
  readonly titulo?: string
  readonly etiqueta: string
  readonly nota?: ReactNode
  readonly accept?: string
  readonly archivo: ArchivoElegido | null
  readonly estado: EstadoDeCarga
  readonly mensaje: string | null
  readonly deshabilitado?: boolean
  readonly onArchivo: (archivo: File) => void
  readonly onQuitar: () => void
}) {
  const id = useId()
  const ayudaId = `${id}-ayuda`
  const estadoId = `${id}-estado`
  const inputRef = useRef<HTMLInputElement>(null)
  const entradasDeArrastre = useRef(0)
  const [arrastrando, setArrastrando] = useState(false)
  const [rechazoLocal, setRechazoLocal] = useState<string | null>(null)

  const ocupado = estado === 'procesando' || deshabilitado
  const vacio = archivo === null && estado === 'vacio'
  const errorVisible = rechazoLocal ?? (estado === 'error' ? mensaje : null)
  const arrastreInvalido = arrastrando && rechazoLocal === 'tipo-arrastre'

  function abrirSelector(): void {
    if (ocupado) return
    inputRef.current?.click()
  }

  function entregar(lista: FileList | readonly File[] | null): void {
    if (lista === null || ocupado) return
    const elegido = primerArchivoValido(lista)
    if (elegido === null) {
      setRechazoLocal('Solo se aceptan JSON o PDF.')
      return
    }
    setRechazoLocal(null)
    if (inputRef.current !== null) inputRef.current.value = ''
    onArchivo(elegido)
  }

  function alCambiarInput(evento: ChangeEvent<HTMLInputElement>): void {
    entregar(evento.target.files)
  }

  function alArrastrarEncima(evento: DragEvent<HTMLElement>): void {
    if (!arrastreTieneArchivos(evento.dataTransfer) || ocupado) return
    evento.preventDefault()
    const invalido = arrastreEsRechazable(evento.dataTransfer)
    evento.dataTransfer.dropEffect = invalido ? 'none' : 'copy'
    if (invalido) setRechazoLocal('tipo-arrastre')
  }

  function alEntrarArrastre(evento: DragEvent<HTMLElement>): void {
    if (!arrastreTieneArchivos(evento.dataTransfer) || ocupado) return
    evento.preventDefault()
    entradasDeArrastre.current += 1
    setArrastrando(true)
    if (arrastreEsRechazable(evento.dataTransfer)) {
      setRechazoLocal('tipo-arrastre')
    }
  }

  function alSalirArrastre(evento: DragEvent<HTMLElement>): void {
    if (!arrastreTieneArchivos(evento.dataTransfer)) return
    evento.preventDefault()
    entradasDeArrastre.current = Math.max(0, entradasDeArrastre.current - 1)
    if (entradasDeArrastre.current === 0) {
      setArrastrando(false)
      if (rechazoLocal === 'tipo-arrastre') setRechazoLocal(null)
    }
  }

  function alSoltar(evento: DragEvent<HTMLElement>): void {
    if (!arrastreTieneArchivos(evento.dataTransfer)) return
    evento.preventDefault()
    entradasDeArrastre.current = 0
    setArrastrando(false)
    if (ocupado) return
    const files = Array.from(evento.dataTransfer.items)
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null)
    entregar(files.length > 0 ? files : evento.dataTransfer.files)
  }

  const clasesPozo = unir(
    'relative flex w-full flex-col rounded-2xl border border-dashed bg-mesa',
    'transition-[border-color,background-color,box-shadow] duration-200 ease-out',
    'focus-visible:border-solid focus-visible:border-tinta',
    arrastreInvalido && 'border-aviso bg-aviso/10',
    arrastrando &&
      !arrastreInvalido &&
      'border-solid border-tinta bg-tinta/5 shadow-sm',
    !arrastrando &&
      !arrastreInvalido &&
      (estado === 'error' || rechazoLocal !== null
        ? 'border-aviso'
        : 'border-borde hover:border-tinta/40'),
    ocupado && 'cursor-not-allowed opacity-70',
    !ocupado && vacio && 'cursor-pointer',
  )

  return (
    <div className="flex flex-col gap-3">
      {titulo !== undefined ? (
        <h2 className="text-cabecera font-bold text-tinta">{titulo}</h2>
      ) : null}
      <Etiqueta
        htmlFor={id}
        className={titulo !== undefined ? 'sr-only' : undefined}
      >
        {etiqueta}
      </Etiqueta>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        tabIndex={-1}
        disabled={ocupado}
        className="sr-only"
        aria-describedby={`${ayudaId} ${estadoId}`}
        aria-invalid={errorVisible !== null || undefined}
        onChange={alCambiarInput}
      />
      <span id={ayudaId} className="sr-only">
        JSON de la tienda virtual o PDF de productos (SICO)
      </span>

      {vacio ? (
        <div
          className={unir(
            clasesPozo,
            'min-h-52 items-center justify-center gap-5 px-6 py-8',
          )}
          onClick={ocupado ? undefined : abrirSelector}
          onDragEnter={alEntrarArrastre}
          onDragLeave={alSalirArrastre}
          onDragOver={alArrastrarEncima}
          onDrop={alSoltar}
        >
          <span
            className={unir(
              'flex size-14 items-center justify-center rounded-full border bg-papel',
              arrastreInvalido
                ? 'border-aviso text-aviso'
                : arrastrando
                  ? 'border-tinta text-tinta'
                  : 'border-borde text-desvaida',
            )}
            aria-hidden
          >
            <FileUp className="size-6" strokeWidth={2} />
          </span>
          <p className="text-center text-renglon font-bold text-tinta">
            {arrastreInvalido
              ? 'Ese archivo no sirve'
              : arrastrando
                ? 'Suelta para cargar'
                : 'Suelta el JSON o el PDF'}
          </p>
          {arrastreInvalido ? (
            <p className="text-center text-cuerpo font-bold text-aviso">
              Solo JSON de la tienda virtual o PDF de productos (SICO)
            </p>
          ) : nota !== undefined ? (
            <div
              className={unir(
                'w-full max-w-md transition-opacity duration-200 ease-out',
                arrastrando && 'opacity-40',
              )}
            >
              {nota}
            </div>
          ) : null}
          <Boton
            variante="principal"
            disabled={ocupado}
            onClick={(evento) => {
              evento.stopPropagation()
              abrirSelector()
            }}
          >
            Elegir archivo
          </Boton>
        </div>
      ) : (
        <div
          className={unir(clasesPozo, 'min-h-0 overflow-hidden')}
          onDragEnter={alEntrarArrastre}
          onDragLeave={alSalirArrastre}
          onDragOver={alArrastrarEncima}
          onDrop={alSoltar}
          aria-busy={estado === 'procesando' || undefined}
        >
          {archivo !== null ? (
            <FichaDeArchivo
              archivo={archivo}
              estado={estado}
              ocupado={ocupado}
              arrastrando={arrastrando && !arrastreInvalido}
              onCambiar={abrirSelector}
              onQuitar={onQuitar}
            />
          ) : null}

          {estado === 'procesando' ? <BarraIndeterminada /> : null}

          {arrastrando && archivo !== null ? (
            <p className="px-5 pb-4 text-cuerpo text-tinta">
              {arrastreInvalido
                ? 'Solo JSON o PDF.'
                : 'Suelta para reemplazar el archivo.'}
            </p>
          ) : null}
        </div>
      )}

      <p
        id={estadoId}
        role={errorVisible !== null ? 'alert' : undefined}
        aria-live="polite"
        className={unir(
          'text-cuerpo',
          errorVisible !== null ? 'font-bold text-aviso' : 'text-desvaida',
        )}
      >
        {textoDeEstado({
          estado,
          mensaje,
          rechazoLocal,
          vacio,
          clase: archivo?.clase,
        })}
      </p>
    </div>
  )
}

function FichaDeArchivo({
  archivo,
  estado,
  ocupado,
  arrastrando,
  onCambiar,
  onQuitar,
}: {
  readonly archivo: ArchivoElegido
  readonly estado: EstadoDeCarga
  readonly ocupado: boolean
  readonly arrastrando: boolean
  readonly onCambiar: () => void
  readonly onQuitar: () => void
}) {
  const Icono = archivo.clase === 'pdf' ? FileText : FileJson

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-4 sm:flex-nowrap">
      <span
        className={unir(
          'flex size-12 shrink-0 items-center justify-center rounded-full border bg-papel',
          estado === 'error' ? 'border-aviso text-aviso' : 'border-borde text-tinta',
        )}
        aria-hidden
      >
        <Icono className="size-5" strokeWidth={2} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-cuerpo font-bold text-tinta">
          {archivo.nombre}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-2 font-mono text-etiqueta text-desvaida">
          <Distintivo
            tono={estado === 'error' ? 'aviso' : estado === 'listo' ? 'sello' : 'desvaida'}
          >
            {archivo.clase === 'pdf' ? 'PDF' : 'JSON'}
          </Distintivo>
          <span className="uppercase tracking-widest">
            {formatearTamano(archivo.bytes)}
          </span>
          {estado === 'listo' ? (
            <span className="uppercase tracking-widest text-sello">
              listo para revisar
            </span>
          ) : null}
          {estado === 'procesando' ? (
            <span className="uppercase tracking-widest">leyendo…</span>
          ) : null}
        </p>
      </div>

      <div className="flex shrink-0 flex-wrap gap-2">
        <Boton
          variante="secundario"
          disabled={ocupado || arrastrando}
          onClick={onCambiar}
        >
          Cambiar
        </Boton>
        <Boton
          variante="discreto"
          disabled={ocupado || arrastrando}
          aria-label="Quitar archivo"
          onClick={onQuitar}
        >
          <X className="size-5" strokeWidth={2.25} aria-hidden />
          Quitar
        </Boton>
      </div>
    </div>
  )
}

function BarraIndeterminada() {
  return (
    <div
      className="barra-carga-indeterminada mx-4 mb-4"
      role="progressbar"
      aria-label="Procesando archivo"
    >
      <span />
    </div>
  )
}

function textoDeEstado({
  estado,
  mensaje,
  rechazoLocal,
  vacio,
  clase,
}: {
  readonly estado: EstadoDeCarga
  readonly mensaje: string | null
  readonly rechazoLocal: string | null
  readonly vacio: boolean
  readonly clase: ClaseDeArchivo | undefined
}): string {
  if (rechazoLocal === 'tipo-arrastre') {
    return 'Ese tipo no entra. Arrastra un JSON o un PDF.'
  }
  if (rechazoLocal !== null) return rechazoLocal
  if (estado === 'error' && mensaje !== null) return mensaje
  if (estado === 'procesando') {
    return clase === 'pdf'
      ? 'Interpretando el PDF. Las filas aparecen cuando termina; no se publica todavía.'
      : 'Validando el catálogo. Nada se aplica hasta que confirmes.'
  }
  if (estado === 'listo') {
    return 'Revisa filas y categorías abajo. Publicar es el único paso que escribe.'
  }
  if (vacio) return ''
  return mensaje ?? ''
}
