/**
 * Datos del emisor para documentos internos (cotización y nota de venta).
 * No salen hacia el proveedor ni hacia servicios de IA.
 */

export const EMISOR_INTERNO = {
  razonSocial: 'Distribuidora Salomon Pacifico S.A.C.',
  direccion: 'Jr. Lampa 1062 | Jr. Paruro 1132 - INT. 142 - Lima',
  ruc: 'R.U.C. Nº 20535643998',
} as const
