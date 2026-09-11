import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { CabeceraAdmin } from '../../features/administracion/cabecera-admin.tsx'
import { usarNotificaciones } from '../../features/notificaciones/almacen.ts'
import { GuardaSesion } from '../../features/sesion/GuardaSesion.tsx'
import {
  crearEstablecimientoFn,
  crearSerieFn,
  desactivarSerieFn,
  eliminarEstablecimientoFn,
  listarEstablecimientosFn,
  listarSeriesFn,
} from '../../features/series/series.funciones.ts'
import type {
  Establecimiento,
  SerieAdministrativa,
} from '../../features/series/series.funciones.ts'
import { listarUsuariosFn } from '../../features/usuarios/usuarios.funciones.ts'
import type { UsuarioListado } from '../../features/usuarios/usuarios.funciones.ts'
import {
  idDeSerie,
  tipoDeSerieEsCompartida,
} from '../../domain/documentos/tipos.ts'
import { Boton, Campo, Etiqueta } from '../../ui/componentes/primitivas.tsx'
import type { PropsDeBoton } from '../../ui/componentes/primitivas.tsx'
import { Selector } from '../../ui/componentes/Selector.tsx'

/**
 * Establecimientos y series (T083 / FR-031 / decisión 12).
 * Boleta/factura: una serie por vendedor. Guía y nota de venta: correlativo
 * compartido. En DEMO las reguladas se guardan en Firestore sin sync al
 * proveedor (docs/FASE-OPERACION.md).
 */

export const Route = createFileRoute('/administracion/series')({
  component: () => (
    <GuardaSesion roles={['administrador']}>
      <PantallaDeSeries />
    </GuardaSesion>
  ),
})

function avisar(tono: 'exito' | 'error' | 'info', mensaje: string): void {
  usarNotificaciones.getState().mostrar({ tono, mensaje })
}

