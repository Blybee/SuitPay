export function archivoABase64(archivo: File): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader()
    lector.onload = () => {
      const bruto = String(lector.result ?? '')
      const coma = bruto.indexOf(',')
      resolver(coma >= 0 ? bruto.slice(coma + 1) : bruto)
    }
    lector.onerror = () => rechazar(lector.error ?? new Error('lectura'))
    lector.readAsDataURL(archivo)
  })
}

export function mimeDeArchivo(archivo: File):
  | 'application/pdf'
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | null {
  if (archivo.type === 'application/pdf' || archivo.name.toLowerCase().endsWith('.pdf')) {
    return 'application/pdf'
  }
  if (archivo.type === 'image/jpeg' || /\.jpe?g$/i.test(archivo.name)) {
    return 'image/jpeg'
  }
  if (archivo.type === 'image/png' || archivo.name.toLowerCase().endsWith('.png')) {
    return 'image/png'
  }
  if (archivo.type === 'image/webp' || archivo.name.toLowerCase().endsWith('.webp')) {
    return 'image/webp'
  }
  return null
}
