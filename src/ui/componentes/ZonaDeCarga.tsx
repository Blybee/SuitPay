/**
 * Drop zone Soft-Pill. Un archivo por omisión; `multiple` acumula varios
 * (pedido de entrenamiento con varias fotos). Estados: vacío, arrastrando,
 * procesando, listo, error. El file picker nativo queda oculto.
 */
import { useId, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent, ReactNode } from 'react'
import { FileImage, FileJson, FileText, FileUp, X } from 'lucide-react'
import { Boton, Distintivo, Etiqueta } from './primitivas.tsx'

export type ClaseDeArchivo = 'json' | 'pdf' | 'imagen'
export type EstadoDeCarga = 'vacio' | 'procesando' | 'listo' | 'error'

const ACEPTADOS_DEFECTO: readonly ClaseDeArchivo[] = ['json', 'pdf']

export interface ArchivoElegido {
  readonly nombre: string
  readonly bytes: number
  readonly clase: ClaseDeArchivo
}

type ZonaComun = {
  readonly titulo?: string
  readonly accionCabecera?: ReactNode
  readonly etiqueta: string
  readonly nota?: ReactNode
  readonly ocultarEtiqueta?: boolean
  readonly ocultarEstadoSinError?: boolean
  readonly accept?: string
  readonly aceptados?: readonly ClaseDeArchivo[]
  readonly estado: EstadoDeCarga
  readonly mensaje: string | null
  readonly deshabilitado?: boolean
}