function PantallaDeSeries() {
  const [establecimientos, setEstablecimientos] = useState<
    readonly Establecimiento[]
  >([])
  const [series, setSeries] = useState<readonly SerieAdministrativa[]>([])
  const [vendedores, setVendedores] = useState<readonly UsuarioListado[]>([])
  const [accion, setAccion] = useState<string | null>(null)

  const [codigoAnexo, setCodigoAnexo] = useState('0000')
  const [direccion, setDireccion] = useState('')
  const [ubigeoId, setUbigeoId] = useState('150101')
  const [nombreEst, setNombreEst] = useState('')

  const [vendedorId, setVendedorId] = useState('')
  const [tipoDocumento, setTipoDocumento] = useState<
    'boleta' | 'factura' | 'guia'
  >('boleta')
  const [serie, setSerie] = useState('B001')
  const [numeroInicial, setNumeroInicial] = useState(1)
  const [establecimientoId, setEstablecimientoId] = useState('')
  const [numeroInicialNota, setNumeroInicialNota] = useState(1)

  const ocupado = accion !== null
  const guiaCompartida = tipoDocumento === 'guia'

  async function cargar(mantenerAccion = false): Promise<void> {
    if (!mantenerAccion) setAccion('cargar')
    try {
      const [est, ser, us] = await Promise.all([
        listarEstablecimientosFn(),
        listarSeriesFn(),
        listarUsuariosFn(),
      ])
      if (est?.ok !== true) {
        avisar(
          'error',
          est?.error?.mensaje ?? 'No se listaron establecimientos.',
        )
        return
      }
      if (ser?.ok !== true) {
        avisar('error', ser?.error?.mensaje ?? 'No se listaron series.')
        return
      }
      if (us?.ok !== true) {
        avisar('error', us?.error?.mensaje ?? 'No se listaron usuarios.')
        return
      }
      setEstablecimientos(est.establecimientos ?? [])
      setSeries(ser.series ?? [])
      const lista = us.usuarios ?? []
      setVendedores(
        lista.filter((u) => u.rol === 'vendedor' || u.rol === 'administrador'),
      )
      if (establecimientoId === '' && (est.establecimientos?.length ?? 0) > 0) {
        setEstablecimientoId(est.establecimientos![0]!.id)
      }
      if (vendedorId === '' && lista.length > 0) {
        const primero = lista.find((u) => u.rol === 'vendedor') ?? lista[0]
        if (primero) setVendedorId(primero.uid)
      }
    } catch (err) {
      avisar('error', err instanceof Error ? err.message : 'Error de red.')
    } finally {
      if (!mantenerAccion) setAccion(null)
    }
  }

  useEffect(() => {
    void cargar()
  }, [])

  useEffect(() => {
    setSerie(
      tipoDocumento === 'boleta'
        ? 'B001'
        : tipoDocumento === 'factura'
          ? 'F001'
          : 'T001',
    )
  }, [tipoDocumento])

  async function crearEst(evento: FormEvent): Promise<void> {
    evento.preventDefault()
    setAccion('crear-est')
    try {
      const respuesta = await crearEstablecimientoFn({
        data: {
          codigoAnexo,
          direccion,
          ubigeoId,
          nombre: nombreEst || undefined,
        },
      })
      if (!respuesta.ok) {
        avisar(
          'error',
          respuesta.error?.mensaje ?? 'No se creó el establecimiento.',
        )
        return
      }
      setDireccion('')
      setNombreEst('')
      avisar('exito', 'Establecimiento creado.')
      await cargar(true)
    } catch (err) {
      avisar('error', err instanceof Error ? err.message : 'Error de red.')
    } finally {
      setAccion(null)
    }
  }

  async function crearSer(evento: FormEvent): Promise<void> {
    evento.preventDefault()
    setAccion('crear-ser')
    try {
      const respuesta = await crearSerieFn({
        data: {
          vendedorId: guiaCompartida ? 'compartida' : vendedorId,
          tipoDocumento,
          serie,
          numeroInicial,
          establecimientoId,
        },
      })
      if (!respuesta.ok) {
        avisar('error', respuesta.error?.mensaje ?? 'No se creó la serie.')
        return
      }
      avisar(
        'exito',
        guiaCompartida
          ? `Serie ${serie} de guía asignada a todos los vendedores.`
          : `Serie ${serie} asignada (${tipoDocumento}). En DEMO queda en Firestore para pruebas.`,
      )
      await cargar(true)
    } catch (err) {
      avisar('error', err instanceof Error ? err.message : 'Error de red.')
    } finally {
      setAccion(null)
    }
  }

  async function crearNota(evento: FormEvent): Promise<void> {
    evento.preventDefault()
    setAccion('crear-nota')
    try {
      const respuesta = await crearSerieFn({
        data: {
          vendedorId: 'compartida',
          tipoDocumento: 'nota_venta',
          serie: '',
          numeroInicial: numeroInicialNota,
          establecimientoId: '',
        },
      })
      if (!respuesta.ok) {
        avisar(
          'error',
          respuesta.error?.mensaje ?? 'No se creó la numeración.',
        )
        return
      }
      avisar(
        'exito',
        'Numeración de nota de venta asignada. Es local y compartida por todos los vendedores.',
      )
      await cargar(true)
    } catch (err) {
      avisar('error', err instanceof Error ? err.message : 'Error de red.')
    } finally {
      setAccion(null)
    }
  }

  async function desactivar(serieId: string, mensaje: string): Promise<void> {
    setAccion(`desactivar:${serieId}`)
    try {
      const r = await desactivarSerieFn({ data: { serieId } })
      if (!r.ok) {
        avisar('error', r.error?.mensaje ?? 'No se desactivó.')
      } else {
        avisar('info', mensaje)
      }
      await cargar(true)
    } finally {
      setAccion(null)
    }
  }

  const idGuiaCanonica = idDeSerie('compartida', 'guia')
  const idNotaCanonica = idDeSerie('compartida', 'nota_venta')
  const seriesReguladas = series.filter((cada) => {
    if (cada.tipoDocumento === 'nota_venta') return false
    if (cada.tipoDocumento === 'guia' && cada.id !== idGuiaCanonica) {
      return cada.activa
    }
    return true
  })
  const numeracionNotas = series.filter((cada) => {
    if (cada.tipoDocumento !== 'nota_venta') return false
    return cada.id === idNotaCanonica || cada.activa
  })

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-8">
      <CabeceraAdmin
        titulo="Series y establecimientos"
        descripcion="Boleta y factura: una serie por vendedor. Guía y nota de venta: un correlativo para todos. En DEMO las reguladas se guardan en Firestore sin sync al proveedor."
      />

      <section className="rounded-3xl border border-borde bg-papel p-6">
        <h2 className="text-cuerpo font-bold">Establecimientos</h2>
        <form onSubmit={crearEst} className="mt-4 flex flex-col gap-3">
          <div>
            <Etiqueta htmlFor="anexo">Código de anexo</Etiqueta>
            <Campo
              id="anexo"
              required
              value={codigoAnexo}
              onChange={(e) => setCodigoAnexo(e.target.value)}
              disabled={ocupado}
            />
          </div>
          <div>
            <Etiqueta htmlFor="direccion">Dirección</Etiqueta>
            <Campo
              id="direccion"
              required
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              disabled={ocupado}
            />
          </div>
          <div>
            <Etiqueta htmlFor="ubigeo">Ubigeo (6 dígitos)</Etiqueta>
            <Campo
              id="ubigeo"
              required
              pattern="\d{6}"
              value={ubigeoId}
              onChange={(e) => setUbigeoId(e.target.value)}
              disabled={ocupado}
            />
          </div>
          <div>
            <Etiqueta htmlFor="nombreEst">Nombre (opcional)</Etiqueta>
            <Campo
              id="nombreEst"
              value={nombreEst}
              onChange={(e) => setNombreEst(e.target.value)}
              disabled={ocupado}
            />
          </div>
          <BotonAccion
            type="submit"
            variante="principal"
            accion="crear-est"
            actual={accion}
            etiqueta="Crear establecimiento"
            ocupada="Creando…"
          />
        </form>
        <ul className="mt-4 flex flex-col gap-2">
          {establecimientos.map((est) => (
            <li
              key={est.id}
              className="flex flex-wrap items-center justify-between gap-2 border-t border-borde pt-3"
            >
              <div>
                <p className="text-cuerpo font-bold">{est.nombre || est.id}</p>
                <p className="font-mono text-etiqueta text-desvaida">
                  anexo {est.codigoAnexo} · {est.direccion}
                </p>
              </div>
              <BotonAccion
                variante="peligro"
                accion={`eliminar-est:${est.id}`}
                actual={accion}
                etiqueta="Eliminar"
                ocupada="Eliminando…"
                onClick={() => {
                  void (async () => {
                    setAccion(`eliminar-est:${est.id}`)
                    try {
                      const r = await eliminarEstablecimientoFn({
                        data: { establecimientoId: est.id },
                      })
                      if (!r.ok) {
                        avisar('error', r.error?.mensaje ?? 'No se eliminó.')
                      } else {
                        avisar('exito', 'Establecimiento eliminado.')
                      }
                      await cargar(true)
                    } finally {
                      setAccion(null)
                    }
                  })()
                }}
              />
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-3xl border border-borde bg-papel p-6">
        <h2 className="text-cuerpo font-bold">Series</h2>
        <form onSubmit={crearSer} className="mt-4 flex flex-col gap-3">
          <Selector
            id="tipo"
            etiqueta="Tipo"
            disposicion="columna"
            valor={tipoDocumento}
            onCambiar={setTipoDocumento}
            disabled={ocupado}
            opciones={[
              { valor: 'boleta', etiqueta: 'Boleta' },
              { valor: 'factura', etiqueta: 'Factura' },
              { valor: 'guia', etiqueta: 'Guía de remisión' },
            ]}
          />
          {guiaCompartida ? (
            <p className="text-cuerpo text-desvaida">
              La guía de remisión usa una sola serie para todos los vendedores.
            </p>
          ) : (
            <Selector
              id="vendedor"
              etiqueta="Vendedor"
              disposicion="columna"
              valor={vendedorId}
              onCambiar={setVendedorId}
              disabled={ocupado}
              required
              opciones={vendedores.map((vendedor) => ({
                valor: vendedor.uid,
                etiqueta: `${vendedor.nombre || vendedor.correo} (${vendedor.rol})`,
              }))}
            />
          )}
          <div>
            <Etiqueta htmlFor="serie">Serie (máx. 4, prefijo B/F/T)</Etiqueta>
            <Campo
              id="serie"
              required
              maxLength={4}
              value={serie}
              onChange={(e) => setSerie(e.target.value.toUpperCase())}
              disabled={ocupado}
            />
          </div>
          <div>
            <Etiqueta htmlFor="numeroInicial">Número inicial</Etiqueta>
            <Campo
              id="numeroInicial"
              type="number"
              min={0}
              required
              numerico
              value={String(numeroInicial)}
              onChange={(e) => setNumeroInicial(Number(e.target.value))}
              disabled={ocupado}
            />
          </div>
          <Selector
            id="estId"
            etiqueta="Establecimiento"
            disposicion="columna"
            valor={establecimientoId}
            onCambiar={setEstablecimientoId}
            disabled={ocupado}
            required
            opciones={establecimientos.map((establecimiento) => ({
              valor: establecimiento.id,
              etiqueta: `${establecimiento.nombre || establecimiento.codigoAnexo} (${establecimiento.id})`,
            }))}
          />
          <BotonAccion
            type="submit"
            variante="principal"
            accion="crear-ser"
            actual={accion}
            etiqueta="Crear serie"
            ocupada="Creando…"
          />
        </form>

        <ul className="mt-4 flex flex-col gap-2">
          {seriesReguladas.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-2 border-t border-borde pt-3"
            >
              <div>
                <p className="text-cuerpo font-bold">
                  {s.serie || '(local)'} · {s.tipoDocumento}
                  {tipoDeSerieEsCompartida(s.tipoDocumento)
                    ? ' · todos los vendedores'
                    : ''}
                </p>
                <p className="font-mono text-etiqueta text-desvaida">
                  {tipoDeSerieEsCompartida(s.tipoDocumento)
                    ? `inicio ${s.numeroInicial} · último ${s.ultimoNumero}`
                    : `${s.id} · inicio ${s.numeroInicial}`}
                  {' · '}
                  {s.activa ? 'activa' : 'inactiva'}
                </p>
              </div>
              {s.activa && (
                <BotonAccion
                  variante="peligro"
                  accion={`desactivar:${s.id}`}
                  actual={accion}
                  etiqueta="Desactivar"
                  ocupada="Desactivando…"
                  onClick={() => {
                    void desactivar(s.id, 'Serie desactivada.')
                  }}
                />
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-3xl border border-borde bg-papel p-6">
        <h2 className="text-cuerpo font-bold">Notas de venta</h2>
        <p className="mt-2 text-cuerpo text-desvaida">
          Un correlativo interno para todos los vendedores. No lleva serie B/F/T
          ni se sincroniza con el proveedor.
        </p>
        <form onSubmit={crearNota} className="mt-4 flex flex-col gap-3">
          <div>
            <Etiqueta htmlFor="numeroInicialNota">Número inicial</Etiqueta>
            <Campo
              id="numeroInicialNota"
              type="number"
              min={0}
              required
              numerico
              value={String(numeroInicialNota)}
              onChange={(e) => setNumeroInicialNota(Number(e.target.value))}
              disabled={ocupado}
            />
          </div>
          <BotonAccion
            type="submit"
            variante="principal"
            accion="crear-nota"
            actual={accion}
            etiqueta="Asignar numeración"
            ocupada="Asignando…"
          />
        </form>

        <ul className="mt-4 flex flex-col gap-2">
          {numeracionNotas.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-2 border-t border-borde pt-3"
            >
              <div>
                <p className="text-cuerpo font-bold">Todos los vendedores</p>
                <p className="font-mono text-etiqueta text-desvaida">
                  inicio {s.numeroInicial} · último {s.ultimoNumero} ·{' '}
                  {s.activa ? 'activa' : 'inactiva'}
                </p>
              </div>
              {s.activa && (
                <BotonAccion
                  variante="peligro"
                  accion={`desactivar:${s.id}`}
                  actual={accion}
                  etiqueta="Desactivar"
                  ocupada="Desactivando…"
                  onClick={() => {
                    void desactivar(s.id, 'Numeración desactivada.')
                  }}
                />
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function BotonAccion({
  accion,
  actual,
  etiqueta,
  ocupada,
  ...resto
}: Omit<PropsDeBoton, 'children'> & {
  readonly accion: string
  readonly actual: string | null
  readonly etiqueta: string
  readonly ocupada: string
}) {
  const mio = actual === accion
  return (
    <Boton
      {...resto}
      disabled={resto.disabled === true || actual !== null}
      aria-busy={mio || undefined}
    >
      {mio ? (
        <>
          <Loader2
            className="size-4 animate-spin motion-reduce:animate-none"
            aria-hidden
          />
          {ocupada}
        </>
      ) : (
        etiqueta
      )}
    </Boton>
  )
}
