---
name: SuitPay
description: La hoja de trabajo del vendedor: papel cálido, tinta precisa, todo legible de pie y a distancia. El comprobante es lo que sale de aquí, no lo que se ve aquí.
---

<!-- SEED: acordado con el usuario antes de implementar. Los valores exactos se fijan en la primera construcción; vuelve a ejecutar /impeccable document cuando haya código para recoger los tokens y componentes reales. -->

# Design System: SuitPay

## Overview

**Creative North Star: "La hoja de trabajo"**

La pantalla es el papel de trabajo del vendedor, no el comprobante. Es la hoja donde se anota el pedido, se negocia el precio, se corrige lo mal leído y se decide qué documento emitir. El comprobante es lo que **sale** de esta hoja: lo compone el proveedor de emisión con el formato que exige SUNAT y se imprime en A4, o en rollo cuando la empresa migre. Son dos objetos distintos y el sistema nunca los confunde.

Esa distinción es la decisión de diseño más importante del sistema, y se aprendió por evidencia. Una primera dirección hizo que la pantalla entera pareciese una cinta de comprobante impresa; al verla renderizada, alguien que conoce el proyecto de memoria preguntó si era la interfaz o el documento. Si esa duda aparece ahí, aparece en el mostrador. Y en facturación es peligrosa: la especificación exige que una nota de venta y el documento interno de contingencia se distingan **sin margen de duda** de una factura real, y esa distinción se pierde si todo ya parece un comprobante.

De modo que el material se queda y el disfraz se va. El papel cálido, la tinta negra, los importes tabulares y la tipografía diseñada para vista cansada estaban justificados por la escena de uso, no por la metáfora: una fachada abierta de centro mayorista con luz de día entrando, un monitor a distancia, un vendedor de pie con prisa y con la vista gastada. Lo que se va es la cinta, la perforación, el gesto de arrancar y la simulación de una impresión térmica.

Queda un solo guiño, y precisamente donde no engaña: **el sello**. Un comprobante ya emitido lleva su sello de validación, porque ahí sí es un documento. La hoja de trabajo nunca lo lleva. La regla es literal: si tiene sello, existe ante SUNAT.

Lo que este mundo rechaza es el tablero de punto de venta genérico —barra lateral oscura, tarjetas redondeadas, filas alternas, botón azul primario, verde de éxito— y también la terminal retro de fósforo verde. No es una pantalla de fósforo ni un rollo de papel: es una herramienta de trabajo bien hecha, en papel y tinta.

**Key Characteristics:**

- Una columna de trabajo centrada, densa y a gran escala; nunca un tablero de widgets.
- Tres tintas con significado fijo sobre fondo de papel cálido; ningún color decorativo y **nunca verde**.
- Radio cero en todo. La precisión se lee en las esquinas rectas y en la alineación.
- Superficie plana. Solo lo que flota de verdad proyecta sombra.
- El sello violeta aparece únicamente sobre lo ya emitido.
- Claro siempre. No hay modo oscuro.

## Colors

Paleta completa de tres tintas con roles nombrados sobre un fondo de papel. En cualquier pantalla, la abrumadora mayoría de la superficie es papel y tinta negra; el rojo y el violeta son escasos por diseño.

### Primary

- **Tinta** (`#1A1714`): negro cálido, nunca negro puro, porque el negro puro sobre papel cálido vibra. Todo el contenido: descripciones, cantidades, importes, etiquetas. Es la tinta que dice **qué hay**.

### Secondary

- **Rojo de aviso** (`#C2321C`): dice **qué no es definitivo o qué está mal**. El texto extraído de un dictado o una fotografía que espera ser reemplazado, un renglón sin resolver, una venta en espera, la marca de ANULADO, la banda de degradación, y el motivo por el que no se puede emitir. Nunca se usa para llamar la atención sobre algo que está bien.

### Tertiary

- **Violeta de sello** (`#4C3F91`): dice **qué quedó validado ante SUNAT o ante el cliente**. Emitido, aceptado, pagado, cobrado. Es la única marca celebratoria del sistema y solo aparece sobre documentos ya emitidos, nunca sobre el pedido en curso.

### Neutral

- **Papel** (`#F7F4EC`): el fondo de la hoja de trabajo. Blanco cálido, nunca blanco puro.
- **Mesa** (`#DED7C7`): el tono kraft del entorno alrededor de la hoja, que la hace legible como una región de contenido y no como el fondo de la página.
- **Tinta desvaída** (`#8A8378`): etiquetas secundarias, reglas separadoras, y el texto tachado de una corrección. Es tinta gastada, no gris de interfaz.

### Named Rules

