import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { AlineacionDeEntrenamiento } from '../../domain/aprendizaje/memoria.ts'
import type { DeltaDeMarca } from '../../domain/aprendizaje/priores.ts'
import { usarNotificaciones } from '../notificaciones/almacen.ts'
import {
  confirmarEntrenamientoFn,
  proponerEntrenamientoFn,
} from './aprendizaje.funciones.ts'
import {
  clasificarArchivo,
  ZonaDeCarga,
} from '../../ui/componentes/ZonaDeCarga.tsx'
import type {
  ArchivoElegido,
  EstadoDeCarga,
} from '../../ui/componentes/ZonaDeCarga.tsx'
import { Boton, Distintivo, Etiqueta } from '../../ui/componentes/primitivas.tsx'

const ACCEPT_ENTRENO =
  'application/pdf,.pdf,image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp'

function mimeDeArchivo(archivo: File): 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp' | null {
  const clase = clasificarArchivo(archivo)
  if (clase === 'pdf') return 'application/pdf'
  if (clase !== 'imagen') return null
  const tipo = archivo.type
  if (tipo === 'image/png') return 'image/png'
  if (tipo === 'image/webp') return 'image/webp'
  return 'image/jpeg'
}

async function archivoABase64(archivo: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const lector = new FileReader()
    lector.onload = () => resolve(String(lector.result ?? ''))
    lector.onerror = () => reject(lector.error)
    lector.readAsDataURL(archivo)
  })
  const coma = dataUrl.indexOf(',')
  return coma >= 0 ? dataUrl.slice(coma + 1) : dataUrl
}

