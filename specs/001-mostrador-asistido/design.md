# Diseño de la superficie — Mostrador asistido

**Feature**: 001-mostrador-asistido | **Fecha**: 2026-07-28  
**Enmienda**: 2026-07-29 (volcado 5 — Modern Soft-Pill, sidebar, tabs, full-bleed)  
**Enmienda**: 2026-08-06 (polish cabecera cliente + cotización en selector + contador de líneas)  
**Enmienda**: 2026-08-07 (borrado de cotizaciones + tab Vecinos como cotizaciones por alias)  
**Modo de visitante**: Operate — el vendedor viene a completar una tarea, no a decidir ni a leer.  
**Sistema visual durable**: [`DESIGN.md`](../../DESIGN.md) · **Verdad de producto**: [`PRODUCT.md`](../../PRODUCT.md)

---

## Contrato de dirección

**THESIS** — Una herramienta de venta, no un comprobante. Shell con sidebar; el mostrador ocupa todo el ancho útil con tabs internos. Se escribe arriba, el pedido crece en el medio, el total espera abajo. Rechaza el tablero de métricas y rechaza hacer que la pantalla parezca el documento que emite.

**OWN-WORLD** — Modern Soft-Pill: superficies blancas sobre lienzo gris claro, controles en cápsula (`rounded-full`), paneles con radios amplios (`rounded-2xl` / `rounded-3xl`), bordes sutiles o ninguno, sombras naturales (`shadow-sm` / `shadow-md`). Tres tintas semánticas: negro dice qué hay, rojo qué no es definitivo, violeta de sello qué quedó validado. Atkinson Hyperlegible a gran tamaño; cifras tabulares.

**STORY** — El vendedor abre en el mostrador (tab Pedido, tipo Nota de Venta por defecto), teclea o dicta, ve la lista crecer mientras habla con el cliente, comprueba el total sin buscarlo y emite con una pulsación.

**FIRST VIEWPORT** — Sidebar a la izquierda (marca SuitPay arriba; Inicio y Configuración; perfil + logout al pie). A la derecha, el área de trabajo a todo el ancho: buscador + tabs Pedido | Cotizaciones | Vecinos | Lista en un bloque compacto; cabecera de documento; pedido denso; pie del total con EMITIR (o Guardar si el tipo es Cotización).

**FORM** — Soft-Pill de trabajo. Sustituye el contrato anterior (papel cálido / mesa kraft / radio cero / sin barra lateral) por enmienda del volcado 5. Se conserva la lección crítica: la UI no debe parecer un comprobante.

---

## Composición aprobada

### Obsoleta (2026-07-28)

Aprobada el 2026-07-28 sobre tres composiciones. **Queda inválida** tras el pivote Soft-Pill y el shell con sidebar. No implementar contra estos renders.

| Render | Aportaba (histórico) | Estado |
|--------|----------------------|--------|
| [`comp-1-barra-completa.png`](assets/comp-1-barra-completa.png) | Topología barra completa + columna de papel | **Obsoleto** |
| [`comp-2-columna-unica.png`](assets/comp-2-columna-unica.png) | Densidad y etiqueta SIN VALOR TRIBUTARIO | **Obsoleto** (conservar la lección de densidad y la etiqueta) |
| [`comp-3-revision.png`](assets/comp-3-revision.png) | Revisión contrastada y papeleta | **Obsoleto** (conservar la gramática de corrección) |

**Antes de implementar el pivote visual** se requiere una nueva composición aprobada que muestre: sidebar + tabs + Soft-Pill + full-bleed. Hasta entonces, este documento y `DESIGN.md` mandan sobre los PNG.

### Lo que sobrevive de la exploración previa

- Corrección contrastada (original tachado + propuesta limpia).
- Total anclado al pie (no viaja con el scroll del pedido).
- Entrada arriba, emit abajo (separación espacial).
- Emitir = botón que se deshabilita al pulsar (sin gestos elaborados).
- Etiqueta **SIN VALOR TRIBUTARIO** junto al tipo cuando aplica.
- Densidad: catorce líneas visibles en escritorio.

---

## Por qué esta forma, y qué se aprendió por el camino

