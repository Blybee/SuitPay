import {
  consumeSerieRegulada,
  serieEsValida,
} from '../../domain/documentos/tipos.ts'
import type { TipoDeDocumento } from '../../domain/documentos/tipos.ts'
import { fallar } from '../errores.ts'
import { esFaseDemo, PREFIJO_ID_DEMO } from '../fase-operacion.ts'
import { bd, COLECCIONES } from '../firebase/admin.ts'
import {
  idDeSerie,
  tipoDeSerieEsCompartida,
  VENDEDOR_DE_SERIE_COMPARTIDA,
} from '../emision/almacen.ts'
import type { Serie } from '../emision/almacen.ts'
import { proveedorActual } from '../proveedor/actual.ts'
import type {
  Establecimiento,
  PeticionDeCrearEstablecimiento,
} from '../proveedor/interfaz.ts'

/**
 * Alta administrativa de establecimientos y series (T083 / decisión 12).
 *
 * Serie regulada (boleta/factura): una por vendedor. Guía y nota de venta:
 * un correlativo compartido (`compartida__tipo`). Nota de venta no va al
 * proveedor.
 *
 * En fase DEMO (`SUITPAY_FASE=DEMO`), si el proveedor no acepta series se
 * persiste igual en Firestore con id sintético (pruebas manuales). Ver
 * docs/FASE-OPERACION.md. Quitar/desactivar en PRODUCCION.
 */

const ESTABLECIMIENTO_DEMO: Establecimiento = {
  id: `${PREFIJO_ID_DEMO}establecimiento-0000`,
  codigoAnexo: '0000',
  direccion: 'Local demo SuitPay',
  ubigeoId: '150101',
  nombre: 'Local demo',
  correo: undefined,
}

export interface SerieAdministrativa extends Serie {
  readonly id: string
  readonly serieIdEnProveedor: string | null
  readonly establecimientoId: string | null
}

export interface AltaDeSerie {
  readonly vendedorId: string
  readonly tipoDocumento: TipoDeDocumento
  readonly serie: string
  readonly numeroInicial: number
  readonly establecimientoId: string
}

type Datos = Record<string, unknown>

function leerSerie(id: string, datos: Datos): SerieAdministrativa {
  const numeroInicial =
    typeof datos['numeroInicial'] === 'number' ? datos['numeroInicial'] : 1
  return {
    id,
    serie: typeof datos['serie'] === 'string' ? datos['serie'] : '',
    tipoDocumento: datos['tipoDocumento'] as TipoDeDocumento,
    vendedorId: typeof datos['vendedorId'] === 'string' ? datos['vendedorId'] : '',
    numeroInicial,
    ultimoNumero:
      typeof datos['ultimoNumero'] === 'number'
        ? datos['ultimoNumero']
        : numeroInicial - 1,
    ultimoNumeroConfirmado:
      typeof datos['ultimoNumeroConfirmado'] === 'number'
        ? datos['ultimoNumeroConfirmado']
        : numeroInicial - 1,
    activa: datos['activa'] !== false,
    serieIdEnProveedor:
      typeof datos['serieIdEnProveedor'] === 'string'
        ? datos['serieIdEnProveedor']
        : null,
    establecimientoId:
      typeof datos['establecimientoId'] === 'string'
        ? datos['establecimientoId']
        : null,
  }
}

export async function listarEstablecimientos(): Promise<
  readonly Establecimiento[]
> {
  const resultado = await proveedorActual().listarEstablecimientos()
  if (!resultado.ok) {
    if (esFaseDemo()) return [ESTABLECIMIENTO_DEMO]
    fallar('proveedor_admin_no_disponible', { razon: resultado.fallo.razon })
  }
  const lista = resultado.valor
  if (lista.length === 0 && esFaseDemo()) return [ESTABLECIMIENTO_DEMO]
  return lista
}

export async function crearEstablecimiento(
  peticion: PeticionDeCrearEstablecimiento,
): Promise<Establecimiento> {
  const resultado = await proveedorActual().crearEstablecimiento(peticion)
  if (!resultado.ok) {
    if (esFaseDemo()) {
      return {
        id: `${PREFIJO_ID_DEMO}establecimiento-${peticion.codigoAnexo}`,
        codigoAnexo: peticion.codigoAnexo,
        direccion: peticion.direccion,
        ubigeoId: peticion.ubigeoId,
        nombre: peticion.nombre ?? 'Establecimiento demo',
        correo: peticion.correo,
      }
    }
    fallar('proveedor_admin_no_disponible', { razon: resultado.fallo.razon })
  }
  return resultado.valor
}

export async function eliminarEstablecimiento(
  establecimientoId: string,
): Promise<void> {
  if (esFaseDemo() && establecimientoId.startsWith(PREFIJO_ID_DEMO)) {
    return
  }
  const resultado =
    await proveedorActual().eliminarEstablecimiento(establecimientoId)
  if (!resultado.ok) {
    if (esFaseDemo()) return
    fallar('proveedor_admin_no_disponible', { razon: resultado.fallo.razon })
  }
}

