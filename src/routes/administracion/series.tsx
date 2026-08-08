import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
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
import { Boton, Campo, Etiqueta } from '../../ui/componentes/primitivas.tsx'

/**
 * Establecimientos y series por vendedor (T083 / FR-031 / decisión 12).
 */

export const Route = createFileRoute('/administracion/series')({
  component: () => (
    <GuardaSesion roles={['administrador']}>
      <PantallaDeSeries />
    </GuardaSesion>
  ),
})

function PantallaDeSeries() {
  const [establecimientos, setEstablecimientos] = useState<
    readonly Establecimiento[]
  >([])
  const [series, setSeries] = useState<readonly SerieAdministrativa[]>([])
  const [vendedores, setVendedores] = useState<readonly UsuarioListado[]>([])
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const [codigoAnexo, setCodigoAnexo] = useState('0000')
  const [direccion, setDireccion] = useState('')
  const [ubigeoId, setUbigeoId] = useState('150101')
  const [nombreEst, setNombreEst] = useState('')

  const [vendedorId, setVendedorId] = useState('')
  const [tipoDocumento, setTipoDocumento] = useState<'boleta' | 'factura'>(
    'boleta',
  )
  const [serie, setSerie] = useState('B001')
  const [numeroInicial, setNumeroInicial] = useState(1)
  const [establecimientoId, setEstablecimientoId] = useState('')

  async function cargar(): Promise<void> {
    setOcupado(true)
    setError(null)
    try {
      const [est, ser, us] = await Promise.all([
        listarEstablecimientosFn(),
        listarSeriesFn(),
        listarUsuariosFn(),
      ])
      if (est?.ok !== true) {
        setError(est?.error?.mensaje ?? 'No se listaron establecimientos.')
        return
      }
      if (ser?.ok !== true) {
        setError(ser?.error?.mensaje ?? 'No se listaron series.')
        return
      }
      if (us?.ok !== true) {
        setError(us?.error?.mensaje ?? 'No se listaron usuarios.')
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
        const primero =
          lista.find((u) => u.rol === 'vendedor') ?? lista[0]
        if (primero) setVendedorId(primero.uid)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de red.')
    } finally {
      setOcupado(false)
    }
  }

  useEffect(() => {
    void cargar()
  }, [])

  useEffect(() => {
    setSerie(tipoDocumento === 'boleta' ? 'B001' : 'F001')
  }, [tipoDocumento])

  async function crearEst(evento: FormEvent): Promise<void> {
    evento.preventDefault()
    setOcupado(true)
    setError(null)
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
        setError(respuesta.error?.mensaje ?? 'No se creó el establecimiento.')
        return
      }
      setDireccion('')
      setNombreEst('')
      await cargar()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de red.')
    } finally {
      setOcupado(false)
    }
  }

  async function crearSer(evento: FormEvent): Promise<void> {
    evento.preventDefault()
    setOcupado(true)
    setError(null)
    try {
      const respuesta = await crearSerieFn({
        data: {
          vendedorId,
          tipoDocumento,
          serie,
          numeroInicial,
          establecimientoId,
        },
      })
      if (!respuesta.ok) {
        setError(respuesta.error?.mensaje ?? 'No se creó la serie.')
        return
      }
      await cargar()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de red.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-8">
      <header>
        <h1 className="text-cabecera font-bold text-tinta">
          Series y establecimientos
        </h1>
        <p className="mt-2 text-cuerpo text-desvaida">
          Una serie por vendedor y tipo. Las reguladas se sincronizan con el
          proveedor.
        </p>
      </header>

      {error !== null && (
        <p className="text-cuerpo font-bold text-aviso" role="alert">
          {error}
        </p>
      )}

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
          <Boton type="submit" variante="principal" disabled={ocupado}>
            Crear establecimiento
          </Boton>
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
              <Boton
                variante="peligro"
                disabled={ocupado}
                onClick={() => {
                  void (async () => {
                    setOcupado(true)
                    const r = await eliminarEstablecimientoFn({
                      data: { establecimientoId: est.id },
                    })
                    if (!r.ok) {
                      setError(r.error?.mensaje ?? 'No se eliminó.')
                    }
                    await cargar()
                  })()
                }}
              >
                Eliminar
              </Boton>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-3xl border border-borde bg-papel p-6">
        <h2 className="text-cuerpo font-bold">Series</h2>
        <form onSubmit={crearSer} className="mt-4 flex flex-col gap-3">
          <div>
            <Etiqueta htmlFor="vendedor">Vendedor</Etiqueta>
            <select
              id="vendedor"
              className="min-h-11 w-full rounded-full border border-borde bg-papel px-4"
              value={vendedorId}
              onChange={(e) => setVendedorId(e.target.value)}
              disabled={ocupado}
              required
            >
              {vendedores.map((v) => (
                <option key={v.uid} value={v.uid}>
                  {v.nombre || v.correo} ({v.rol})
                </option>
              ))}
            </select>
          </div>
          <div>
            <Etiqueta htmlFor="tipo">Tipo</Etiqueta>
            <select
              id="tipo"
              className="min-h-11 w-full rounded-full border border-borde bg-papel px-4"
              value={tipoDocumento}
              onChange={(e) =>
                setTipoDocumento(e.target.value as 'boleta' | 'factura')
              }
              disabled={ocupado}
            >
              <option value="boleta">Boleta</option>
              <option value="factura">Factura</option>
            </select>
          </div>
          <div>
            <Etiqueta htmlFor="serie">Serie (máx. 4, prefijo B/F)</Etiqueta>
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
          <div>
            <Etiqueta htmlFor="estId">Establecimiento</Etiqueta>
            <select
              id="estId"
              className="min-h-11 w-full rounded-full border border-borde bg-papel px-4"
              value={establecimientoId}
              onChange={(e) => setEstablecimientoId(e.target.value)}
              disabled={ocupado}
              required
            >
              {establecimientos.map((est) => (
                <option key={est.id} value={est.id}>
                  {est.nombre || est.codigoAnexo} ({est.id})
                </option>
              ))}
            </select>
          </div>
          <Boton type="submit" variante="principal" disabled={ocupado}>
            Crear serie
          </Boton>
        </form>

        <ul className="mt-4 flex flex-col gap-2">
          {series.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-2 border-t border-borde pt-3"
            >
              <div>
                <p className="text-cuerpo font-bold">
                  {s.serie || '(local)'} · {s.tipoDocumento}
                </p>
                <p className="font-mono text-etiqueta text-desvaida">
                  {s.id} · inicio {s.numeroInicial} ·{' '}
                  {s.activa ? 'activa' : 'inactiva'}
                </p>
              </div>
              {s.activa && (
                <Boton
                  variante="peligro"
                  disabled={ocupado}
                  onClick={() => {
                    void (async () => {
                      setOcupado(true)
                      const r = await desactivarSerieFn({
                        data: { serieId: s.id },
                      })
                      if (!r.ok) {
                        setError(r.error?.mensaje ?? 'No se desactivó.')
                      }
                      await cargar()
                    })()
                  }}
                >
                  Desactivar
                </Boton>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
