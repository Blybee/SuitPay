# Diseño de la superficie — Mostrador asistido

**Feature**: 001-mostrador-asistido | **Fecha**: 2026-07-28
**Modo de visitante**: Operate — el vendedor viene a completar una tarea, no a decidir ni a leer.
**Sistema visual durable**: [`DESIGN.md`](../../DESIGN.md) · **Verdad de producto**: [`PRODUCT.md`](../../PRODUCT.md)

---

## Contrato de dirección

**THESIS** — Una hoja de trabajo, no un comprobante. Todo el mostrador cabe en una columna: se escribe arriba, el pedido crece en el medio, el total espera abajo. Rechaza el tablero de punto de venta con barra lateral, tarjetas y métricas, y rechaza también hacer que la pantalla parezca el documento que emite.

**OWN-WORLD** — Papel cálido sobre mesa kraft. Tres tintas con significado fijo: negro dice qué hay, rojo qué no es definitivo, violeta de sello qué quedó validado, y el sello solo toca lo ya emitido. Radio cero, superficie plana, cifras tabulares, Atkinson Hyperlegible a gran tamaño.

**STORY** — El vendedor teclea o dicta, ve la lista crecer mientras habla con el cliente, comprueba el total sin buscarlo y emite con una pulsación.

**FIRST VIEWPORT** — Entrada única en una barra que cruza toda la ventana, con el foco puesto; bajo ella la columna de papel con la cabecera de documento y el pedido creciendo hacia abajo, a densidad alta; anclada al pie, otra barra a todo el ancho con el TOTAL al mayor tamaño de la pantalla y EMITIR en la esquina derecha.

**FORM** — La hoja de trabajo. Reencuadre de la dirección asignada por el sorteo (cinta de comprobante, quinta de mi lista ordenada por resonancia, staging `interaction-physics-tension-commit`, seed `6a354f9f`): se conservó su material y se descartó su literalidad por evidencia recogida al visualizarla.

---

## Composición aprobada

Aprobada por el usuario el 2026-07-28 sobre tres composiciones renderizadas.

| Render | Aporta |
|--------|--------|
| [`comp-1-barra-completa.png`](assets/comp-1-barra-completa.png) | **La topología.** Entrada y pie del total como barras a todo el ancho de la ventana; la columna de papel solo para el contenido. El campo más usado es el más ancho de la pantalla y el botón de emitir queda en una esquina, que es el objetivo más fácil de acertar sin apuntar. |
| [`comp-2-columna-unica.png`](assets/comp-2-columna-unica.png) | **La densidad y la etiqueta.** El interlineado que permite ver catorce líneas a la vez, con la última recortada para avisar de que hay más. Y la etiqueta roja junto al tipo de documento que declara una nota de venta sin valor tributario. |
| [`comp-3-revision.png`](assets/comp-3-revision.png) | **La revisión de captura completa**, con la corrección tachada, la elección entre opciones ambiguas, el renglón pendiente, la papeleta de contexto como única sombra, y el botón inhabilitado con el motivo dicho en rojo. Aprobada con una corrección: los renglones revisados conservan las mismas columnas que el pedido normal. |

**Lo que no debe literalizarse de los renders**: los textos exactos, los importes y códigos (datos de demostración inventados), el ancho concreto de los márgenes de mesa, la posición del logotipo, y los colores tal como salieron renderizados. Los colores que mandan son los de `DESIGN.md`. Los renders son estrella polar, no especificación de píxeles: el texto y los controles se construyen como HTML semántico, nunca como imagen.

---

## Por qué esta forma, y qué se aprendió por el camino

La primera dirección hacía que la pantalla entera fuese una cinta de comprobante: el pedido se imprimía, el total viajaba al final del rollo, y emitir era arrancar la cinta arrastrando contra resistencia. Se renderizó antes de escribir código y eso ahorró tres errores.

**El disfraz confundía el objeto.** Alguien que conoce el proyecto de memoria preguntó, viendo las composiciones, si aquello era la interfaz o el documento impreso. Si la duda aparece ahí, aparece en el mostrador, y en facturación es peligrosa: la especificación exige que una nota de venta y el documento interno de contingencia se distingan sin margen de duda de una factura real, y esa distinción se debilita si todo ya parece un comprobante. Además el formato real de impresión hoy es A4, no el rollo. Se conservó el material —papel cálido, tinta, densidad, legibilidad— porque estaba justificado por la escena de uso, y se descartó la literalidad.

**El total no puede viajar con el contenido.** Una composición lo puso al final del rollo y otra anclado al pie. Con seis líneas las dos funcionan; con catorce, la primera empuja el total fuera de pantalla. Anclado al pie.