export type ZonaDeCargaProps = ZonaComun &
  (
    | {
        readonly multiple?: false
        readonly archivo: ArchivoElegido | null
        readonly onArchivo: (archivo: File) => void
        readonly onQuitar: () => void
      }
    | {
        readonly multiple: true
        readonly archivos: readonly ArchivoElegido[]
        readonly maxArchivos?: number
        readonly onArchivos: (archivos: readonly File[]) => void
        readonly onQuitar: (indice: number) => void
      }
  )

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
  if (
    archivo.type === 'image/jpeg' ||
    archivo.type === 'image/png' ||
    archivo.type === 'image/webp' ||
    nombre.endsWith('.jpg') ||
    nombre.endsWith('.jpeg') ||
    nombre.endsWith('.png') ||
    nombre.endsWith('.webp')
  ) {
    return 'imagen'
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

export function archivosValidos(
  lista: FileList | readonly File[],
  aceptados: readonly ClaseDeArchivo[],
): File[] {
  const salida: File[] = []
  for (const archivo of Array.from(lista)) {
    const clase = clasificarArchivo(archivo)
    if (clase !== null && aceptados.includes(clase)) salida.push(archivo)
  }
  return salida
}

function yaEstaEnLista(
  archivo: File,
  lista: readonly ArchivoElegido[],
): boolean {
  return lista.some(
    (cada) => cada.nombre === archivo.name && cada.bytes === archivo.size,
  )
}

function arrastreEsRechazable(
  transfer: DataTransfer | null,
  aceptados: readonly ClaseDeArchivo[],
): boolean {
  if (transfer === null) return false
  const items = Array.from(transfer.items).filter(
    (item) => item.kind === 'file',
  )
  if (items.length === 0) return false
  return items.every((item) => {
    if (item.type === '' || item.type === 'application/octet-stream') {
      return false
    }
    if (item.type === 'application/pdf') return !aceptados.includes('pdf')
    if (item.type === 'application/json' || item.type === 'text/json') {
      return !aceptados.includes('json')
    }
    if (
      item.type === 'image/jpeg' ||
      item.type === 'image/png' ||
      item.type === 'image/webp'
    ) {
      return !aceptados.includes('imagen')
    }
    return true
  })
}

function textoRechazo(aceptados: readonly ClaseDeArchivo[]): string {
  if (aceptados.includes('pdf') && aceptados.includes('imagen') && aceptados.length === 2) {
    return 'Solo se aceptan PDF o imagen.'
  }
  if (aceptados.length === 1 && aceptados[0] === 'pdf') {
    return 'Solo se aceptan PDF.'
  }
  if (aceptados.length === 1 && aceptados[0] === 'json') {
    return 'Solo se aceptan JSON.'
  }
  if (aceptados.length === 1 && aceptados[0] === 'imagen') {
    return 'Solo se aceptan imágenes.'
  }
  return 'Solo se aceptan JSON o PDF.'
}

function textoPozoVacio(
  aceptados: readonly ClaseDeArchivo[],
  multiple: boolean,
): string {
  if (aceptados.includes('pdf') && aceptados.includes('imagen') && aceptados.length === 2) {
    return multiple ? 'Suelta el PDF o las imágenes' : 'Suelta el PDF o la imagen'
  }
  if (aceptados.length === 1 && aceptados[0] === 'pdf') return 'Suelta el PDF'
  if (aceptados.length === 1 && aceptados[0] === 'json') return 'Suelta el JSON'
  if (aceptados.length === 1 && aceptados[0] === 'imagen') {
    return multiple ? 'Suelta las imágenes' : 'Suelta la imagen'
  }
  return 'Suelta el JSON o el PDF'
}

function arrastreTieneArchivos(transfer: DataTransfer | null): boolean {
  if (transfer === null) return false
  return Array.from(transfer.types).includes('Files')
}

function arrastreDeTipo(
  aceptados: readonly ClaseDeArchivo[],
): string {
  if (aceptados.includes('json') && aceptados.includes('pdf')) {
    return 'un JSON o un PDF'
  }
  if (aceptados.includes('pdf') && aceptados.includes('imagen')) {
    return 'un PDF o una imagen'
  }
  if (aceptados.includes('pdf')) return 'un PDF'
  if (aceptados.includes('imagen')) return 'una imagen'
  return 'un JSON'
}

export function ZonaDeCarga(props: ZonaDeCargaProps) {
  const {
    titulo,
    accionCabecera,
    etiqueta,
    nota,
    ocultarEtiqueta = false,
    ocultarEstadoSinError = false,
    accept = 'application/json,.json,.js,application/pdf,.pdf',
    aceptados = ACEPTADOS_DEFECTO,
    estado,
    mensaje,
    deshabilitado = false,
  } = props
  const multiple = props.multiple === true
  const lista: readonly ArchivoElegido[] = multiple
    ? props.archivos
    : props.archivo === null
      ? []
      : [props.archivo]
  const maxArchivos = multiple ? (props.maxArchivos ?? 8) : 1
  const lleno = multiple && lista.length >= maxArchivos

  const id = useId()
  const ayudaId = `${id}-ayuda`
  const estadoId = `${id}-estado`
  const inputRef = useRef<HTMLInputElement>(null)
  const entradasDeArrastre = useRef(0)
  const [arrastrando, setArrastrando] = useState(false)
  const [rechazoLocal, setRechazoLocal] = useState<string | null>(null)

  const ocupado = estado === 'procesando' || deshabilitado
  const vacio = lista.length === 0 && estado === 'vacio'
  const errorVisible = rechazoLocal ?? (estado === 'error' ? mensaje : null)
  const arrastreInvalido =
    arrastrando && (rechazoLocal === 'tipo-arrastre' || rechazoLocal === 'lleno')
  const pozoHormigas =
    vacio && !arrastrando && !arrastreInvalido && rechazoLocal === null

  function abrirSelector(): void {
    if (ocupado || lleno) return
    inputRef.current?.click()
  }

  function entregar(archivos: FileList | readonly File[] | null): void {
    if (archivos === null || ocupado) return
    const validos = archivosValidos(archivos, aceptados)
    if (validos.length === 0) {
      setRechazoLocal(textoRechazo(aceptados))
      return
    }
    if (props.multiple === true) {
      if (lista.length >= maxArchivos) {
        setRechazoLocal(`Máximo ${maxArchivos} archivos.`)
        return
      }
      const cupo = maxArchivos - lista.length
      const nuevos = validos.filter((cada) => !yaEstaEnLista(cada, lista))
      const tomados = nuevos.slice(0, cupo)
      if (tomados.length === 0) {
        setRechazoLocal(
          nuevos.length === 0
            ? 'Ese archivo ya está en la lista.'
            : `Máximo ${maxArchivos} archivos.`,
        )
        return
      }
      setRechazoLocal(
        validos.length > tomados.length && lista.length + tomados.length >= maxArchivos
          ? `Máximo ${maxArchivos} archivos. Se añadieron ${tomados.length}.`
          : null,
      )
      if (inputRef.current !== null) inputRef.current.value = ''
      props.onArchivos(tomados)
      return
    }
    setRechazoLocal(null)
    if (inputRef.current !== null) inputRef.current.value = ''
    const primero = validos[0]
    if (primero !== undefined) props.onArchivo(primero)
  }

  function alCambiarInput(evento: ChangeEvent<HTMLInputElement>): void {
    entregar(evento.target.files)
  }

  function marcarArrastre(transfer: DataTransfer | null): boolean {
    const invalidoTipo = arrastreEsRechazable(transfer, aceptados)
    const invalidoCupo = multiple && lista.length >= maxArchivos
    if (invalidoTipo) setRechazoLocal('tipo-arrastre')
    else if (invalidoCupo) setRechazoLocal('lleno')
    return invalidoTipo || invalidoCupo
  }

  function alArrastrarEncima(evento: DragEvent<HTMLElement>): void {
    if (!arrastreTieneArchivos(evento.dataTransfer) || ocupado) return
    evento.preventDefault()
    const invalido = marcarArrastre(evento.dataTransfer)
    evento.dataTransfer.dropEffect = invalido ? 'none' : 'copy'
  }

  function alEntrarArrastre(evento: DragEvent<HTMLElement>): void {
    if (!arrastreTieneArchivos(evento.dataTransfer) || ocupado) return
    evento.preventDefault()
    entradasDeArrastre.current += 1
    setArrastrando(true)
    marcarArrastre(evento.dataTransfer)
  }

  function alSalirArrastre(evento: DragEvent<HTMLElement>): void {
    if (!arrastreTieneArchivos(evento.dataTransfer)) return
    evento.preventDefault()
    entradasDeArrastre.current = Math.max(0, entradasDeArrastre.current - 1)
    if (entradasDeArrastre.current === 0) {
      setArrastrando(false)
      if (rechazoLocal === 'tipo-arrastre' || rechazoLocal === 'lleno') {
        setRechazoLocal(null)
      }
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

  function quitarEn(indice: number): void {
    if (props.multiple === true) props.onQuitar(indice)
    else props.onQuitar()
  }

  const clasesPozo = unir(
    'relative flex w-full flex-col rounded-2xl border border-dashed bg-mesa',
    'transition-[border-color,background-color,box-shadow] duration-rapida ease-salida',
    'focus-visible:border-solid focus-visible:border-tinta',
    arrastreInvalido && 'border-aviso bg-aviso/10',
    arrastrando &&
      !arrastreInvalido &&
      'border-solid border-tinta bg-tinta/5 shadow-sm',
    !arrastrando &&
      !arrastreInvalido &&
      (estado === 'error' || rechazoLocal !== null
        ? 'border-aviso'
        : pozoHormigas
          ? 'border-transparent'
          : 'border-tinta/40'),
    ocupado && 'cursor-not-allowed opacity-70',
    !ocupado && vacio && 'cursor-pointer',
  )

  return (
    <div className="flex flex-col gap-3">
      {titulo !== undefined || accionCabecera !== undefined ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {titulo !== undefined ? (
            <h2 className="text-cabecera font-bold text-tinta">{titulo}</h2>
          ) : null}
          {accionCabecera}
        </div>
      ) : null}
      <Etiqueta
        htmlFor={id}
        className={
          titulo !== undefined || ocultarEtiqueta ? 'sr-only' : undefined
        }
      >
        {etiqueta}
      </Etiqueta>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        multiple={multiple || undefined}
        tabIndex={-1}
        disabled={ocupado || lleno}
        className="sr-only"
        aria-describedby={`${ayudaId} ${estadoId}`}
        aria-invalid={errorVisible !== null || undefined}
        onChange={alCambiarInput}
      />
      <span id={ayudaId} className="sr-only">
        {aceptados.includes('pdf') && aceptados.includes('imagen')
          ? multiple
            ? 'PDF o varias imágenes del requerimiento del cliente'
            : 'PDF o imagen del requerimiento del cliente'
          : aceptados.length === 1 && aceptados[0] === 'pdf'
          ? 'PDF de requerimiento del cliente'
          : 'JSON de la tienda virtual o PDF de productos (SICO)'}
      </span>

      {vacio ? (
        <div
          className={unir(
            clasesPozo,
            'zona-carga-pozo min-h-52 items-center justify-center gap-5 px-6 py-8',
          )}
          onClick={ocupado ? undefined : abrirSelector}
          onDragEnter={alEntrarArrastre}
          onDragLeave={alSalirArrastre}
          onDragOver={alArrastrarEncima}
          onDrop={alSoltar}
        >
          {pozoHormigas ? <BordeHormigas /> : null}
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
              ? rechazoLocal === 'lleno'
                ? `Máximo ${maxArchivos} archivos`
                : 'Ese archivo no sirve'
              : arrastrando
                ? 'Suelta para cargar'
                : textoPozoVacio(aceptados, multiple)}
          </p>
          {arrastreInvalido ? (
            <p className="text-center text-cuerpo font-bold text-aviso">
              {rechazoLocal === 'lleno'
                ? `Quita alguno para añadir otro (máximo ${maxArchivos}).`
                : textoRechazo(aceptados)}
            </p>
          ) : nota !== undefined ? (
            <div
              className={unir(
                'w-full max-w-md transition-opacity duration-rapida ease-salida',
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
            {multiple ? 'Elegir archivos' : 'Elegir archivo'}
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
          <ul className="flex flex-col divide-y divide-borde">
            {lista.map((archivo, indice) => (
              <li
                key={`${archivo.nombre}-${archivo.bytes}-${indice}`}
                className="fila-entrada"
              >
                <FichaDeArchivo
                  archivo={archivo}
                  estado={estado}
                  ocupado={ocupado}
                  arrastrando={arrastrando && !arrastreInvalido}
                  mostrarCambiar={!multiple}
                  onCambiar={abrirSelector}
                  onQuitar={() => quitarEn(indice)}
                  etiquetaQuitar={
                    multiple ? `Quitar ${archivo.nombre}` : 'Quitar archivo'
                  }
                />
              </li>
            ))}
          </ul>

          {multiple ? (
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <p className="font-mono text-etiqueta uppercase tracking-widest text-desvaida">
                {lista.length} de {maxArchivos} archivos
              </p>
              <Boton
                variante="secundario"
                disabled={ocupado || lleno || arrastrando}
                onClick={abrirSelector}
              >
                Añadir
              </Boton>
            </div>
          ) : null}

          {estado === 'procesando' ? <BarraIndeterminada /> : null}

          {arrastrando && lista.length > 0 ? (
            <p className="px-5 pb-4 text-cuerpo text-tinta">
              {arrastreInvalido
                ? rechazoLocal === 'lleno'
                  ? `Máximo ${maxArchivos} archivos.`
                  : textoRechazo(aceptados)
                : multiple
                  ? 'Suelta para añadir.'
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
          ocultarEstadoSinError && errorVisible === null && 'hidden',
          errorVisible !== null ? 'font-bold text-aviso' : 'text-desvaida',
        )}
      >
        {textoDeEstado({
          estado,
          mensaje,
          rechazoLocal,
          vacio,
          clase: lista[0]?.clase,
          aceptados,
          maxArchivos,
        })}
      </p>
    </div>
  )
}

function BordeHormigas() {
  return (
    <svg className="zona-carga-hormigas" aria-hidden>
      <rect
        className="zona-carga-hormigas-trazo"
        x="1"
        y="1"
        width="calc(100% - 2px)"
        height="calc(100% - 2px)"
        rx="16"
        ry="16"
      />
    </svg>
  )
}

function FichaDeArchivo({
  archivo,
  estado,
  ocupado,
  arrastrando,
  mostrarCambiar,
  onCambiar,
  onQuitar,
  etiquetaQuitar,
}: {
  readonly archivo: ArchivoElegido
  readonly estado: EstadoDeCarga
  readonly ocupado: boolean
  readonly arrastrando: boolean
  readonly mostrarCambiar: boolean
  readonly onCambiar: () => void
  readonly onQuitar: () => void
  readonly etiquetaQuitar: string
}) {
  const Icono =
    archivo.clase === 'pdf'
      ? FileText
      : archivo.clase === 'imagen'
        ? FileImage
        : FileJson

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-4 sm:flex-nowrap">
      <span
        className={unir(
          'flex size-12 shrink-0 items-center justify-center rounded-full border bg-papel',
          estado === 'error'
            ? 'border-aviso text-aviso'
            : 'border-borde text-tinta',
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
            tono={
              estado === 'error'
                ? 'aviso'
                : estado === 'listo'
                  ? 'sello'
                  : 'desvaida'
            }
          >
            {archivo.clase === 'pdf'
              ? 'PDF'
              : archivo.clase === 'imagen'
                ? 'IMG'
                : 'JSON'}
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
        {mostrarCambiar ? (
          <Boton
            variante="secundario"
            disabled={ocupado || arrastrando}
            onClick={onCambiar}
          >
            Cambiar
          </Boton>
        ) : null}
        <Boton
          variante="discreto"
          disabled={ocupado || arrastrando}
          aria-label={etiquetaQuitar}
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
  aceptados,
  maxArchivos,
}: {
  readonly estado: EstadoDeCarga
  readonly mensaje: string | null
  readonly rechazoLocal: string | null
  readonly vacio: boolean
  readonly clase: ClaseDeArchivo | undefined
  readonly aceptados: readonly ClaseDeArchivo[]
  readonly maxArchivos: number
}): string {
  if (rechazoLocal === 'tipo-arrastre') {
    return `Ese tipo no entra. Arrastra ${arrastreDeTipo(aceptados)}.`
  }
  if (rechazoLocal === 'lleno') {
    return `Máximo ${maxArchivos} archivos.`
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