La primera dirección hacía que la pantalla entera fuese una cinta de comprobante. Se descartó por confundir interfaz y documento.

Se conservó un tiempo el material “papel cálido / radio cero / sin sidebar”. El volcado 5 pivota a Soft-Pill y pide sidebar, tabs y full-bleed: el material cambia; la distinción herramienta ≠ comprobante no.

**El total no puede viajar con el contenido.** Anclado al pie del área de trabajo.

**El gesto elaborado sobraba.** Idempotencia invisible; botón que se deshabilita.

**Perfil al pie del sidebar.** Reduce logout accidental; marca y nav quedan arriba.

---

## Inventario de pantallas

| Superficie | Historias | Papel |
|-----------|-----------|-------|
| **El mostrador** (Inicio) | US1, US3, US5, US6, US7, US8, US9 | Área principal con tabs Pedido \| Cotizaciones \| Vecinos \| Lista. |
| **Configuración** | US2 (+ series/usuarios/parámetros) | Ítem del sidebar. Alcance por rol: [NEEDS CLARIFICATION en intake — ¿solo admin?]. |
| **Comprobantes** | US4 | Consultar lo emitido y anular dentro del día. Única superficie del sello. Acceso por comando o aviso de emisión. |

La aplicación abre en **Inicio → tab Pedido**, con tipo de documento **Nota de Venta** y la entrada enfocada.

El significado exacto del tab **Lista** queda abierto en el intake (volcado 5).

---

## Jerarquía del shell y del mostrador

**Shell**

1. **Sidebar.** Marca SuitPay (arriba) → nav (Inicio, Configuración) → perfil + logout (abajo).
2. **Área de trabajo.** Resto del viewport, fondo lienzo gris; paneles blancos suaves.

**Mostrador (tab Pedido — 90% del uso)**

1. **Tabs.** Pedido | Cotizaciones | Vecinos | Lista.
2. **La entrada.** Campo ancho con micrófono y cámara; acepta producto, comando `/`, dictado y foto. Foco al abrir.
3. **Banda de degradación.** Bajo la entrada cuando algo está caído; no desaparece sola.
4. **Cabecera fija de documento.** Selector de tipo (Boleta | Factura | Nota de venta | **Cotización**), serie cuando aplica, cliente. Cotización es modo borrador (no tributario): el pie muestra **Guardar** y persiste en el tab Cotizaciones. Cambio de tipo no destruye las líneas.
5. **Cliente en cabecera.** Label ciclable (chevrons): factura = RUC; boleta = DNI|Nombre; cotización = RUC|DNI|Nombre. Confirmación **manual con Enter** (no al completar dígitos); errores visibles si faltan dígitos. Nombre fija cliente eventual al instante (marcador `00000000`); botón «Usar» aparte cuando hay nombre listo. Documento: al Enter, loader mientras resuelve; si ya está registrado, fija al pedido de inmediato; si no, consulta padrón y abre el **diálogo de alta**. El «+» siempre abre «Buscar o Agregar cliente» (no confirma el campo). Sin panel inline de confirmación de cliente.
6. **Selector de tipo.** Boleta/factura muestran la serie en la etiqueta (`Boleta · B001`). Cotización no lleva badge aparte.
7. **El pedido.** Líneas densas; cabecera de columna **Producto (N)** con el conteo; precio editable inline; scroll interno entre cabecera y pie.
8. **El pie del total.** Medio de pago (oculto en modo cotización), total grande, CTA a la derecha: **EMITIR** o **Guardar**.

Lo que deliberadamente **no** está: métricas, gráficos, contadores del día, avatares decorativos.

---

## Componentes

### Sidebar (`BarraLateral`)
Marca, nav, perfil al pie. Controles en cápsula. Superficie blanca sobre lienzo.

### Entrada (`Entrada`)
Un campo, tres alimentaciones. Sugerencias locales; modo comando con `/`. Objetivos generosos. Estados: reposo, sugiriendo, comando, grabando, procesando, asistencia caída, **propuesta pendiente de confirmación** (p. ej. `/crear vecino {alias} {DNI/RUC}` → chip/propuesta Confirmar | Cancelar; sin escritura hasta confirmar).