async function ladoDesde(
  archivo: File | null,
  texto: string,
): Promise<{
  medio?: { mimeType: 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp'; dataBase64: string }
  texto?: string
} | null> {
  const recorte = texto.trim()
  if (archivo === null && recorte === '') return null
  if (archivo === null) return { texto: recorte }
  const mimeType = mimeDeArchivo(archivo)
  if (mimeType === null) return null
  const dataBase64 = await archivoABase64(archivo)
  return {
    medio: { mimeType, dataBase64 },
    ...(recorte !== '' ? { texto: recorte } : {}),
  }
}

function etiquetaEstado(estado: AlineacionDeEntrenamiento['estado']): string {
  if (estado === 'emparejado') return 'emparejado'
  if (estado === 'no_en_catalogo') return 'sin catálogo'
  return 'omitido'
}

export function EntrenarAprendizaje({
  onConfirmado,
}: {
  readonly onConfirmado: () => void
}) {
  const mostrar = usarNotificaciones((s) => s.mostrar)
  const [archivoPedido, setArchivoPedido] = useState<File | null>(null)
  const [archivoOro, setArchivoOro] = useState<File | null>(null)
  const [textoPedido, setTextoPedido] = useState('')
  const [textoOro, setTextoOro] = useState('')
  const [mostrarTextoPedido, setMostrarTextoPedido] = useState(false)
  const [mostrarTextoOro, setMostrarTextoOro] = useState(false)
  const [procesando, setProcesando] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [alineaciones, setAlineaciones] = useState<
    (AlineacionDeEntrenamiento & { incluida: boolean })[] | null
  >(null)
  const [marcas, setMarcas] = useState<(DeltaDeMarca & { incluida: boolean })[]>(
    [],
  )
  const [modelo, setModelo] = useState('simulado')
  const [cobertura, setCobertura] = useState<{
    pedidos: number
    cotizados: number
    omitidos: number
  } | null>(null)

  const ficha = (archivo: File | null): ArchivoElegido | null =>
    archivo === null
      ? null
      : {
          nombre: archivo.name,
          bytes: archivo.size,
          clase: clasificarArchivo(archivo) ?? 'pdf',
        }

  const estadoPedido: EstadoDeCarga =
    archivoPedido === null ? 'vacio' : procesando ? 'procesando' : 'listo'
  const estadoOro: EstadoDeCarga =
    archivoOro === null ? 'vacio' : procesando ? 'procesando' : 'listo'

  const hayPedido =
    archivoPedido !== null || textoPedido.trim() !== ''
  const hayOro = archivoOro !== null || textoOro.trim() !== ''

  async function procesar(): Promise<void> {
    if (!hayPedido || !hayOro || procesando) return
    setProcesando(true)
    try {
      const pedido = await ladoDesde(archivoPedido, textoPedido)
      const oro = await ladoDesde(archivoOro, textoOro)
      if (pedido === null || oro === null) {
        mostrar({ tono: 'error', mensaje: 'Revisa los archivos o el texto.' })
        return
      }
      const respuesta = await proponerEntrenamientoFn({
        data: { pedido, oro },
      })
      if (!respuesta.ok) {
        mostrar({
          tono: 'error',
          mensaje: respuesta.error.mensaje,
        })
        return
      }
      setAlineaciones(
        respuesta.alineaciones.map((fila) => ({ ...fila, incluida: true })),
      )
      setMarcas(respuesta.marcas.map((fila) => ({ ...fila, incluida: true })))
      setCobertura(respuesta.cobertura)
      setModelo(respuesta.modelo)
    } finally {
      setProcesando(false)
    }
  }

  async function confirmar(): Promise<void> {
    if (alineaciones === null || confirmando) return
    const elegidas = alineaciones.filter((a) => a.incluida)
    setConfirmando(true)
    try {
      const respuesta = await confirmarEntrenamientoFn({
        data: {
          alineaciones: elegidas.map(({ incluida: _incluida, ...fila }) => ({
            ...fila,
            aliases: [...fila.aliases],
            etiquetas: [...fila.etiquetas],
          })),
          modelo,
          marcasPermitidas: marcas
            .filter((m) => m.incluida)
            .map((m) => ({ familia: m.familia, marca: m.marca })),
        },
      })
      if (!respuesta.ok) {
        mostrar({
          tono: 'error',
          mensaje: respuesta.error.mensaje,
        })
        return
      }
      mostrar({
        tono: 'exito',
        mensaje: `Memoria actualizada. Cobertura ${respuesta.cobertura.cotizados}/${respuesta.cobertura.pedidos}.`,
      })
      setAlineaciones(null)
      setMarcas([])
      setCobertura(null)
      setArchivoPedido(null)
      setArchivoOro(null)
      setTextoPedido('')
      setTextoOro('')
      onConfirmado()
    } finally {
      setConfirmando(false)
    }
  }

  const propuestaAbierta = alineaciones !== null

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-mono text-etiqueta uppercase text-desvaida">
        Entrenar
      </h2>
      <p className="text-cuerpo text-desvaida">
        Pedido del cliente a un lado, cotización terminada al otro. Nada se
        escribe hasta que confirmes.
      </p>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <ZonaDeCarga
            titulo="Pedido del cliente"
            etiqueta="PDF o imagen del pedido"
            accept={ACCEPT_ENTRENO}
            aceptados={['pdf', 'imagen']}
            archivo={ficha(archivoPedido)}
            estado={estadoPedido}
            mensaje={null}
            deshabilitado={procesando || confirmando}
            ocultarEstadoSinError
            nota={
              <p className="text-center text-cuerpo text-desvaida">
                Mensaje, foto o PDF del requerimiento.
              </p>
            }
            onArchivo={setArchivoPedido}
            onQuitar={() => setArchivoPedido(null)}
          />
          <button
            type="button"
            className="self-start rounded-full px-3 py-1.5 text-cuerpo font-bold text-tinta transition-colors duration-rapida ease-salida hover:bg-mesa"
            onClick={() => setMostrarTextoPedido((v) => !v)}
            aria-expanded={mostrarTextoPedido}
          >
            {mostrarTextoPedido ? 'Ocultar mensaje' : 'Pegar mensaje'}
          </button>
          <div
            className="grid transition-[grid-template-rows] duration-media ease-salida motion-reduce:transition-none"
            style={{ gridTemplateRows: mostrarTextoPedido ? '1fr' : '0fr' }}
          >
            <div className="min-h-0 overflow-hidden">
              <Etiqueta htmlFor="texto-pedido-entreno">Mensaje del pedido</Etiqueta>
              <textarea
                id="texto-pedido-entreno"
                value={textoPedido}
                onChange={(evento) => setTextoPedido(evento.target.value)}
                rows={4}
                className="mt-1 w-full rounded-2xl border border-borde bg-papel px-3 py-2 text-cuerpo text-tinta"
                placeholder="Pega aquí el mensaje…"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <ZonaDeCarga
            titulo="Cotización terminada"
            etiqueta="PDF o imagen de la cotización oro"
            accept={ACCEPT_ENTRENO}
            aceptados={['pdf', 'imagen']}
            archivo={ficha(archivoOro)}
            estado={estadoOro}
            mensaje={null}
            deshabilitado={procesando || confirmando}
            ocultarEstadoSinError
            nota={
              <p className="text-center text-cuerpo text-desvaida">
                La cotización que sí se despachó.
              </p>
            }
            onArchivo={setArchivoOro}
            onQuitar={() => setArchivoOro(null)}
          />
          <button
            type="button"
            className="self-start rounded-full px-3 py-1.5 text-cuerpo font-bold text-tinta transition-colors duration-rapida ease-salida hover:bg-mesa"
            onClick={() => setMostrarTextoOro((v) => !v)}
            aria-expanded={mostrarTextoOro}
          >
            {mostrarTextoOro ? 'Ocultar texto' : 'Pegar texto de la cotización'}
          </button>
          <div
            className="grid transition-[grid-template-rows] duration-media ease-salida motion-reduce:transition-none"
            style={{ gridTemplateRows: mostrarTextoOro ? '1fr' : '0fr' }}
          >
            <div className="min-h-0 overflow-hidden">
              <Etiqueta htmlFor="texto-oro-entreno">Cotización en texto</Etiqueta>
              <textarea
                id="texto-oro-entreno"
                value={textoOro}
                onChange={(evento) => setTextoOro(evento.target.value)}
                rows={4}
                className="mt-1 w-full rounded-2xl border border-borde bg-papel px-3 py-2 text-cuerpo text-tinta"
                placeholder="Pega aquí la cotización…"
              />
            </div>
          </div>
        </div>
      </div>

      <Boton
        variante="principal"
        disabled={!hayPedido || !hayOro || procesando || confirmando}
        aria-busy={procesando || undefined}
        onClick={() => void procesar()}
      >
        {procesando ? (
          <Loader2 className="size-5 animate-spin" aria-hidden />
        ) : null}
        Procesar par
      </Boton>

      <div
        className="grid transition-[grid-template-rows] duration-media ease-salida motion-reduce:transition-none"
        style={{ gridTemplateRows: propuestaAbierta ? '1fr' : '0fr' }}
      >
        <div className="min-h-0 overflow-hidden">
          {alineaciones !== null && cobertura !== null ? (
            <div className="mt-2 flex flex-col gap-4 rounded-2xl border border-borde bg-papel px-4 py-4">
              <p className="text-cuerpo text-tinta">
                Cobertura{' '}
                <span className="font-bold">
                  {cobertura.cotizados}/{cobertura.pedidos}
                </span>
                {cobertura.omitidos > 0
                  ? ` · ${cobertura.omitidos} sin par en la cotización`
                  : null}
              </p>
              <ul className="flex flex-col gap-2">
                {alineaciones.map((fila, indice) => (
                  <li
                    key={`${fila.textoPedido}-${indice}`}
                    className="rounded-2xl border border-borde bg-mesa px-3 py-3"
                  >
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1 size-4 accent-tinta"
                        checked={fila.incluida}
                        onChange={() =>
                          setAlineaciones((prev) =>
                            prev?.map((cada, i) =>
                              i === indice
                                ? { ...cada, incluida: !cada.incluida }
                                : cada,
                            ) ?? null,
                          )
                        }
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <Distintivo
                            tono={
                              fila.estado === 'emparejado' ? 'sello' : 'desvaida'
                            }
                          >
                            {etiquetaEstado(fila.estado)}
                          </Distintivo>
                          {fila.codigo !== '' ? (
                            <span className="font-mono font-bold text-tinta">
                              {fila.codigo}
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-1 block text-cuerpo text-tinta">
                          {fila.textoPedido}
                        </span>
                        {fila.aliases.length > 0 ? (
                          <span className="mt-1 block font-mono text-etiqueta text-desvaida">
                            {fila.aliases.join(' · ')}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              {marcas.length > 0 ? (
                <div>
                  <h3 className="mb-2 font-mono text-etiqueta uppercase text-desvaida">
                    Priores de marca
                  </h3>
                  <ul className="flex flex-col gap-2">
                    {marcas.map((fila, indice) => (
                      <li key={`${fila.familia}-${fila.marca}`}>
                        <label className="flex cursor-pointer items-center gap-3 text-cuerpo">
                          <input
                            type="checkbox"
                            className="size-4 accent-tinta"
                            checked={fila.incluida}
                            onChange={() =>
                              setMarcas((prev) =>
                                prev.map((cada, i) =>
                                  i === indice
                                    ? { ...cada, incluida: !cada.incluida }
                                    : cada,
                                ),
                              )
                            }
                          />
                          <span>
                            {fila.marca}{' '}
                            <span className="text-desvaida">
                              ({fila.familia} · +{fila.delta})
                            </span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <Boton
                variante="principal"
                disabled={confirmando || alineaciones.every((a) => !a.incluida)}
                aria-busy={confirmando || undefined}
                onClick={() => void confirmar()}
              >
                {confirmando ? (
                  <Loader2 className="size-5 animate-spin" aria-hidden />
                ) : null}
                Confirmar aprendizajes
              </Boton>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