**El gesto elaborado sobraba.** El arrastre contra resistencia existía para evitar la doble emisión. Contra la experiencia real de años de operación, ese fallo no ocurre con un botón que se deshabilita al pulsarse y cambia de estado, y el vendedor quiere velocidad en la operación que repite cien veces al día. El riesgo que sí existe es otro y la interfaz no lo puede resolver: que la petición llegue al proveedor y la respuesta se pierda por el camino. De eso se ocupa la clave de idempotencia, que es invisible y no cuesta nada.

**Y hay un beneficio no buscado.** Poner la entrada arriba, que era una preferencia del usuario, separa el campo de escribir del botón de emitir por toda la altura de la pantalla. La protección que se quería sacar del gesto la da gratis la posición.

Lo que sobrevive intacto de la exploración es la **corrección contrastada**: la lectura original tachada con la propuesta limpia debajo. Es la gramática de una corrección, no de un rollo de papel, y es mejor que el rojo y verde de editor que se había planteado al principio, porque funciona para quien no distingue esos colores.

---

## Inventario de pantallas

Cinco superficies. La primera es el 90% del uso y las otras cuatro son visitas breves.

| Superficie | Historias | Papel |
|-----------|-----------|-------|
| **El mostrador** (raíz) | US1, US3, US5, US6, US7, US8, US9 | La pantalla única de venta. Todo lo que ocurre en el mostrador ocurre aquí. |
| **Comprobantes** | US4 | Consultar lo emitido y anular dentro del día. Se llega por comando o desde el aviso de una emisión. Es la única superficie donde aparece el sello. |
| **Cotizaciones** | US5 | Recuperar un pedido guardado por su número. |
| **Administración** | US2 | Catálogo, series, usuarios, parámetros. Sentado, sin prisa, poco frecuente. |
| **Ventas a crédito** | US8 | Qué debe cada vecino y desde cuándo. |

No hay pantalla de inicio, ni panel, ni resumen. La aplicación abre en el mostrador con la entrada enfocada. Un vendedor que llega a su puesto ya puede teclear el primer producto sin haber tocado nada.

---

## Jerarquía de la pantalla única

De arriba abajo, con el total rompiendo el orden a propósito porque está anclado al pie:

**1. La entrada.** Una barra fija que cruza toda la ventana, con el campo ocupando casi todo su ancho. Un único campo que acepta las cuatro cosas: nombre de producto, comando con barra, dictado por su botón de micrófono, y fotografía por su botón de cámara. No hay tres cajas distintas: hay una boca de entrada con tres formas de alimentarla. Recibe el foco al abrir.

**2. Banda de degradación.** Cuando algo está caído, aparece justo bajo la entrada, en rojo, y **no desaparece por sí sola**. Dice qué no funciona y qué sí se puede hacer. Va aquí y no entre las líneas del pedido, donde se leería como una línea más.

**3. Cabecera fija de documento.** Tipo de documento, serie y cliente. Nunca se desplaza fuera de vista, porque confundir una boleta con una factura es el error más caro que se puede cometer sin darse cuenta. El tipo se cambia aquí y el pedido no se toca al cambiarlo.

**4. Distintivo de documento interno.** Cuando el tipo elegido es nota de venta o el documento de contingencia, una etiqueta rectangular perfilada en rojo, inmediatamente al lado del tipo de documento, dice **SIN VALOR TRIBUTARIO**. Los documentos regulados no la llevan; la ausencia es la señal y la presencia es explícita.

**5. El pedido.** Las líneas, creciendo hacia abajo, con cabeceras de columna en etiqueta pequeña. Cada línea: descripción, cantidad, precio unitario editable en línea, importe alineado a la derecha. Se desplaza internamente entre la cabecera fija y el pie. La densidad es alta a propósito: catorce líneas deben caber a la vez en un monitor de escritorio, y la última visible se recorta para que se entienda que hay más.

**6. El pie del total.** Una barra anclada al borde inferior de la ventana, también a todo el ancho. Recuento de líneas, medio de pago, el total al mayor tamaño de la pantalla, y el botón de emitir en la esquina derecha. Es lo último que ve el ojo y donde está la mano.

Lo que deliberadamente **no** está en esta pantalla: ninguna métrica, ningún gráfico, ningún contador de ventas del día, ningún avatar, ninguna navegación permanente. El vendedor tiene un cliente delante.

---

## Componentes

### Entrada (`Entrada`)
Un campo, tres alimentaciones, fijo arriba. Al escribir, sugiere productos del catálogo en caché sin latencia. Al empezar con barra, cambia a modo comando y muestra los parámetros que faltan como marcadores dentro del propio campo. Los botones de micrófono y cámara viven en su borde derecho, con objetivos generosos porque se pulsan de pie. Estados: reposo, sugiriendo, comando, grabando, procesando captura, asistencia caída.

