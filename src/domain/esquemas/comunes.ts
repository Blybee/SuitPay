import { z } from 'zod'
import { TIPOS_DE_DOCUMENTO, TIPOS_ELEGIBLES } from '../documentos/tipos.ts'

/**
 * Esquemas de validación compartidos por el cliente y el servidor.
 *
 * Que sean **el mismo código** en los dos lados es lo que hace creíble la regla
 * de que manda el servidor. Si el cliente validase con un esquema y el servidor
 * con otro, la discrepancia entre ambos no sería un error de datos sino un error
 * de mantenimiento, y aparecería el día que alguien cambie uno y olvide el otro.
 */

/** Un importe en céntimos: entero, siempre. Ver src/domain/totales/. */
export const importeEnCentimos = z
  .number()
  .int('Los importes se manejan en céntimos enteros')
  .finite()

export const tipoDeDocumentoIdentidad = z.enum(['DNI', 'RUC', 'CE', 'PAS'])

export const numeroDeDocumentoIdentidad = z
  .string()
  .trim()
  .min(8, 'Un documento de identidad tiene al menos 8 caracteres')
  .max(15)
  .regex(/^[0-9A-Za-z]+$/, 'Sin espacios ni signos')

export const esquemaDeCategoria = z.object({
  id: z.string().trim().min(1).max(40),
  nombre: z.string().trim().min(1).max(80),
})

export type CategoriaDeCatalogo = z.infer<typeof esquemaDeCategoria>

export const esquemaDeProducto = z.object({
  codigo: z.string().trim().min(1).max(40),
  descripcion: z.string().trim().min(1).max(300),
  unidad: z.string().trim().min(1).max(20),
  // 0 se admite en importación cuando la tienda no trae wholesale (decisión
  // US2); el vendedor no podrá emitir esa línea sin poner precio (FR-013).
  precio: importeEnCentimos.nonnegative(
    'El precio del catálogo no puede ser negativo',
  ),
  activo: z.boolean(),
  /** Persistida (JSON `brand` / PDF `LINEA`). Vacía si el origen no trae marca. */
  marca: z.string().trim().max(120).default(''),
  /** Opcional: referencia a `categorias[].id` del mismo documento. */
  categoriaId: z.string().trim().min(1).max(40).optional(),
})

export type Producto = z.infer<typeof esquemaDeProducto>

export const esquemaDeCliente = z.object({
  tipoDocumento: tipoDeDocumentoIdentidad,
  numeroDocumento: numeroDeDocumentoIdentidad,
  denominacion: z.string().trim().min(1).max(300),
  direccion: z.string().trim().max(300).optional(),
  ubigeo: z.string().trim().max(10).optional(),
  telefono: z.string().trim().max(30).optional(),
  correo: z.string().trim().max(200).optional(),
  condicion: z.string().trim().max(60).optional(),
})

export type Cliente = z.infer<typeof esquemaDeCliente>

/**
 * Una línea del pedido tal como la envía el cliente. El importe **no** viaja: lo
 * calcula el servidor con las reglas del dominio. Aceptar un importe del cliente
 * sería aceptar su aritmética.
 */
export const esquemaDeLineaDePedido = z.object({
  codigo: z.string().trim().min(1).max(40),
  descripcion: z.string().trim().min(1).max(300),
  unidad: z.string().trim().min(1).max(20),
  cantidad: z
    .number()
    .finite()
    .positive('La cantidad debe ser positiva')
    .max(1_000_000),
  /**
   * Precio con el impuesto incluido, posiblemente negociado por el vendedor. No
   * se valida contra el precio del catálogo a propósito: el precio minorista es
   * arbitrario por decisión del negocio y el del catálogo es solo la referencia.
   */
  precio: importeEnCentimos.positive('El precio debe ser positivo'),
})

export type LineaDePedidoValidada = z.infer<typeof esquemaDeLineaDePedido>