export async function listarSeries(): Promise<readonly SerieAdministrativa[]> {
  await asegurarSeriesCompartidas()
  const instantanea = await bd().collection(COLECCIONES.series).get()
  return instantanea.docs.map((doc) => {
    const datos: Datos = { ...doc.data() }
    return leerSerie(doc.id, datos)
  })
}

export async function leerSerieDeVendedor(
  vendedorId: string,
  tipoDocumento: TipoDeDocumento,
): Promise<SerieAdministrativa | null> {
  if (tipoDeSerieEsCompartida(tipoDocumento)) {
    await asegurarSerieCompartida(tipoDocumento)
  }
  const id = idDeSerie(vendedorId, tipoDocumento)
  const doc = await bd().collection(COLECCIONES.series).doc(id).get()
  if (!doc.exists) return null
  const datos: Datos = { ...doc.data() }
  return leerSerie(doc.id, datos)
}

/**
 * Guía y nota de venta viven en `compartida__tipo`. Si aún hay documentos
 * por vendedor (legado), se copian al id canónico una vez.
 */
async function asegurarSeriesCompartidas(): Promise<void> {
  await asegurarSerieCompartida('guia')
  await asegurarSerieCompartida('nota_venta')
}

async function asegurarSerieCompartida(
  tipo: TipoDeDocumento,
): Promise<void> {
  if (!tipoDeSerieEsCompartida(tipo)) return
  const col = bd().collection(COLECCIONES.series)
  const id = idDeSerie(VENDEDOR_DE_SERIE_COMPARTIDA, tipo)
  const canonico = await col.doc(id).get()
  if (canonico.exists) return

  const instantanea = await col.where('tipoDocumento', '==', tipo).get()
  if (instantanea.empty) return

  const candidatos = instantanea.docs.map((doc) =>
    leerSerie(doc.id, { ...doc.data() }),
  )
  const mejor =
    candidatos.find((cada) => cada.activa) ??
    candidatos.reduce((acc, cada) =>
      cada.ultimoNumero > acc.ultimoNumero ? cada : acc,
    )
  if (mejor === undefined) return

  await col.doc(id).set({
    serie: mejor.serie,
    tipoDocumento: mejor.tipoDocumento,
    vendedorId: VENDEDOR_DE_SERIE_COMPARTIDA,
    numeroInicial: mejor.numeroInicial,
    ultimoNumero: mejor.ultimoNumero,
    ultimoNumeroConfirmado: mejor.ultimoNumeroConfirmado,
    activa: mejor.activa,
    serieIdEnProveedor: mejor.serieIdEnProveedor,
    establecimientoId: mejor.establecimientoId,
  })
  if (mejor.id !== id) {
    await col.doc(mejor.id).set({ activa: false }, { merge: true })
  }
}