### Columna del pedido (`Pedido`)
La región de contenido. Papel cálido sobre la mesa kraft, medida de trabajo fija, sin sombra. Crece hacia abajo y no se ensancha nunca. Estados: vacía, con líneas, en revisión de captura, emitida.

### Línea de pedido (`LineaPedido`)
Descripción a la izquierda; cantidad, precio unitario e importe a la derecha en cifras tabulares. El precio es editable en el sitio, sin abrir nada y sin validación: se toca, se escribe, se recalcula. Estados: normal, precio ajustado (el precio de catálogo queda tachado en tinta desvaída al lado), ambigua, pendiente, importe no positivo (que bloquea la emisión).

### Pie del total (`PieTotal`)
Total, recuento de líneas, medio de pago y el botón de emitir. El botón se deshabilita en el instante de la pulsación y cambia a un estado de emisión en curso; no admite una segunda pulsación. Cuando no se puede emitir, el botón está inhabilitado **con el motivo dicho en rojo debajo**, nunca insinuado. Estados: inhabilitado (falta serie, importe no positivo, cliente exigido por umbral, renglones sin resolver), listo, emitiendo, emitido.

### Revisión contrastada (`RevisionCaptura`)
La forma que toma la columna al volver de un dictado o una fotografía. Por cada renglón: la lectura original en tinta desvaída y tachada, y debajo, sangrada, la propuesta limpia con su código. Las propuestas conservan **las mismas columnas que el pedido normal** —código, cantidad, precio, importe, cada una en su sitio— para que al aprobar no cambie nada de lugar y el ojo no tenga que reaprender la línea. Cuando el sistema no puede decidir, la propuesta se convierte en dos o tres opciones seleccionables, en rojo hasta que se elige una. Un renglón que no se pudo interpretar queda en rojo con la marca de pendiente, y **no se puede emitir mientras quede uno sin resolver**. Aprobar convierte la revisión en líneas normales.

### Papeleta de contexto (`PapeletaContexto`)
El modal de contexto. Una hoja pequeña dejada encima, con leve rotación y la única sombra del sistema. Aparece cuando falta un dato, cuando hay varias coincidencias de cliente o producto, o cuando hay que confirmar algo antes de seguir. Contiene solo lo que hace falta resolver y devuelve al sitio exacto donde estaba el vendedor. Nunca contiene una decisión irreversible.

### Sello (`Sello`)
La marca de validación. Violeta, ligeramente rotada, con tinta desigual. EMITIDO, ACEPTADO, PAGADO, COBRADO. **Solo aparece sobre documentos ya emitidos**, en la superficie de comprobantes, nunca sobre el pedido en curso. La regla es literal: si tiene sello, existe ante SUNAT.

### Marca de estado (`MarcaEstado`)
ANULADO cruzando un comprobante en rojo, o PENDIENTE DE COMPROBANTE en el documento interno de contingencia. El documento sigue debajo, legible: no se borra nada, se marca encima.

### Banda de degradación (`BandaDegradacion`)
Roja, fijada bajo la entrada, persistente hasta que la causa se resuelve. Dice qué está caído y qué se puede seguir haciendo. Nunca es una notificación que se desvanece.

### Cabecera de documento (`CabeceraDocumento`)
Selector de tipo de documento, serie, y cliente con su alta en contexto. El cambio de tipo no destruye el pedido. Si el importe supera el umbral y el cliente es eventual, la cabecera se marca en rojo y el pie queda inhabilitado con el motivo dicho.

---

## Estados que el diseño debe cubrir

La especificación tiene catorce casos límite. Estos son los que exigen forma visual propia, y son también los que se olvidan si no se listan.