**La Regla de las Tres Tintas.** El sistema tiene exactamente tres tintas y cada una tiene un significado fijo: negro dice qué hay, rojo dice qué no es definitivo o qué está mal, violeta dice qué quedó validado. Un color usado porque quedaba bien es un error.

**No existe el verde.** No porque el papel no lo tenga, sino por dos razones que siguen en pie sin la metáfora: rojo y verde es el peor par posible para el porcentaje nada pequeño de hombres con deficiencia rojo-verde, y este es un sistema donde "no definitivo" y "validado" no pueden confundirse nunca. Un estado positivo se marca con el sello.

**La Regla del Color Escaso.** Rojo y violeta juntos no ocupan más del 10% de ninguna pantalla. Si una pantalla se ve colorida, algo se está marcando que no lo merece.

**La Regla de la Redundancia.** Ningún estado se distingue únicamente por color. Tachado, peso, sangrado, sello o etiqueta acompañan siempre. Hay vendedores con la vista cansada y el color solo no basta.

## Typography

**Body Font:** Atkinson Hyperlegible (con fallback a la pila del sistema)
**Números y códigos:** el compañero monoespaciado de Atkinson Hyperlegible; si no estuviera disponible, Martian Mono. `[verificar disponibilidad al andamiar]`

**Character:** Atkinson Hyperlegible no se elige por gusto: la diseñó el Braille Institute para baja visión, diferenciando expresamente los caracteres que se confunden entre sí, y una verdad de producto confirmada es que parte de los vendedores tiene la vista cansada y lee a distancia. El compañero monoespaciado sostiene la columna de importes y los códigos de producto, que se leen carácter a carácter. No hay tipografía de display: el registro es de trabajo, y el papel de "display" lo cumple el total, impreso a gran tamaño en la misma familia.

### Hierarchy

- **Total** (peso alto, el mayor tamaño de la pantalla): el importe a cobrar. Es el único elemento legible desde otro puesto.
- **Línea de pedido** (monoespaciada para los números, tamaño generoso): descripción, cantidad, precio e importe. Es el contenido que más se lee del sistema y por eso es lo segundo más grande.
- **Cabecera de documento** (peso alto, tamaño medio): tipo de documento, serie y cliente. Fija, nunca se desplaza fuera de vista.
- **Etiqueta** (monoespaciada, pequeña, tracking abierto, mayúsculas): los nombres de campo y de columna. Tinta desvaída.
- **Aviso** (peso alto, tamaño medio): degradación y marcas de estado. Siempre en rojo de aviso.

### Named Rules

**La Regla de la Medida de Trabajo.** La columna se mantiene en una medida cómoda de lectura y no se estira para llenar el monitor. El ancho sobrante es entorno, no espacio de contenido. Pero es una medida de trabajo, no de comprobante: cabe una descripción de producto completa con sus columnas de cantidad, precio e importe sin partirse.

**La Regla de los Dígitos Tabulares.** Todo número que pueda compararse con otro va en cifras tabulares y alineado a la derecha. Un importe que baila entre filas obliga a leerlo en lugar de verlo.

## Layout

**La columna.** Una sola columna de trabajo centrada, de medida cómoda y fija, sobre la mesa kraft. Crece hacia abajo y las líneas nuevas aparecen **al final**, donde el ojo ya está esperando lo último añadido.

**Dos barras y una columna.** La entrada y el total viven en barras que cruzan **toda la ventana**; la columna de papel es solo para el contenido. Es una asimetría deliberada: el campo de entrada es el control más usado del sistema y merece ser el más ancho de la pantalla, y el botón de emitir gana la esquina, que es el objetivo más fácil de acertar sin apuntar.

**La entrada, arriba.** El punto de entrada único —escribir, dictar o fotografiar— está fijo en la **parte superior**. Es lo primero que se ve al abrir y lo primero que recibe el foco, de modo que un vendedor que llega a su puesto puede teclear el primer producto sin haber tocado nada.

Esa posición, además, resuelve un problema de seguridad sin gastar nada: la entrada y el botón de emitir quedan separados por toda la altura de la pantalla, y no hay forma de que una pulsación destinada a una caiga en el otro.

**El pie del total.** El total y el compromiso viven anclados al **borde inferior** de la pantalla, no al final del contenido. Un pedido de catorce líneas no puede empujar el total fuera de vista: es el dato que no puede desaparecer nunca, y esa es una lección aprendida viendo la alternativa renderizada.

**La densidad es una virtud.** Catorce líneas de pedido deben caber a la vez en un monitor de escritorio, con la última recortada para que se entienda que hay más. El interlineado cómodo de una página de lectura aquí es un lujo que cuesta desplazamientos.

**La cabecera fija.** El tipo de documento, la serie y el cliente permanecen visibles bajo la entrada y nunca se desplazan fuera de vista. Confundir una boleta con una factura es el error más caro que se comete sin darse cuenta.