export const esquemaDeCondicionDePago = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('contado') }),
  z.object({
    tipo: z.literal('credito'),
    fechaVencimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha AAAA-MM-DD'),
  }),
])

export const esquemaDeMedioDePago = z.object({
  /**
   * Referencial y sin conciliación: en la práctica es efectivo casi siempre y el
   * negocio no exige registrar el medio real. Guardarlo como dato duro daría una
   * falsa sensación de exactitud sobre algo que nadie comprueba.
   */
  medio: z.enum(['efectivo', 'tarjeta', 'transferencia', 'billetera', 'otro']),
  montoRecibido: importeEnCentimos.nonnegative().optional(),
})

/**
 * La clave de idempotencia identifica **la intención de venta**, no la petición.
 * Un reintento del mismo gesto reutiliza la misma clave; eso es justamente lo
 * que impide el comprobante duplicado. Se exige forma de UUID para que no pueda
 * colisionar entre dispositivos.
 */
export const claveDeIdempotencia = z
  .string()
  .uuid('La clave de idempotencia debe ser un UUID generado en el dispositivo')

export const esquemaDePeticionDeEmision = z.object({
  claveIdempotencia: claveDeIdempotencia,
  tipoDocumento: z.enum(TIPOS_ELEGIBLES),
  /** Nulo significa cliente eventual, que no es un documento en la base. */
  cliente: esquemaDeCliente.nullable(),
  lineas: z
    .array(esquemaDeLineaDePedido)
    .min(1, 'Un comprobante sin líneas sería un comprobante en blanco')
    .max(200),
  condicionPago: esquemaDeCondicionDePago,
  medioPago: esquemaDeMedioDePago,
  /**
   * El total que el cliente calculó. Viaja solo para poder compararlo: si
   * difiere del recalculado, manda el servidor y se registra la discrepancia.
   */
  totalDeclarado: importeEnCentimos.positive(),
  cotizacionId: z.string().trim().min(1).max(200).nullable(),
  capturaId: z.string().trim().min(1).max(200).nullable(),
})

export type PeticionDeEmision = z.infer<typeof esquemaDePeticionDeEmision>

export const esquemaDePeticionDeAnulacion = z.object({
  comprobanteId: claveDeIdempotencia,
  /**
   * El motivo es obligatorio y con contenido: una anulación sin motivo es una
   * anulación que nadie podrá explicar dentro de seis meses.
   */
  motivo: z
    .string()
    .trim()
    .min(4, 'La anulación exige un motivo')
    .max(300),
})

export type PeticionDeAnulacion = z.infer<typeof esquemaDePeticionDeAnulacion>

export const esquemaDeParametros = z.object({
  /**
   * Umbral de identificación del comprador en una boleta. Vive en configuración
   * y no en el código precisamente porque es de origen regulatorio: puede
   * cambiar por norma sin que cambie nada más, y modificarlo tiene que ser
   * barato.
   */
  umbralIdentificacionBoleta: importeEnCentimos.positive(),
  ventanaAnulacion: z.literal('mismo_dia'),
  formatoImpresionPorDefecto: z.enum(['a4', 'rollo']),
})

export type Parametros = z.infer<typeof esquemaDeParametros>

export const esquemaDeSerie = z.object({
  serie: z.string().trim().min(1).max(4),
  tipoDocumento: z.enum(TIPOS_DE_DOCUMENTO),
  vendedorId: z.string().trim().min(1),
  /** Origen del correlativo (ej. 0 → primer doc `serie-0`; 100 → `serie-100`). */
  numeroInicial: z.number().int().nonnegative(),
  /**
   * Último reclamado. Al crear la serie sin emisiones: `numeroInicial - 1`
   * (puede ser -1 si el origen es 0).
   */
  ultimoNumero: z.number().int().min(-1),
  ultimoNumeroConfirmado: z.number().int().min(-1),
  activa: z.boolean(),
})

export type Serie = z.infer<typeof esquemaDeSerie>