| Estado | Cómo se ve |
|--------|-----------|
| **Pedido vacío** (primera carga del día) | La columna con sus cabeceras de columna y la entrada enfocada. Ninguna ilustración, ningún mensaje de bienvenida. Se puede teclear ya. |
| **Sin conexión** | Banda roja bajo la entrada diciendo que se trabaja sin red y que la búsqueda sigue funcionando. La columna y la entrada siguen operativas. |
| **Asistencia caída** | Los botones de micrófono y cámara quedan visiblemente inertes, con el motivo dicho en la entrada. Escribir no se presenta como un plan B, porque no lo es. |
| **Proveedor caído** | El botón cambia su etiqueta: emitir dejará la venta en espera y producirá el documento interno. El cambio se anuncia **antes** de pulsar, no después. |
| **Emisión en vuelo** | El botón deshabilitado con el avance a la vista. No se puede volver a pulsar. |
| **Emisión indeterminada** | La columna queda con la marca de indeterminado y **no se ofrece reintentar**. Dice que se está averiguando qué pasó y qué hacer con el cliente que está delante. Es el estado más delicado de todo el sistema y el que peor se resuelve con una interfaz genérica. |
| **Requiere intervención** | Rojo persistente, con el comprobante y su historia visibles y una vía explícita para escalar. No se cierra solo. |
| **Serie no configurada** | Botón inhabilitado con el texto que dice exactamente qué falta y a quién pedírselo. |
| **Cliente exigido por umbral** | Cabecera en rojo y botón inhabilitado, con el importe y el umbral a la vista para que se entienda por qué. |
| **Cotización ya convertida** | Papeleta de contexto diciendo en qué comprobante terminó, con la vía para abrirlo. |
| **Fotografía ilegible** | La revisión aparece vacía con el motivo y la opción de reintentar con otra foto. La foto original se conserva. |
| **Fuera de ventana de anulación** | El comprobante muestra que solo se anula el mismo día y que ahora corresponde nota de crédito. No se ofrece un botón que va a fallar. |
| **Sesión inválida** | Se impide emitir y se pide reautenticar sin perder el pedido, que vive en el dispositivo. |

---

## Movimiento

Poco y con propósito. Es una herramienta que se usa cien veces al día y la animación que encanta la primera vez estorba la centésima.

**La línea nueva** aparece de inmediato, sin desvanecido ni desplazamiento largo. Como mucho, un asentamiento muy breve que confirme dónde cayó.

**El sello** cae de una vez, sin animación de entrada. Un sello no se desliza. Es el único momento con algo de gracia en todo el sistema, y solo ocurre al emitir.

**El botón de emitir** cambia de estado sin transición decorativa: el vendedor necesita saber que ya está pulsado, no verlo animarse.

Con movimiento reducido activado, todo aparece sin transición. Nada de la funcionalidad depende del movimiento.

---

## Accesibilidad de esta superficie

Vienen de la escena real, no de una norma: el vendedor está de pie, el monitor está lejos, hay prisa, hay ruido y hay vista cansada.

- Tamaños de texto y de objetivo generosos en todo lo que se toca de pie. La entrada y el pie del total son los dos elementos más grandes que se manipulan.
- Una venta completa debe poder hacerse **solo con teclado**, incluida la emisión. No se puede depender de la precisión del puntero.
- Nada crítico tras un paso del ratón por encima, un menú desplegable o un gesto oculto.
- Ningún estado se distingue solo por color: siempre hay tachado, peso, sangrado, sello o etiqueta acompañando.
- Ninguna señal importante es solo sonora, porque el local es ruidoso. El mismo ruido es la razón de que el dictado no pueda ser la vía principal.
- Contraste alto sobre papel cálido, pensado para luz de día entrando por una fachada abierta.

---

## Decisiones que un implementador no debe inventar

- **La pantalla no imita un comprobante.** Nada de perforaciones, dentados, bordes rasgados ni simulación de impresión térmica. Si alguien duda de si está mirando la interfaz o el documento, es un error.
- **El sello solo toca lo ya emitido.** Nunca el pedido en curso.
- **El verde no existe.** Un estado positivo se marca con el sello.
- **Radio cero** en todo.
- **Solo las superposiciones proyectan sombra.**
- **La columna no se ensancha** para llenar la pantalla, ni se convierte en tablero de métricas.
- **No hay barra lateral** de navegación permanente.
- **No hay modo oscuro.**
- **La entrada va arriba y el total anclado abajo**, ambos en barras a todo el ancho de la ventana. Ninguno de los dos se desplaza fuera de vista.
- **La etiqueta SIN VALOR TRIBUTARIO** acompaña al tipo de documento siempre que no sea un comprobante regulado.
- **Emitir es un botón**, deshabilitado al pulsar. Nada de arrastres ni de mantener pulsado.
- **La palabra "eliminar"** no aparece referida a un comprobante emitido, en ninguna etiqueta ni mensaje.
- **La ventana de anulación** se calcula en la zona horaria de Lima. Calcularla en UTC volvería inanulable una venta de las siete de la tarde a los pocos minutos.

## Decisiones que siguen abiertas

- **Valores exactos** de la escala de espaciado y del ancho de la columna: se fijan en la primera implementación y se recogen luego en `DESIGN.md`.
- **Disponibilidad del compañero monoespaciado** de Atkinson Hyperlegible; si no existe, la alternativa es Martian Mono.
- **La composición del comprobante impreso** (A4 hoy, rollo más adelante) es un asunto aparte de esta superficie y lo determina el formato que exige SUNAT. No se decide aquí.
