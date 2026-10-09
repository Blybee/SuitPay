function escapar(texto: string): string {
  return texto
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}

function comando(x: number, y: number, texto: string): string {
  return `1 0 0 1 ${x} ${y} Tm (${escapar(texto)}) Tj\n`
}

function armarPdf(contenidos: readonly string[]): Uint8Array {
  const objetos: string[] = ['']
  const idsPagina: number[] = []
  objetos[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  for (let i = 0; i < contenidos.length; i += 1) {
    const idPagina = 4 + i * 2
    const idContenido = idPagina + 1
    idsPagina.push(idPagina)
    const stream = contenidos[i] ?? ''
    objetos[idContenido] =
      `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`
    objetos[idPagina] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${idContenido} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`
  }
  objetos[2] = `<< /Type /Pages /Kids [${idsPagina.map((id) => `${id} 0 R`).join(' ')}] /Count ${contenidos.length} >>`
  objetos[1] = '<< /Type /Catalog /Pages 2 0 R >>'

  let cuerpo = '%PDF-1.4\n'
  const offsets: number[] = [0]
  for (let id = 1; id < objetos.length; id += 1) {
    offsets[id] = Buffer.byteLength(cuerpo)
    cuerpo += `${id} 0 obj\n${objetos[id]}\nendobj\n`
  }
  const inicioXref = Buffer.byteLength(cuerpo)
  let xref = `xref\n0 ${objetos.length}\n0000000000 65535 f \n`
  for (let id = 1; id < objetos.length; id += 1) {
    xref += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`
  }
  cuerpo += xref
  cuerpo += `trailer\n<< /Size ${objetos.length} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`
  return new Uint8Array(Buffer.from(cuerpo))
}

/** 14 clientes por página, con la línea VENDEDOR que el parser debe ignorar. */
export function pdfDeClientesSinteticos(paginas: number): Uint8Array {
  const contenidos: string[] = []
  let n = 1
  for (let p = 0; p < paginas; p += 1) {
    let cuerpo = 'BT\n/F1 9 Tf\n'
    cuerpo += comando(226, 760, 'RELACION DE CLIENTES')
    for (let fila = 0; fila < 14; fila += 1) {
      const y = 720 - fila * 48
      const dni = n % 7 === 0
      const documento = dni
        ? String(10_000_000 + n)
        : String(10_000_000_000 + n)
      cuerpo += comando(30, y, String(n))
      cuerpo += comando(110, y, documento)
      cuerpo += comando(220, y, `CLIENTE SINTETICO ${n} DISTRIBUIDORA`)
      cuerpo += comando(220, y - 14, `AV PRUEBA ${n} LIMA`)
      cuerpo += comando(220, y - 28, 'VENDEDOR: NADIE')
      n += 1
    }
    cuerpo += 'ET\n'
    contenidos.push(cuerpo)
  }
  return armarPdf(contenidos)
}
