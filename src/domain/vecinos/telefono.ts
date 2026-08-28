/**
 * Teléfono peruano para WhatsApp click-to-chat.
 *
 * wa.me no admite adjuntar una imagen: solo abre el chat. La captura se copia
 * al portapapeles y el vendedor la pega. No hay API web para enviar un PNG
 * directo al hilo de un número sin WhatsApp Business.
 */

const PATRON_SOLO_DIGITOS = /\D/g

export function normalizarTelefonoPeru(bruto: string): string | null {
  const digitos = bruto.replace(PATRON_SOLO_DIGITOS, '')
  if (digitos.length === 0) return null

  let nacional = digitos
  if (nacional.startsWith('51') && nacional.length >= 11) {
    nacional = nacional.slice(2)
  }
  if (nacional.startsWith('0')) {
    nacional = nacional.slice(1)
  }
  if (!/^9\d{8}$/.test(nacional)) return null
  return `51${nacional}`
}

export function sanitizarEntradaTelefono(bruto: string): string {
  const recortado = bruto.trim()
  if (recortado === '') return ''
  const conPlus = recortado.startsWith('+')
  const digitos = recortado.replace(PATRON_SOLO_DIGITOS, '')
  return conPlus ? `+${digitos}` : digitos
}

export function enlaceChatWhatsApp(telefono: string): string | null {
  const e164 = normalizarTelefonoPeru(telefono)
  if (e164 === null) return null
  return `https://wa.me/${e164}`
}

export function telefonoEsValido(bruto: string): boolean {
  return normalizarTelefonoPeru(bruto) !== null
}