**Modo comando (obligatorio al implementar cualquier comando nuevo):**
- Al empezar con `/`, **no** se muestran sugerencias de producto; sí una **lista seleccionable** de comandos del catálogo (filtrada por prefijo).
- Al elegir un comando de la lista, el input recibe el prefijo y los parámetros que faltan se muestran como **texto fantasma** gris (p. ej. `/crear vecino` → `{alias} {DNI/RUC}`).
- Fuente de verdad del catálogo de pistas: [`src/features/comandos/pistas.ts`](../../src/features/comandos/pistas.ts) → `CATALOGO_DE_COMANDOS`.
- **Todo comando nuevo MUST añadir** una entrada `{ id, prefijo, parametros }` en ese catálogo (y su parseo/ejecución aparte). Sin esa entrada no hay pista ni fila en la lista.
- La barra del panel de sugerencias usa un icono de **ojo centrado** para ocultar resultados (no un minimizar alineado a la derecha).

### Tabs del mostrador (`PestanasMostrador`)
Pedido | Cotizaciones | Vecinos | Lista. Cápsulas o subrayado suave; el tab activo contraste claro.

### Tab Cotizaciones (`PanelDeCotizaciones`)
Lista de cotizaciones `canal` general. Cada fila: resumen (#, cliente, líneas, total) a la izquierda; a la derecha un control de eliminar (**solo icono**, sin borde ni fondo en reposo; en hover fondo rojo suave) que abre diálogo de confirmación antes del borrado duro. Pulsar la fila abre la cotización en Pedido.

### Tab Vecinos
No es una lista plana como Cotizaciones. **Sub-tabs internos** por `aliasVecino` (solo el alias como etiqueta). El cuerpo del tab activo reutiliza la densidad del pedido: cabeceras de columna Producto / Cant. / Precio / Importe, líneas editables y **total** visible. Con un sub-tab activo, las altas desde Entrada caen en esa cotización viva. Vacío inicial: mensaje breve + pista del comando `/crear vecino …`.

### Región del pedido (`Pedido`)
Panel blanco a todo el ancho útil del área de trabajo (`rounded-2xl` / `3xl` si es contenedor). Estados: vacía, con líneas, en revisión, emitida. La misma gramática de líneas/total aplica dentro de cada sub-tab de Vecinos.

### Línea de pedido (`LineaPedido`)
Igual semántica que antes; formas Soft-Pill en controles editables.

### Pie del total (`PieTotal`)
Total y CTA en cápsula: Emitir (venta) o Guardar (modo Cotización del selector). Medio de pago solo en venta. Motivo de bloqueo en rojo cuando aplica. El conteo de líneas vive en la cabecera de columna Producto, no en el pie.

### Cabecera de documento (`CabeceraDocumento`)
Tipo + Cotización; input de documento; icon-button «+» abre «Buscar o Agregar cliente». En ese modal, toda búsqueda lista resultados con «Usar» y «Editar»; «Usar» se deshabilita si el documento no aplica al tipo (factura→RUC, boleta→DNI). Documento nuevo (sin registro) dispara consulta de padrón + revisión/alta. Cliente registrado desde el campo de cabecera se fija al pedido sin paso intermedio. Modo Nombre: Enter/«Usar» fija la denominación al pedido.

### Diálogo post-emisión (`EstadoDeEmision`)
Tras EMITIR con éxito: número, total y acciones **Imprimir**, **Guardar/descargar** y **Compartir** usando la URL de PDF de la respuesta cuando exista. No abrir el PDF sin gesto del vendedor.

### Revisión contrastada (`RevisionCaptura`)
Sin cambio de gramática: tachado + propuesta; mismas columnas al aprobar.

### Papeleta de contexto (`PapeletaContexto`)
Modal suave (`rounded-2xl` + `shadow-md`). Única elevación fuerte. Nunca decisión irreversible.

### Sello (`Sello`)
Solo sobre emitidos. Regla literal: si tiene sello, existe ante SUNAT.

### Marca de estado / Banda / Cabecera
Misma semántica; sin bordes gruesos ni radio cero.

---

## Estados que el diseño debe cubrir

| Estado | Cómo se ve |
|--------|-----------|
| **Pedido vacío** | Panel con cabeceras de columna y entrada enfocada. Sin bienvenida. |
| **Sin conexión** | Banda roja; búsqueda local sigue. |
| **Asistencia caída** | Micrófono/cámara inertes con motivo; escribir sigue siendo la vía. |
| **Proveedor caído** | Etiqueta del botón anticipa venta en espera / documento interno. |
| **Emisión en vuelo** | Botón deshabilitado; sin segunda pulsación. |
| **Emisión indeterminada** | Sin reintentar a ciegas; mensaje de qué hacer con el cliente. |
| **Requiere intervención** | Rojo persistente + vía de escalado. |
| **Serie no configurada** | Botón inhabilitado con texto exacto de qué falta. |
| **Cliente exigido por umbral** | Cabecera en rojo; motivo visible. |
| **Cotización ya usada / inexistente** | Aviso de que la cotización ya no existe (convertida o eliminada); no ofrece reintentar la misma conversión. |
| **Confirmar eliminar cotización** | Diálogo/papeleta: qué cotización se borra; Confirmar | Cancelar. |
| **Propuesta crear vecino** | Resumen alias + DNI/RUC; Confirmar | Cancelar. Sin efecto hasta confirmar. |
| **Fotografía ilegible** | Revisión vacía + reintentar; foto conservada. |
| **Fuera de ventana de anulación** | Solo nota de crédito; no botón que fallará. |
| **Sesión inválida** | Reautenticar sin perder el pedido local. |

---

## Movimiento

Poco y con propósito. Línea nueva casi inmediata. Sello sin deslizamiento. Botón de emitir sin transición decorativa. Con `prefers-reduced-motion`, sin transición.

---

## Accesibilidad de esta superficie

- Objetivos generosos (de pie).
- Venta completa solo con teclado.
- Nada crítico solo en hover.
- Estados con segunda señal además del color.
- Nada crítico solo sonoro.
- Contraste alto sobre lienzo claro (gris/blanco), luz de día.

---

## Decisiones que un implementador no debe inventar

- **La pantalla no imita un comprobante.**
- **El sello solo toca lo ya emitido.**
- **El verde no existe.**
- **Soft-Pill obligatorio:** cápsulas en controles; radios amplios en paneles; sin `rounded-none` / `rounded-sm` como carácter.
- **Sin bordes gruesos ni sombras brutales.**
- **Sin papel/mesa amarillentos** como fondo de app.
- **Hay sidebar** con marca arriba y perfil+logout abajo.
- **Contenido a todo el ancho** del área de trabajo.
- **Tabs** Pedido | Cotizaciones | Vecinos | Lista en el mostrador.
- **Vecinos** = cotizaciones por alias (sub-tabs + líneas + total), no módulo de crédito/cobro.
- **Default de tipo:** Nota de Venta.
- **No hay modo oscuro.**
- **Entrada arriba, total abajo.**
- **Etiqueta SIN VALOR TRIBUTARIO** cuando no hay valor tributario.
- **Emitir es un botón** deshabilitado al pulsar.
- **La palabra "eliminar"** no aparece referida a un comprobante emitido; sí puede usarse para cotizaciones pendientes (FR-019a), siempre con confirmación.
- **`/crear vecino`** nunca escribe solo: siempre propuesta a confirmar.
- **Nuevos comandos:** registrar prefijo + parámetros en `CATALOGO_DE_COMANDOS` (`src/features/comandos/pistas.ts`); ocultar sugerencias de producto en modo `/` y mostrar lista seleccionable del catálogo.
- **Guía de remisión / transportistas:** ver feature `002-guias-remision` (no ampliar tabs del mostrador por GRE).
- **Ventana de anulación** en zona horaria `America/Lima`.
- **No implementar contra los PNG obsoletos** sin nueva aprobación visual.

## Decisiones que siguen abiertas

- Nueva composición Soft-Pill + sidebar + tabs (aprobación visual).
- Significado del tab **Lista**.
- Quién entra a **Configuración** (solo admin vs también vendedor).
- Valores exactos de espaciado del shell: se fijan en la primera implementación Soft-Pill y se recogen luego en `DESIGN.md`.
- Maquetación de `formato_pdf: ticket` en impresora de rollo.
