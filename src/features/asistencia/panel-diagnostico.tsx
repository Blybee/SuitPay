import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { usarDegradacion } from '../degradacion/estado.ts'
import { formatearMotivoAsistencia } from '../degradacion/motivo-asistencia.ts'
import { usarNotificaciones } from '../notificaciones/almacen.ts'
import { Boton, Distintivo } from '../../ui/componentes/primitivas.tsx'
import { diagnosticarAsistenciaFn } from './diagnostico.funciones.ts'
import type {
  DiagnosticoDeAsistencia,
  SondaDeClave,
} from './diagnostico.funciones.ts'

/**
 * «Probar asistencia»: la misma llamada a Gemini que hace una foto, desde el
 * servidor de producción, con un prompt fijo. Muestra por clave y modelo qué
 * respondió el servicio para que el administrador sepa qué arreglar sin abrir
 * los logs de Cloud Run.
 */

const LEYENDA_CLAVE = {
  primaria: 'Clave primaria',
  secundaria: 'Clave secundaria',
} as const

function describirSonda(sonda: SondaDeClave): string {
  if (sonda.resultado === 'ausente') {
    return 'No configurada en el servidor.'
  }
  if (sonda.resultado === 'ok') {
    return sonda.respondioOk === true
      ? `Respondió correctamente en ${sonda.ms} ms.`
      : `Respondió en ${sonda.ms} ms, pero no con el JSON esperado.`
  }
  return (
    formatearMotivoAsistencia({
      motivo: sonda.resultado,
      status: sonda.status,
      estadoGemini: sonda.estadoGemini,
      modelo: null,
      clave: null,
    })?.replace(/^Asistencia: /, '') ?? sonda.resultado
  )
}

function tonoDeSonda(sonda: SondaDeClave): 'sello' | 'aviso' | 'desvaida' {
  if (sonda.resultado === 'ok' && sonda.respondioOk === true) return 'sello'
  if (sonda.resultado === 'ausente') return 'desvaida'
  return 'aviso'
}

function etiquetaDeSonda(sonda: SondaDeClave): string {
  if (sonda.resultado === 'ok') return 'OK'
  if (sonda.resultado === 'ausente') return 'Ausente'
  return sonda.status !== null ? `HTTP ${sonda.status}` : sonda.resultado
}

export function PanelDiagnosticoAsistencia() {
  const [ocupado, setOcupado] = useState(false)
  const [diagnostico, setDiagnostico] =
    useState<DiagnosticoDeAsistencia | null>(null)

  async function probar(): Promise<void> {
    setOcupado(true)
    try {
      const respuesta = await diagnosticarAsistenciaFn()
      if (!respuesta.ok || respuesta.diagnostico === undefined) {
        usarNotificaciones.getState().mostrar({
          tono: 'error',
          mensaje: respuesta.error?.mensaje ?? 'No se pudo ejecutar la prueba.',
        })
        return
      }
      setDiagnostico(respuesta.diagnostico)
      const alguna = respuesta.diagnostico.sondas.some(
        (s) => s.resultado === 'ok' && s.respondioOk === true,
      )
      if (alguna) {
        usarDegradacion.getState().resolver('asistencia')
        usarNotificaciones.getState().mostrar({
          tono: 'exito',
          mensaje: 'La asistencia responde desde el servidor.',
        })
      } else {
        usarNotificaciones.getState().mostrar({
          tono: 'error',
          mensaje:
            'Ninguna clave obtuvo respuesta. Revisa el detalle de cada una.',
        })
      }
    } catch (error) {
      usarNotificaciones.getState().mostrar({
        tono: 'error',
        mensaje: error instanceof Error ? error.message : 'Error de red.',
      })
    } finally {
      setOcupado(false)
    }
  }

  return (
    <section
      aria-labelledby="titulo-diagnostico-asistencia"
      className="flex flex-col gap-4 rounded-3xl border border-borde bg-papel p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="titulo-diagnostico-asistencia"
            className="text-cuerpo font-bold text-tinta"
          >
            Asistencia (foto, PDF y dictado)
          </h2>
          <p className="mt-1 text-cuerpo text-desvaida">
            Hace una llamada real al servicio desde el servidor, con cada clave
            configurada. No envía datos de clientes ni del pedido.
          </p>
        </div>
        <Boton
          type="button"
          variante="principal"
          onClick={() => void probar()}
          disabled={ocupado}
          aria-busy={ocupado || undefined}
          data-testid="probar-asistencia"
        >
          {ocupado ? (
            <Loader2 className="size-5 animate-spin" aria-hidden />
          ) : null}
          {ocupado ? 'Probando…' : 'Probar asistencia'}
        </Boton>
      </div>

      <div
        className="grid transition-[grid-template-rows] duration-media ease-salida motion-reduce:transition-none"
        style={{ gridTemplateRows: diagnostico === null ? '0fr' : '1fr' }}
      >
        <div className="min-h-0 overflow-hidden">
          {diagnostico !== null ? (
            <div
              className="flex flex-col gap-3 pt-1"
              data-testid="resultado-diagnostico"
            >
              <p className="font-mono text-etiqueta text-desvaida">
                Modelos: {diagnostico.modelos.join(' → ')}
                {diagnostico.simuladoActivo
                  ? ' · modo simulado activo (sin clave primaria o ASISTENCIA_SIMULADA)'
                  : ''}
              </p>
              <ul className="flex flex-col gap-2">
                {diagnostico.sondas.map((sonda) => (
                  <li
                    key={`${sonda.clave}-${sonda.modelo}`}
                    className="flex flex-wrap items-center gap-3 rounded-2xl border border-borde bg-mesa/40 px-4 py-3"
                  >
                    <Distintivo tono={tonoDeSonda(sonda)}>
                      {etiquetaDeSonda(sonda)}
                    </Distintivo>
                    <div className="min-w-0 flex-1">
                      <p className="text-cuerpo font-bold text-tinta">
                        {LEYENDA_CLAVE[sonda.clave]}
                        {sonda.presente ? (
                          <span className="font-mono text-etiqueta font-normal text-desvaida">
                            {' '}
                            · {sonda.longitud} caracteres · {sonda.modelo}
                          </span>
                        ) : null}
                      </p>
                      <p className="text-cuerpo text-desvaida">
                        {describirSonda(sonda)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