**Nada de barra lateral.** La navegación no vive en un rail permanente. Las demás superficies se alcanzan desde la propia entrada, que es también donde viven los comandos. En una herramienta que pasa el 90% del tiempo en una sola pantalla, un rail permanente gasta ancho en algo que casi no se usa.

**Comportamiento adaptable.** En móvil la columna ocupa todo el ancho y la mesa desaparece; la jerarquía no cambia porque ya era vertical. La entrada arriba y el total abajo se mantienen fijos, que es exactamente el patrón que un teléfono espera. En escritorio la columna no crece de ancho, crece de alto.

**Ritmo.** Un único ritmo de espaciado en todo el sistema, con más aire encima de una cabecera que debajo. Las secciones se separan con reglas finas en tinta desvaída, no con espacio en blanco generoso: la densidad es una virtud cuando hay que ver catorce líneas a la vez.

`[Valores exactos de la escala de espaciado y del ancho de la columna: a resolver en la implementación.]`

## Elevation & Depth

El sistema es plano. La columna de trabajo se distingue de la mesa por su color de papel, no por una sombra.

La única excepción son las superposiciones que de verdad flotan: la papeleta de contexto, que es una hoja dejada encima. Proyecta una sombra corta y suave. Nada más en el sistema tiene sombra.

No hay elevación tonal, ni niveles de superficie, ni tarjetas flotantes. Los botones, los campos y las etiquetas están impresos sobre el papel, y lo impreso no flota.

### Named Rules

**La Regla de la Sombra Única.** Solo lo que está literalmente encima de otra cosa proyecta sombra. Si algo tiene sombra y no es una superposición, es un error.

## Shapes

**Radio cero en todo.** Campos, botones, bandas, superposiciones y sellos: ninguna esquina redondeada en ningún sitio. No es una cita al papel, es una decisión de carácter: en una herramienta densa y tabular las esquinas rectas leen como precisión y permiten que las filas se asienten juntas sin que el ojo tropiece con curvas repetidas.

Las reglas separadoras son líneas finas en tinta desvaída.

La única forma no rectilínea del sistema es **el sello**, y solo por su ligera rotación y su tinta desigual. Aparece únicamente sobre documentos ya emitidos y en ningún otro lugar.

## Do's and Don'ts

### Do:

- **Do** mantener la hoja de trabajo visiblemente distinta de un comprobante: si alguien duda de qué está mirando, el diseño falló.
- **Do** poner la entrada arriba y el total anclado abajo, siempre visibles ambos.
- **Do** hacer crecer la lista hacia abajo, con lo último añadido al final.
- **Do** alinear a la derecha y en cifras tabulares todo número comparable.
- **Do** expresar una corrección como el papel la expresa: la lectura original tachada en tinta desvaída y, debajo y sangrada, la propuesta limpia.
- **Do** reservar el sello violeta para lo ya emitido, ligeramente rotado y con tinta desigual.
- **Do** declarar en rojo, con una etiqueta al lado del tipo de documento, todo documento que no tenga valor tributario.
- **Do** acompañar todo estado con una segunda señal además del color: tachado, peso, sangrado, sello o etiqueta.
- **Do** mostrar los avisos de degradación como una banda persistente y fijada, no como una notificación que se desvanece.
- **Do** dejar que las acciones frecuentes sean rápidas: un botón que se deshabilita al pulsarse y cambia de estado, sin ceremonia.

### Don't:

- **Don't** hacer que la pantalla parezca un comprobante impreso: nada de perforaciones, dentados, bordes rasgados, cintas ni simulación de impresión térmica.
- **Don't** usar verde. Un estado positivo se marca con el sello.
- **Don't** redondear ninguna esquina.
- **Don't** poner sombra a nada que no sea una superposición real.
- **Don't** estirar la columna para llenar la pantalla, ni convertirla en un tablero de widgets o métricas.
- **Don't** introducir una barra lateral de navegación permanente.
- **Don't** usar fósforo verde sobre negro, ni monoespaciada de terminal, ni ningún guiño a la estética de terminal retro.
- **Don't** ofrecer modo oscuro. La escena es una fachada abierta de centro mayorista con luz de día entrando.
- **Don't** pedir gestos elaborados —arrastres, mantener pulsado, confirmaciones en varios pasos— para una operación que se repite cien veces al día.
- **Don't** esconder tras un paso del ratón por encima, un menú o un gesto nada que sea necesario para completar una venta.
- **Don't** comunicar nada importante solo con sonido. El local es ruidoso.
- **Don't** usar la palabra "eliminar" referida a un comprobante emitido, en ninguna etiqueta, mensaje ni tooltip.