export async function crearSerieAdministrativa(
  alta: AltaDeSerie,
): Promise<SerieAdministrativa> {
  if (
    alta.tipoDocumento !== 'boleta' &&
    alta.tipoDocumento !== 'factura' &&
    alta.tipoDocumento !== 'guia' &&
    alta.tipoDocumento !== 'nota_venta'
  ) {
    fallar('peticion_invalida', { campo: 'tipoDocumento' })
  }

  if (!serieEsValida(alta.tipoDocumento, alta.serie.trim())) {
    fallar('peticion_invalida', { campo: 'serie' })
  }

  if (!Number.isInteger(alta.numeroInicial) || alta.numeroInicial < 0) {
    fallar('peticion_invalida', { campo: 'numeroInicial' })
  }

  const compartida = tipoDeSerieEsCompartida(alta.tipoDocumento)
  if (compartida) {
    await asegurarSerieCompartida(alta.tipoDocumento)
  }

  const vendedorId = compartida
    ? VENDEDOR_DE_SERIE_COMPARTIDA
    : alta.vendedorId
  const id = idDeSerie(vendedorId, alta.tipoDocumento)
  const existente = await bd().collection(COLECCIONES.series).doc(id).get()
  if (existente.exists) {
    const previa = leerSerie(id, { ...existente.data() })
    if (previa.activa) {
      fallar('peticion_invalida', { razon: 'serie_ya_existe', serieId: id })
    }
    return reactivarSerie(previa, alta)
  }

  let serieIdEnProveedor: string | null = null
  const regulada = consumeSerieRegulada(alta.tipoDocumento)

  if (regulada) {
    if (alta.establecimientoId.trim() === '') {
      fallar('peticion_invalida', { campo: 'establecimientoId' })
    }

    // DEMO: series locales en Firestore para pruebas/presentación sin sync
    // al proveedor (docs/FASE-OPERACION.md). En PRODUCCION siempre se sincroniza.
    if (esFaseDemo()) {
      serieIdEnProveedor = `${PREFIJO_ID_DEMO}${id}`
    } else {
      const resultado = await proveedorActual().crearSerie({
        tipoDocumento: alta.tipoDocumento,
        serie: alta.serie.trim(),
        numeroInicial: alta.numeroInicial,
        establecimientoId: alta.establecimientoId.trim(),
      })
      if (!resultado.ok) {
        fallar('proveedor_admin_no_disponible', {
          razon: resultado.fallo.razon,
        })
      }
      serieIdEnProveedor = resultado.valor.id
    }
  }

  const ultimo = alta.numeroInicial - 1
  const documento: SerieAdministrativa = {
    id,
    serie: alta.serie.trim(),
    tipoDocumento: alta.tipoDocumento,
    vendedorId,
    numeroInicial: alta.numeroInicial,
    ultimoNumero: ultimo,
    ultimoNumeroConfirmado: ultimo,
    activa: true,
    serieIdEnProveedor,
    establecimientoId: regulada ? alta.establecimientoId.trim() : null,
  }

  await bd()
    .collection(COLECCIONES.series)
    .doc(id)
    .set({
      serie: documento.serie,
      tipoDocumento: documento.tipoDocumento,
      vendedorId: documento.vendedorId,
      numeroInicial: documento.numeroInicial,
      ultimoNumero: documento.ultimoNumero,
      ultimoNumeroConfirmado: documento.ultimoNumeroConfirmado,
      activa: true,
      serieIdEnProveedor,
      establecimientoId: documento.establecimientoId,
    })

  if (!compartida) {
    const usuarioRef = bd().collection(COLECCIONES.usuarios).doc(vendedorId)
    const usuario = await usuarioRef.get()
    if (usuario.exists) {
      const previas = usuario.data()?.['seriesAsignadas']
      const lista = Array.isArray(previas)
        ? previas.filter((cada): cada is string => typeof cada === 'string')
        : []
      if (!lista.includes(id)) {
        await usuarioRef.set(
          { seriesAsignadas: [...lista, id] },
          { merge: true },
        )
      }
    }
  }

  return documento
}

async function reactivarSerie(
  previa: SerieAdministrativa,
  alta: AltaDeSerie,
): Promise<SerieAdministrativa> {
  const regulada = consumeSerieRegulada(previa.tipoDocumento)
  let serieIdEnProveedor = previa.serieIdEnProveedor

  if (regulada) {
    const establecimientoId =
      alta.establecimientoId.trim() || previa.establecimientoId || ''
    if (establecimientoId === '') {
      fallar('peticion_invalida', { campo: 'establecimientoId' })
    }
    const siguiente = Math.max(alta.numeroInicial, previa.ultimoNumero + 1)
    if (esFaseDemo()) {
      serieIdEnProveedor =
        serieIdEnProveedor ?? `${PREFIJO_ID_DEMO}${previa.id}`
    } else {
      const resultado = await proveedorActual().crearSerie({
        tipoDocumento: previa.tipoDocumento,
        serie: (alta.serie.trim() || previa.serie),
        numeroInicial: siguiente,
        establecimientoId,
      })
      if (!resultado.ok) {
        fallar('proveedor_admin_no_disponible', {
          razon: resultado.fallo.razon,
        })
      }
      serieIdEnProveedor = resultado.valor.id
    }
  }

  const serie = alta.serie.trim() || previa.serie
  await bd()
    .collection(COLECCIONES.series)
    .doc(previa.id)
    .set(
      {
        activa: true,
        serie,
        serieIdEnProveedor,
        establecimientoId: regulada
          ? alta.establecimientoId.trim() || previa.establecimientoId
          : null,
      },
      { merge: true },
    )

  return {
    ...previa,
    activa: true,
    serie,
    serieIdEnProveedor,
    establecimientoId: regulada
      ? alta.establecimientoId.trim() || previa.establecimientoId
      : null,
  }
}

export async function desactivarSerie(serieId: string): Promise<void> {
  const ref = bd().collection(COLECCIONES.series).doc(serieId)
  const doc = await ref.get()
  if (!doc.exists) fallar('no_encontrado', { recurso: 'serie' })

  const datos: Datos = { ...doc.data() }
  const serieIdEnProveedor =
    typeof datos['serieIdEnProveedor'] === 'string'
      ? datos['serieIdEnProveedor']
      : null

  if (serieIdEnProveedor !== null) {
    if (esFaseDemo() && serieIdEnProveedor.startsWith(PREFIJO_ID_DEMO)) {
      // Serie solo local: no hay nada que borrar en el proveedor.
    } else {
      const resultado =
        await proveedorActual().eliminarSerie(serieIdEnProveedor)
      if (!resultado.ok) {
        if (!esFaseDemo()) {
          fallar('proveedor_admin_no_disponible', {
            razon: resultado.fallo.razon,
          })
        }
      }
    }
  }

  await ref.set({ activa: false }, { merge: true })
}
