---
description: "Desglose de tareas ejecutables — Mostrador asistido"
---

# Tasks: Mostrador asistido — primera entrega de SuitPay

**Input**: documentos de diseño en `/specs/001-mostrador-asistido/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [design.md](./design.md), [contracts/](./contracts/)

**Governance**: constitución de SuitPay v1.0.0 (`.specify/memory/constitution.md`). Los principios I, II y IV son no negociables.

## Sobre las pruebas de este desglose

Las pruebas aquí **no son opcionales**, y conviene entender por qué antes de empezar a saltárselas.

La constitución obliga a que toda tarea que emita, anule o modifique un documento con efecto tributario lleve pruebas asociadas, y a que esas pruebas cubran explícitamente **el reintento, la respuesta que no llega y el fallo del proveedor**. Son exactamente los tres modos de fallo que producen un comprobante duplicado, y ninguno de los tres se descubre probando a mano el camino feliz: el reintento hay que provocarlo, la respuesta ausente hay que simularla y el fallo del proveedor hay que inducirlo.

De modo que las fases US1, US4, US5 y US8 llevan pruebas obligatorias. El resto lleva las pruebas que valen la pena y nada más.

## Formato: `[ID] [P?] [Story] Descripción`

- **[P]**: puede ejecutarse en paralelo (archivos distintos, sin dependencias pendientes).
- **[Story]**: a qué historia de usuario pertenece la tarea.
- Cada descripción lleva su ruta de archivo.

---

## Phase 1: Setup (infraestructura compartida)

**Propósito**: dejar el proyecto en pie, con las fronteras que el plan declara ya vigiladas por herramientas y no por buena voluntad.

- [x] T001 Andamiar la aplicación TanStack Start con Vite y TypeScript en la raíz del repositorio, fijando las versiones estables vigentes en `package.json`
- [x] T002 Crear el árbol de directorios de `src/` según la estructura de `plan.md`: `routes/`, `server/`, `domain/`, `features/`, `ui/`, `infra/`
- [x] T003 [P] Configurar TypeScript en modo estricto en `tsconfig.json`, con alias de rutas para `src/domain`, `src/server`, `src/features` y `src/ui`
- [x] T004 [P] Configurar ESLint y Prettier en `eslint.config.js`, con las reglas de accesibilidad de JSX activadas
- [x] T005 **Añadir la regla de frontera de importación** en `eslint.config.js`: ningún archivo fuera de `src/server/**` puede importar de `src/server/**`, y `src/domain/**` no puede importar de Firebase, React ni del framework. Es el guardián de las tres fronteras que `plan.md` declara deliberadas
- [x] T006 [P] Configurar Tailwind CSS en `tailwind.config.ts` y `src/ui/tokens/`, con la paleta de `DESIGN.md`: tinta `#1A1714`, rojo `#C2321C`, violeta `#4C3F91`, papel `#F7F4EC`, mesa `#DED7C7`, tinta desvaída `#8A8378`, y radio cero como valor único
  - Hecho con configuración en CSS (Tailwind v4), en `src/ui/tokens/tema.css`, no en `tailwind.config.ts`: v4 ya no usa ese archivo. Los espacios de nombres `--radius-*`, `--shadow-*` y la paleta por omisión se **vacían**, de modo que `rounded-lg`, `shadow-md` y cualquier verde no existen como clases. Comprobado sobre el CSS compilado.
- [x] T007 [P] Instalar y autoalojar Atkinson Hyperlegible en `src/ui/tokens/tipografia.ts`, **verificando la disponibilidad de su compañero monoespaciado** y cayendo a Martian Mono si no existe; dejar constancia de cuál se usó
  - Constancia: el compañero monoespaciado **sí existe**. Se usa `@fontsource-variable/atkinson-hyperlegible-mono` junto a `atkinson-hyperlegible-next`. No hizo falta recurrir a Martian Mono.
- [x] T008 [P] Configurar Vitest y Testing Library en `vitest.config.ts`
- [x] T009 [P] Configurar Playwright en `playwright.config.ts` con proyectos de escritorio y móvil
- [ ] T010 Crear el proyecto de Firebase independiente y escribir `firebase.json`, `firestore.rules`, `firestore.indexes.json` y `storage.rules` iniciales
  - Los cuatro archivos están escritos. **Queda crear el proyecto real**, que necesita la cuenta del usuario. Mientras tanto, `.firebaserc` apunta a `demo-suitpay`, que es suficiente para los emuladores.
- [x] T011 Configurar la Firebase Emulator Suite en `firebase.json` para Firestore, Auth y Storage, con guiones de arranque en `package.json`
- [x] T012 Escribir `apphosting.yaml` con las variables de entorno y los enlaces a Secret Manager para las credenciales del proveedor de emisión y las dos del servicio de asistencia

**Checkpoint**: alcanzado. `npm run tipos`, `npm run lint` y `npm run build` pasan, y las fronteras del plan las vigila el linter.

---

## Phase 2: Foundational (prerrequisitos bloqueantes)

**Propósito**: el dominio puro, la autenticación, el modelo de datos y las piezas del sistema de diseño que todas las historias comparten.

**⚠️ CRÍTICO**: ninguna historia de usuario puede empezar hasta que esta fase esté completa.

### Dominio puro (sin dependencias, compartido por cliente y servidor)

- [x] T013 [P] Definir los esquemas de validación compartidos con Zod en `src/domain/esquemas/`: producto, cliente, línea de pedido, petición de emisión, petición de anulación
- [x] T014 [P] Implementar el cálculo de importes y totales en `src/domain/totales/`, con el impuesto ya incluido en el precio y **sin recalcular su desglose** (FR-032)
- [x] T015 [P] Implementar los tipos de documento y sus reglas en `src/domain/documentos/`: boleta, factura, nota de venta y documento interno de contingencia, con la distinción de cuáles tienen valor tributario y cuáles consumen serie regulada
- [x] T016 [P] Implementar la utilidad de fecha y zona horaria en `src/domain/anulacion/`, **fijada a `America/Lima`** sobre `Intl`, con la función que decide si un comprobante se emitió el mismo día. Calcularla en UTC volvería inanulable una venta de las siete de la tarde a los pocos minutos
- [x] T017 [P] Configurar la coincidencia aproximada con Fuse.js en `src/domain/busqueda/`, tolerante al orden de los términos y a errores menores, **distinguiendo la ausencia de coincidencias de una coincidencia aproximada** (FR-008)
  - La tolerancia al orden no la da Fuse.js por sí sola: `ignoreLocation` no basta. Se resolvió partiendo la consulta en términos, buscando cada uno por separado y exigiendo que **todos** encuentren el producto, promediando distancias para ordenar.
- [x] T018 [P] Pruebas unitarias del dominio en `tests/unit/domain/`: totales, importe no positivo, umbral de identificación, ventana de anulación en horario de Lima incluido el caso de las 19:00, y búsqueda con términos desordenados

### Datos y seguridad

- [x] T019 Escribir las reglas de seguridad completas en `firestore.rules` según `contracts/firestore-rules.md`: **el cliente no puede escribir `comprobantes`, `series` ni `config` bajo ningún rol**, y las demás colecciones según su regla
- [x] T020 [P] Escribir los cinco índices compuestos en `firestore.indexes.json` según `data-model.md`
- [x] T021 [P] Escribir `storage.rules` limitando la escritura de medios de captura al vendedor autenticado y su lectura al backend
- [ ] T022 Pruebas de las reglas de seguridad contra el emulador en `tests/emulador/reglas.test.ts`, verificando explícitamente que un cliente con rol de administrador **tampoco** puede escribir un comprobante ni una serie
  - Las pruebas están escritas. **No se han podido ejecutar todavía**: el emulador de Firestore necesita Java y la máquina no lo tiene. Hasta que corran, las reglas están sin verificar.
- [x] T023 [P] Inicializar el cliente de Firebase y App Check en `src/infra/firebase/`
- [x] T024 [P] Inicializar el Admin SDK en `src/server/firebase/`
- [x] T025 Implementar la verificación transversal de las funciones de servidor en `src/server/auth/`: sesión válida, atestación de aplicación, usuario activo y rol suficiente, **tomando la identidad del token y nunca de la petición** (principio I, FR-003)
- [x] T026 [P] Definir el catálogo de códigos de error estables en `src/server/errores.ts`, con mensajes aptos para mostrar al vendedor y **sin propagar nunca el mensaje crudo del proveedor**

### Frontera del proveedor

- [ ] T027 **Comprobar en el entorno de demostración del proveedor, antes de escribir el adaptador, las dos cosas que su documentación no dice** y dejar el resultado en `research.md`, incógnitas 1 y 2: **(a)** que al enviar un número de comprobante explícito en lugar del comodín de asignación automática el proveedor lo respeta, y qué contesta ante un número ya usado; **(b)** qué forma tienen sus respuestas de error, porque el ejemplo documentado no lleva código. De (a) depende que la reconciliación sea una consulta directa en lugar de un sondeo; de (b) depende poder distinguir un rechazo definitivo de una indisponibilidad, que es lo que impide el reintento a ciegas. **Son las dos incógnitas más valiosas del proyecto y se resuelven en una tarde**
- [x] T028 Definir la interfaz del proveedor de emisión en `src/server/proveedor/interfaz.ts` según `contracts/proveedor-emision.md`: `emitir`, `anular`, `consultarDocumento`, `consultarContribuyente`, con la clasificación de fallos en `rechazo_definitivo`, `indisponible` e `indeterminado`, apoyada en lo que T027 haya averiguado
- [x] T029 [P] Implementar el proveedor simulado en `src/server/proveedor/simulado.ts`, capaz de reproducir a voluntad los tres modos de fallo con la forma real que T027 haya observado. Es la pieza sin la cual las pruebas obligatorias de la constitución no se pueden escribir
- [x] T030 Implementar el adaptador de Factpro en `src/server/proveedor/factpro/`, con la autenticación, la normalización de sus respuestas a la interfaz propia y la **traducción de sus estados a los nuestros según la tabla de la decisión 4b**, recordando que sus estados `03` y `19` de "sin respuesta de SUNAT" **no son fallos nuestros** y no deben derivar en `indeterminado`
  - Hecha la traducción de estados y el transporte con su clasificación de fallos, ambos con pruebas. **`emitir` y `anular` quedan para la fase US1**, que es donde vive la transacción de la serie. La clasificación es hoy conservadora a la espera de T027: los bloques que hay que revisar están marcados `PENDIENTE DE T027`.
  - Hallazgo con consecuencias en la interfaz: como el proveedor firma en sus propios servidores y mantiene su cola hacia SUNAT, **una caída de SUNAT no impide emitir**. El camino de venta en espera de FR-050 se estrecha a que el proveedor mismo o nuestra red estén inalcanzables, así que será raro y no debe presentarse como el escenario habitual.
- [x] T031 [P] Implementar `consultarDocumento` en `src/server/proveedor/factpro/consultar.ts` sobre `POST /api/v3/consulta` con `{ serie, numero }`. Es la primitiva de la que depende toda la reconciliación, así que va antes que la emisión y no después

### Cliente: estado, caché y arranque

- [x] T032 [P] Implementar los almacenes de IndexedDB con `idb` en `src/infra/local/`: uno para el pedido en curso, otro para el espejo del catálogo y sus índices
- [x] T033 [P] Implementar el almacén del pedido en curso con Zustand en `src/features/pedido/almacen.ts`, persistido en IndexedDB, de forma que **sobreviva a la pérdida de conexión y al cambio de red** (FR-015)
  - La persistencia se hace a mano en lugar de con el middleware de Zustand: su almacenamiento es sincrónico por diseño e IndexedDB no lo es.
  - Decisión que conviene recordar en US1: la clave de idempotencia se **reclama al confirmar** y cualquier cambio posterior en el contenido de la venta la invalida. Sin eso, cambiar una cantidad y volver a emitir devolvería el comprobante anterior y el vendedor cobraría un total que no coincide con lo emitido.
- [x] T034 Configurar TanStack Query en `src/infra/consultas/` con caché por sesión: primera lectura del servidor y navegaciones posteriores desde la caché local
  - Revalidación al recuperar el foco **desactivada**: en un mostrador la ventana pierde el foco decenas de veces por hora y cada una habría sido una tanda de lecturas facturadas. Las mutaciones no se reintentan solas, porque un reintento automático de una emisión es justo lo que el principio II prohíbe.
- [x] T035 Implementar el arranque de sesión en `src/features/catalogo/arranque.ts` con **exactamente tres lecturas** —`catalogo/actual`, `indices/clientes`, `config/parametros`— comparando la versión en caché para no volver a descargar lo que no cambió
  - Salvedad honesta: comprobar la versión **ya cuesta la lectura**, porque Firestore factura por documento y no por bytes. Lo que ahorra la comparación es transferir y reindexar el catálogo en un teléfono. El ahorro de lecturas viene de que esto ocurre una vez por sesión y no una por búsqueda.
- [x] T036 [P] Implementar la detección y exposición del estado degradado en `src/features/degradacion/`, distinguiendo red caída, asistencia caída y proveedor caído
  - Cada causa declara también **qué sí funciona**. La degradación más frecuente será la de la asistencia, con la que se puede vender con normalidad escribiendo; un aviso que solo enumere lo perdido haría que el vendedor se detuviera sin motivo.

### Sistema de diseño

- [x] T037 [P] Implementar las primitivas base en `src/ui/componentes/`: botón, campo, etiqueta, casilla, regla separadora y diálogo sobre primitivas de Radix, **con radio cero y sin sombra** salvo en superposiciones
  - El radio cero y la ausencia de sombra no dependen de la disciplina de quien escriba: los espacios de nombres de Tailwind están vaciados, así que `rounded-lg` y `shadow-md` no existen como clases. La única sombra que existe es la de la papeleta.
- [x] T038 [P] Implementar `BandaDegradacion` en `src/ui/componentes/BandaDegradacion.tsx`: roja, fijada bajo la entrada, **persistente hasta que la causa se resuelva** y nunca una notificación que se desvanece (FR-051)
  - Sin botón de descartar, a propósito: descartar el aviso no arregla la causa, solo oculta que sigue ahí.
- [x] T039 [P] Implementar `PapeletaContexto` en `src/ui/componentes/PapeletaContexto.tsx` sobre el diálogo de Radix: hoja rotada un par de grados, **única sombra del sistema**, que devuelve el foco al sitio exacto donde estaba el vendedor
- [x] T040 [P] Implementar `Sello` y `MarcaEstado` en `src/ui/componentes/`: sello violeta ligeramente rotado con tinta desigual **solo para documentos ya emitidos**, y marca roja para ANULADO y PENDIENTE DE COMPROBANTE
  - Los estados en vuelo —`reclamado`, `enviado`— no llevan marca ninguna: estampar algo sobre un comprobante que aún no se sabe qué será equivaldría a afirmarlo.
- [x] T041 Implementar la disposición de la aplicación en `src/routes/__root.tsx`: barra de entrada a todo el ancho arriba, columna de papel centrada sobre la mesa kraft, barra de total anclada al pie. **Ninguna barra lateral** (`design.md`, composición aprobada)
  - Puesta la disposición de una columna con la banda de degradación en la raíz. La barra de entrada y la de total llegan con la hoja de trabajo, que es donde viven.
  - Nota del modo SPA: la compilación prerrenderiza la raíz con el componente de espera del enrutador y la guarda como cáscara estática. O sea que `defaultPendingComponent` es literalmente lo primero que ve el vendedor al abrir el sistema, no solo un intermedio entre navegaciones.

**Checkpoint**: alcanzado con dos reservas. El dominio está probado (69 pruebas), el proveedor se puede simular, el sistema de diseño está impuesto por construcción y la aplicación compila. Las reservas: **las reglas de seguridad están escritas pero sin verificar** hasta que se instale Java y corran las pruebas de emulador (T022), y **la clasificación de fallos del proveedor sigue a la espera de T027**. Las historias pueden empezar; US1 no debería cerrarse sin resolver ambas.

---

## Phase 3: User Story 1 — Tomar el pedido y emitir escribiendo (Priority: P1) 🎯 MVP

**Goal**: un vendedor arma un pedido escribiéndolo, elige el tipo de documento, revisa el total y emite. Con esta historia sola la empresa ya puede vender.

**Independent Test**: con un subconjunto de productos cargado a mano y una serie configurada, un vendedor completa una venta de principio a fin y obtiene un comprobante válido.

### Pruebas obligatorias de User Story 1 ⚠️

> Estas pruebas son exigidas por la constitución, no por preferencia. Escríbelas antes de la implementación y comprueba que fallan.

- [x] T042 [P] [US1] Prueba de idempotencia en `tests/unit/server/emitir-idempotencia.test.ts`: **dos invocaciones con la misma clave producen un solo comprobante** y la segunda devuelve `yaExistia` verdadero (FR-028, principio II)
- [x] T043 [P] [US1] Prueba de respuesta ausente en `tests/unit/server/emitir-indeterminado.test.ts`: cuando el proveedor no responde tras haber recibido la petición, el comprobante queda en `indeterminado` y **una nueva invocación no vuelve a emitir** (FR-029)
- [x] T044 [P] [US1] Prueba de fallo del proveedor en `tests/unit/server/emitir-proveedor-caido.test.ts`: la venta queda en `pendiente` con los datos de contacto conservados y se ofrece el documento interno (FR-050, FR-050a)
- [x] T045 [P] [US1] Prueba de rechazo definitivo en `tests/unit/server/emitir-rechazo.test.ts`: el comprobante queda `rechazado` con el motivo en su traza y **el correlativo consumido queda registrado como consumido** (FR-030)
- [x] T046 [P] [US1] Prueba de serie no configurada en `tests/unit/server/emitir-sin-serie.test.ts`: se rechaza con `serie_no_configurada` **antes** de tocar la serie o el proveedor (FR-031)
- [x] T047 [P] [US1] Prueba del umbral de identificación en `tests/unit/server/emitir-umbral.test.ts`: una boleta que supera el umbral con cliente eventual se rechaza con `cliente_requerido`, leyendo el umbral de `config/parametros` y no de una constante (FR-021)
- [x] T048 [P] [US1] Prueba de discrepancia de total en `tests/unit/server/emitir-total-servidor.test.ts`: cuando el total que envía el cliente difiere del recalculado, **manda el servidor**
- [x] T049 [P] [US1] Prueba de importe no positivo en `tests/unit/server/emitir-importe.test.ts`: una línea con importe cero o negativo impide la emisión (FR-013)
- [~] T050 [P] [US1] Prueba de integración de la transacción en `tests/emulador/emitir-transaccion.test.ts`: el comprobante y el incremento del correlativo ocurren **en la misma transacción**, y un fallo deja ambos sin efecto — *escrita, sin ejecutar: se salta con un aviso mientras falte Java (T022)*
- [~] T051 [US1] Prueba de extremo a extremo en `tests/e2e/venta-escrita.spec.ts`: buscar tres productos con los términos desordenados, ajustar un precio, cambiar de boleta a factura conservando el pedido, emitir, y comprobar que **una doble pulsación produce un solo comprobante** — *partida en dos: la del pedido pasa hoy en escritorio y móvil; la de la doble pulsación se salta hasta que haya emuladores (T022)*

### Implementación de User Story 1

- [x] T052 [P] [US1] Implementar el espejo local del catálogo y la búsqueda en `src/features/catalogo/`, sobre el catálogo en caché y **sin depender de ningún servicio externo** (FR-007)
- [x] T053 [US1] Implementar el componente `Entrada` en `src/ui/componentes/Entrada.tsx`: campo único fijo arriba, a casi todo el ancho de la ventana, con foco al abrir, que sugiere productos del catálogo en caché sin latencia
- [x] T054 [P] [US1] Implementar `LineaPedido` en `src/ui/componentes/LineaPedido.tsx`: descripción a la izquierda; cantidad, precio e importe a la derecha en cifras tabulares, con **edición del precio en el sitio y sin validación**, mostrando el precio de catálogo tachado al lado (FR-012)
- [x] T055 [P] [US1] Implementar `CabeceraDocumento` en `src/ui/componentes/CabeceraDocumento.tsx`: tipo de documento, serie y cliente, fija y **sin destruir el pedido al cambiar de tipo** (FR-014)
- [x] T056 [P] [US1] Implementar la etiqueta **SIN VALOR TRIBUTARIO** en `src/ui/componentes/EtiquetaSinValor.tsx`, perfilada en rojo junto al tipo de documento, presente en nota de venta y documento interno y **ausente en los comprobantes regulados** (FR-036)
- [x] T057 [US1] Implementar `PieTotal` en `src/ui/componentes/PieTotal.tsx`: barra anclada al pie con recuento de líneas, medio de pago, total al mayor tamaño de la pantalla y botón de emitir en la esquina. El botón **se deshabilita en el instante de la pulsación**; cuando no se puede emitir, queda inhabilitado con el motivo dicho en rojo debajo
- [x] T058 [US1] Implementar la pantalla única de venta en `src/routes/index.tsx`, ensamblando entrada, cabecera, pedido y pie, **sin ninguna métrica, gráfico ni contador del día**
- [x] T059 [P] [US1] Implementar la generación de la clave de idempotencia en `src/features/emision/clave.ts`, que **identifica la intención de venta y no la petición**: un reintento del mismo gesto reutiliza la misma clave
- [x] T060 [US1] Implementar el consumo transaccional del correlativo en `src/server/emision/series.ts`, incrementando `ultimoNumero` y registrando todo consumo, incluidos los que acaben en fallo (FR-030)
- [x] T061 [US1] Implementar la función de servidor `emitirComprobante` en `src/server/emision/emitir.ts` según `contracts/functions.md`, con el orden que la constitución exige: validar, recalcular, comprobar umbral, **abrir transacción y crear el comprobante en estado `reclamado`, y solo entonces invocar al proveedor**
- [x] T062 [US1] Implementar `emitir` en el adaptador de Factpro en `src/server/proveedor/factpro/emitir.ts`, con la clasificación de su respuesta en los tres modos de fallo
- [x] T063 [US1] Implementar la máquina de estados del comprobante en `src/server/emision/estados.ts` según `data-model.md`, **prohibiendo explícitamente la transición de `indeterminado` a una nueva emisión**
- [x] T064 [US1] Implementar el flujo de confirmación en el cliente en `src/features/emision/`, distinguiendo en la interfaz "emitido ahora" de "ya estaba emitido" mediante `yaExistia`
- [x] T065 [US1] Implementar los estados de emisión en la interfaz en `src/features/emision/estados.tsx`: en vuelo, emitido, rechazado, pendiente, **indeterminado sin ofrecer reintentar**, y requiere intervención sin cerrarse solo
- [x] T066 [US1] Implementar la recogida de datos de contacto y el documento interno de contingencia en `src/features/emision/contingencia.tsx`, marcado de forma inequívoca como sin valor tributario y pendiente de comprobante (FR-050a)
- [x] T067 [US1] Implementar la tarea programada `procesarPendientes` en `src/routes/api/procesar-pendientes.ts`, que completa la emisión de las ventas en espera y mueve a `requiere_intervencion` las que resulten rechazadas, **porque el cliente ya se fue con mercadería** (FR-050b)
- [x] T068 [US1] Implementar la tarea programada `reconciliarEmisiones` en `src/routes/api/reconciliar.ts`, que consulta al proveedor por los comprobantes `indeterminado` y adopta su estado real, con el sondeo acotado de la decisión 4 de `research.md`. **Nunca emite.** Es la contrapartida obligatoria de prohibir el reintento a ciegas
- [~] T069 [US1] Proteger las dos rutas programadas en `src/server/auth/programadas.ts` con un secreto compartido, y configurar Cloud Scheduler para invocarlas periódicamente — *el secreto está puesto; Cloud Scheduler necesita el proyecto real (T010)*
- [x] T070 [P] [US1] Implementar la salida impresa en A4 en `src/features/emision/impresion.ts` desde los puestos de escritorio (FR-053) — *`.ts` y no `.tsx`: se imprime el PDF del proveedor, así que no hay plantilla que maquetar*
- [x] T071 [P] [US1] Implementar la obtención del comprobante como archivo compartible en `src/features/emision/compartir.ts`, pensada para el móvil (FR-054)
- [x] T072 [US1] Implementar la reimpresión de un comprobante ya emitido en `src/features/emision/reimprimir.ts`, de forma que **un fallo de impresión no invalide ni repita la emisión** (FR-055)
- [x] T073 [US1] Implementar la sesión persistente entre jornadas en `src/features/sesion/`, con revalidación en segundo plano y **bloqueo de la emisión cuando la sesión ya no sea válida o el vendedor esté desactivado** (FR-002, FR-003)
- [x] T074 [P] [US1] Implementar el estado de pedido vacío en `src/routes/index.tsx`: columna con sus cabeceras de columna y la entrada enfocada, **sin ilustración ni mensaje de bienvenida**

**Checkpoint**: User Story 1 está implementada y su lógica verificada con 128 pruebas que pasan. La marca `[~]` señala lo que está escrito pero **no ejecutado todavía**, y conviene no confundirlo con hecho.

Lo que falta para poder decir que la empresa vende, y en este orden:

1. **Java** (T022), que desbloquea de golpe las reglas de seguridad, la transacción contra Firestore de T050 y la mitad de emisión de T051. Es el paso con mejor relación entre esfuerzo y certeza que se gana.
2. **El proyecto real de Firebase** (T010), para salir del emulador.
3. **El entorno de demostración del proveedor** (T027), que es la única forma de confirmar que Factpro respeta un número explícito. De eso depende que la reconciliación sepa a qué comprobante se refiere una respuesta, así que la asunción sigue viva hasta comprobarla.

No hay pantalla de acceso: la sesión persiste y bloquea la emisión cuando no es válida (T073), pero entrar por primera vez todavía no tiene interfaz. La prueba de extremo a extremo lo sortea sembrando la sesión, y eso está anotado en `tests/e2e/ayudas-sesion.ts` para que se borre cuando la pantalla exista.

---

## Phase 4: User Story 2 — Poner el catálogo en producción (Priority: P2)

**Goal**: el administrador carga el catálogo, revisa lo que el sistema entendió y confirma.

**Independent Test**: el administrador carga un archivo con productos y comprueba que quedan disponibles en la búsqueda, con sus precios y unidades.

- [ ] T075 [P] [US2] Prueba de códigos duplicados en `tests/unit/server/importar-duplicados.test.ts`: el conflicto se informa y **no se resuelve por cuenta del sistema** (FR-010)
- [ ] T076 [P] [US2] Prueba de comparación en `tests/unit/server/importar-diferencias.test.ts`: sobre un catálogo ya publicado, la validación distingue productos nuevos, cambios de precio y desapariciones (FR-011)
- [ ] T077 [P] [US2] Implementar la interpretación de archivos estructurados en `src/server/catalogo/lector-json.ts`
- [ ] T078 [P] [US2] Implementar la interpretación de documentos en `src/server/catalogo/lector-documento.ts`, para los catálogos que llegan como PDF
- [ ] T079 [US2] Implementar la detección de conflictos en `src/server/catalogo/conflictos.ts`: códigos repetidos, precios ausentes y unidades desconocidas
- [ ] T080 [US2] Implementar la comparación contra el catálogo publicado en `src/server/catalogo/diferencias.ts`
- [ ] T081 [US2] Implementar la función de servidor `importarCatalogo` en `src/server/catalogo/importar.ts` con sus modos `validar` y `publicar`, escribiendo el catálogo completo **en una sola escritura** e incrementando su versión
- [ ] T082 [US2] Implementar la pantalla de importación en `src/routes/administracion/catalogo.tsx`, que muestra el resumen y las diferencias **antes de confirmar nada** (FR-009)
- [ ] T083 [P] [US2] Implementar la gestión de series en `src/routes/administracion/series.tsx`, con el alta por vendedor y tipo de documento que FR-031 presupone
- [ ] T084 [P] [US2] Implementar la gestión de usuarios y roles en `src/routes/administracion/usuarios.tsx`, replicando el rol en las reivindicaciones del token para que las reglas lo evalúen sin lecturas (FR-005)
- [ ] T085 [P] [US2] Implementar la edición de parámetros en `src/routes/administracion/parametros.tsx`, incluido el umbral de identificación, **que debe ser barato de cambiar porque es de origen regulatorio**

**Checkpoint**: el catálogo real está en producción y la administración puede configurar series, usuarios y parámetros.

---

## Phase 5: User Story 3 — Dar de alta un cliente sin abandonar la venta (Priority: P3)

**Goal**: el vendedor registra un cliente nuevo desde la propia pantalla de venta, sin perder el pedido.

**Independent Test**: partiendo de una venta en curso, el vendedor registra un cliente inexistente y termina la venta sin haber perdido el pedido.

- [ ] T086 [P] [US3] Prueba de la consulta de contribuyente en `tests/unit/server/consultar-contribuyente.test.ts`: la función **devuelve datos para revisión y no crea el cliente** (principio I), y ante servicio caído devuelve un error que no bloquea
- [ ] T087 [US3] Implementar la función de servidor `consultarContribuyente` en `src/server/contribuyentes/consultar.ts`, señalando explícitamente la condición de no habido
- [ ] T088 [P] [US3] Implementar `consultarContribuyente` en el adaptador de Factpro en `src/server/proveedor/factpro/contribuyentes.ts`
- [ ] T089 [US3] Implementar la comprobación de existencia de un cliente en `src/features/clientes/existencia.ts` mediante **lectura directa por identificador**, sin consulta ni índice
- [ ] T090 [US3] Implementar el alta en contexto en `src/features/clientes/alta-en-contexto.tsx`, ofrecida en la propia pantalla de venta cuando el documento no está registrado (FR-022)
- [ ] T091 [US3] Implementar la revisión y confirmación de los datos traídos en `src/features/clientes/revision.tsx`, guardando **solo tras la confirmación del vendedor** (FR-023)
- [ ] T092 [P] [US3] Implementar la advertencia visible de contribuyente no habido en `src/features/clientes/advertencia.tsx`, **dejando la decisión al vendedor** (FR-024)
- [ ] T093 [US3] Implementar la resolución local de coincidencias de razón social en `src/features/clientes/coincidencias.ts` sobre `indices/clientes` en caché, presentándolas en la papeleta de contexto (FR-025)
- [ ] T094 [P] [US3] Implementar la introducción manual de datos en `src/features/clientes/manual.tsx` para cuando la consulta no responda, **sin bloquear la venta** (FR-026)
- [ ] T095 [US3] Implementar la escritura del cliente y su entrada en el índice en `src/server/clientes/crear.ts`, en una sola operación

**Checkpoint**: un cliente nuevo se registra sin salir de la venta.

---

## Phase 6: User Story 4 — Anular un comprobante dentro de plazo (Priority: P4)

**Goal**: localizar un comprobante emitido hoy, ver qué se va a anular, indicar el motivo y confirmar.

**Independent Test**: emitido un comprobante, se anula dentro de plazo y queda registrado como anulado con su motivo y su autor.

### Pruebas obligatorias de User Story 4 ⚠️

- [ ] T096 [P] [US4] Prueba de la ventana de anulación en `tests/unit/server/anular-ventana.test.ts`: un comprobante de ayer se rechaza con `fuera_de_ventana_anulacion`, y el cálculo se hace **en horario de Lima**, incluido el caso de las 19:00 que en UTC ya sería del día siguiente (FR-037, FR-038)
- [ ] T097 [P] [US4] Prueba de fallo del proveedor al anular en `tests/unit/server/anular-proveedor-caido.test.ts`: el comprobante **no queda anulado localmente** si el proveedor no confirmó la baja
- [ ] T098 [P] [US4] Prueba de reintento de anulación en `tests/unit/server/anular-idempotencia.test.ts`: anular dos veces el mismo comprobante no duplica la baja ni altera el registro original
- [ ] T099 [P] [US4] Prueba de que nada se borra en `tests/emulador/anular-no-borra.test.ts`: tras la anulación el documento **sigue existiendo** con su estado, motivo, autor y momento (FR-030)
- [ ] T100 [P] [US4] **Prueba de vocabulario** en `tests/unit/ui/sin-eliminar.test.ts`: la palabra "eliminar" no aparece en ninguna etiqueta, mensaje ni texto de ayuda referido a un comprobante, recorriendo las cadenas de la interfaz (FR-039)

### Implementación de User Story 4

- [ ] T101 [US4] Implementar la función de servidor `anularComprobante` en `src/server/emision/anular.ts`: verifica estado y ventana, solicita la baja al proveedor, y registra motivo, autor y momento en el propio documento. **No borra nada**
- [ ] T102 [P] [US4] Implementar `anular` en el adaptador de Factpro en `src/server/proveedor/factpro/anular.ts`
- [ ] T103 [US4] Implementar la consulta de comprobantes en `src/routes/comprobantes/index.tsx`, con paginación por cursores y **nunca por desplazamiento de posición**
- [ ] T104 [US4] Implementar el detalle del comprobante en `src/routes/comprobantes/$comprobanteId.tsx`, con el sello violeta si está aceptado y la marca de ANULADO si lo está
- [ ] T105 [US4] Implementar la confirmación de anulación en `src/features/emision/confirmar-anulacion.tsx`, que **muestra qué documento se va a anular** y exige el motivo antes de proceder (FR-037)
- [ ] T106 [P] [US4] Implementar el estado de fuera de ventana en `src/features/emision/fuera-de-ventana.tsx`, que explica que corresponde una nota de crédito y **no ofrece un botón que va a fallar**

**Checkpoint**: la anulación funciona dentro de plazo, se impide fuera de plazo, y nada se borra nunca.

---

## Phase 7: User Story 5 — Guardar el pedido como cotización y recuperarlo (Priority: P5)

**Goal**: guardar un pedido con un número que lo identifica y recuperarlo después desde cualquier dispositivo.

**Independent Test**: se guarda una cotización en un dispositivo y se recupera y convierte en comprobante desde otro.

### Pruebas obligatorias de User Story 5 ⚠️

- [ ] T107 [P] [US5] **Prueba de la carrera entre dispositivos** en `tests/emulador/cotizacion-dos-dispositivos.test.ts`: dos claves de idempotencia distintas sobre la misma cotización producen **un solo comprobante**, y la segunda recibe `cotizacion_ya_convertida`. Es el hueco que la clave de idempotencia por sí sola no cubre
- [ ] T108 [P] [US5] Prueba de la transacción de conversión en `tests/emulador/cotizacion-transaccion.test.ts`: la cotización pasa a `convertida` **en la misma transacción** que crea el comprobante, y un fallo deja ambos sin efecto

### Implementación de User Story 5

- [ ] T109 [P] [US5] Implementar la numeración de cotizaciones en `src/server/cotizaciones/numerar.ts`, con un número legible para poder pedirla por voz o por comando
- [ ] T110 [US5] Implementar el guardado de la cotización en `src/features/cotizaciones/guardar.ts` (FR-016)
- [ ] T111 [US5] Implementar la recuperación por número en `src/routes/cotizaciones/index.tsx`, accesible **desde cualquier dispositivo y para cualquier vendedor autorizado** (FR-017)
- [ ] T112 [US5] Implementar la advertencia de cambios al recuperar en `src/features/cotizaciones/diferencias.ts`, comparando contra el catálogo en caché **sin lecturas adicionales** y señalando precios cambiados y productos desaparecidos (FR-018)
- [ ] T113 [US5] Extender `emitirComprobante` en `src/server/emision/emitir.ts` para marcar la cotización como `convertida` en la misma transacción
- [ ] T114 [P] [US5] Implementar el estado de cotización ya convertida en `src/features/cotizaciones/ya-convertida.tsx`, que **indica en qué comprobante terminó** y ofrece abrirlo (FR-019)

**Checkpoint**: las cotizaciones viajan entre dispositivos y solo pueden convertirse una vez.

---

## Phase 8: User Story 6 — Dictar el pedido (Priority: P6)

**Goal**: el vendedor dicta el pedido y obtiene una propuesta revisable línea a línea.

**Independent Test**: se dicta un pedido de varios productos y se obtiene una propuesta revisable que, tras aprobarse, produce el mismo pedido que se habría escrito a mano.

> **Aviso de riesgo**: las historias 6 y 7 reutilizan herramientas que ya funcionan en el proyecto de la tienda virtual pero están acopladas a él. El grado de reelaboración está sin evaluar. La tarea T115 existe para averiguarlo antes de comprometerse.

- [ ] T115 [US6] **Evaluar el acoplamiento** de las herramientas de captura existentes en el proyecto de la tienda virtual y decidir entre reutilizar, adaptar o reescribir, dejando la conclusión en `specs/001-mostrador-asistido/research.md`. Si resultara profundo, las historias 6 y 7 se replantean antes de seguir
- [ ] T116 [P] [US6] **Prueba del principio IV** en `tests/unit/server/asistencia-payload.test.ts`: se inspecciona el payload que sale hacia el servicio de asistencia y se verifica que **no contiene razón social, RUC, DNI, dirección, teléfono, correo ni historial de compras** (FR-045). Es la prueba que hace verificable un principio no negociable
- [ ] T117 [P] [US6] Prueba de conmutación de credencial en `tests/unit/server/asistencia-conmutacion.test.ts`: ante error de cuota, la función conmuta a la segunda credencial configurada
- [ ] T118 [P] [US6] Prueba de asistencia caída en `tests/unit/server/asistencia-caida.test.ts`: se devuelve `asistencia_no_disponible` y **la venta se puede completar escribiendo** (FR-046)
- [ ] T119 [US6] Implementar la función de servidor `interpretarCaptura` en `src/server/asistencia/interpretar.ts` como **único punto de salida del sistema hacia el servicio de asistencia**, construyendo el payload con el medio y el lote de productos y nada más
- [ ] T120 [P] [US6] Implementar el envío del lote filtrado de candidatos en `src/features/captura/lote.ts`, preseleccionado con la búsqueda difusa local para no enviar los 500 productos
- [ ] T121 [US6] Implementar la grabación y subida del audio en `src/features/captura/audio.tsx`, con el original en Cloud Storage y **la posibilidad de abandonar la espera y seguir escribiendo**
- [ ] T122 [US6] Implementar `RevisionCaptura` en `src/ui/componentes/RevisionCaptura.tsx`: por cada renglón, la lectura original **tachada en tinta desvaída** y debajo, sangrada, la propuesta limpia, conservando las mismas columnas que el pedido normal (FR-042)
- [ ] T123 [US6] Implementar la elección entre candidatos ambiguos en `src/features/captura/ambiguos.tsx`, en rojo hasta que se elija, **presentando las opciones en lugar de escoger** (FR-043)
- [ ] T124 [US6] Implementar el marcado de renglones pendientes en `src/features/captura/pendientes.tsx`, que **impide emitir mientras quede uno sin resolver** y no descarta nada en silencio (FR-044)
- [ ] T125 [US6] Implementar la aprobación de la propuesta en `src/features/captura/aprobar.ts`, que convierte la revisión en líneas normales del pedido y **no emite nada por sí sola** (FR-041)
- [ ] T126 [P] [US6] Implementar la resolución de la identidad del cliente en el cliente y el servidor en `src/features/captura/cliente.ts`, **nunca en el modelo** (FR-045)
- [ ] T127 [P] [US6] Implementar el estado de asistencia caída en la entrada en `src/ui/componentes/Entrada.tsx`: los botones de micrófono y cámara **visiblemente inertes con el motivo dicho**, sin presentar la escritura como plan B
- [ ] T128 [US6] Prueba de extremo a extremo del dictado en `tests/e2e/dictado.spec.ts`: dictar tres productos, corregir una línea, aprobar y comprobar que el pedido resultante es el mismo que se habría escrito

**Checkpoint**: el dictado produce propuestas revisables y ningún dato de cliente sale del sistema.

---

## Phase 9: User Story 7 — Capturar una guía manual por fotografía (Priority: P7)

**Goal**: fotografiar una guía manual y obtener un pedido revisable, comparable renglón a renglón con la foto.

**Independent Test**: se fotografía una guía manual real y se obtiene un pedido revisable cuyo contenido puede compararse renglón a renglón con la foto.

- [ ] T129 [P] [US7] Prueba de medio ilegible en `tests/unit/server/captura-ilegible.test.ts`: se devuelve `medio_ilegible`, **la fotografía original se conserva** y se permite reintentar con otra
- [ ] T130 [P] [US7] Prueba de renglones tachados en `tests/unit/server/captura-tachados.test.ts`: los renglones que no se pudieron interpretar quedan marcados como pendientes y **ninguno se descarta en silencio**
- [ ] T131 [US7] Implementar la captura y subida de la fotografía en `src/features/captura/imagen.tsx`, con el original en Cloud Storage
- [ ] T132 [US7] Extender `interpretarCaptura` en `src/server/asistencia/interpretar.ts` para el tipo imagen, devolviendo **el texto extraído de cada renglón antes de proponer productos**
- [ ] T133 [US7] Implementar la revisión en dos pasos en `src/features/captura/revision-imagen.tsx`: primero el texto extraído, después el emparejamiento contra el lote filtrado (FR-042)
- [ ] T134 [P] [US7] Implementar la miniatura de la fotografía junto a la revisión en `src/features/captura/miniatura.tsx`, para poder comparar contra el original sin salir de la pantalla
- [ ] T135 [P] [US7] Implementar el estado de fotografía ilegible en `src/features/captura/ilegible.tsx`, con el motivo y el reintento
- [ ] T136 [US7] Prueba de extremo a extremo de la fotografía en `tests/e2e/fotografia.spec.ts` con una guía manual real, verificando que un renglón ilegible bloquea la emisión hasta resolverse

**Checkpoint**: el trabajo en papel entra al sistema sin descartar nada en silencio.

---

## Phase 10: User Story 8 — Facturar al canal de vecinos y cobrar después (Priority: P8)

**Goal**: documentar la venta en el momento de la entrega indicando que el pago es a crédito, y registrar el cobro cuando llegue.

**Independent Test**: se documenta una venta a crédito con fecha de pago esperada y, más tarde, se registra su cobro.

### Pruebas obligatorias de User Story 8 ⚠️

- [ ] T137 [P] [US8] Prueba de emisión a crédito en `tests/unit/server/emitir-credito.test.ts`: el comprobante se emite en el momento de la entrega con su fecha de vencimiento, y los tres modos de fallo del proveedor se comportan igual que al contado
- [ ] T138 [P] [US8] Prueba del registro de cobro en `tests/emulador/registrar-cobro.test.ts`: registrar el cobro **no altera el comprobante emitido** más allá de su estado de cobro, y registrarlo dos veces no lo duplica

### Implementación de User Story 8

- [ ] T139 [US8] Extender la condición de pago en `src/features/emision/condicion-pago.tsx` con el crédito y su fecha de vencimiento esperada (FR-034)
- [ ] T140 [US8] Implementar el registro del cobro en `src/server/emision/registrar-cobro.ts`, embebido en el propio comprobante y **sin colección aparte**
- [ ] T141 [US8] Implementar la consulta de ventas a crédito pendientes por cliente en `src/routes/credito/index.tsx`, mostrando **qué ventas siguen pendientes y desde cuándo** (FR-035)
- [ ] T142 [P] [US8] Aplicar el sello violeta de COBRADO en `src/routes/credito/index.tsx` a las ventas ya cobradas
- [ ] T143 [P] [US8] Implementar el envío del comprobante al vecino en `src/features/emision/compartir.ts`, reutilizando el archivo compartible de US1

**Checkpoint**: el canal de vecinos queda documentado el mismo día de la entrega.

---

## Phase 11: User Story 9 — Consultar desde el buscador con comandos (Priority: P9)

**Goal**: resolver consultas cortas desde la misma entrada que se usa para productos, sin cambiar de pantalla.

**Independent Test**: se pide por comando la lista de comprobantes de un cliente y se obtiene sin salir de la pantalla de venta.

- [ ] T144 [P] [US9] **Prueba de la frontera de los comandos** en `tests/unit/features/comandos-solo-lectura.test.ts`: ninguna instrucción en lenguaje natural puede crear, modificar, anular o dar de baja un comprobante, y el intento **indica dónde se realiza esa operación** (FR-048, principio I)
- [ ] T145 [US9] Implementar el catálogo cerrado de operaciones de consulta en `src/features/comandos/catalogo.ts`. Es un catálogo cerrado por diseño: **no hay interpretación libre de intenciones**
- [ ] T146 [US9] Implementar el reconocimiento de comandos en la entrada en `src/features/comandos/reconocer.ts`, que cambia a modo comando al empezar con barra y muestra los parámetros que faltan como marcadores dentro del propio campo
- [ ] T147 [P] [US9] Implementar la consulta de últimos comprobantes de un cliente en `src/features/comandos/comprobantes-cliente.ts`, con cursor y página corta
- [ ] T148 [P] [US9] Implementar la consulta de cotización por número en `src/features/comandos/cotizacion.ts`
- [ ] T149 [US9] Implementar la resolución de instrucciones incompletas en `src/features/comandos/incompletas.tsx` mediante la papeleta de contexto, que **pide lo que falta en lugar de fallar** (FR-049)
- [ ] T150 [P] [US9] Implementar la presentación de resultados sin abandonar la pantalla de venta en `src/features/comandos/resultados.tsx` (FR-047)
- [ ] T151 [US9] Extender el dictado para admitir comandos hablados en `src/features/comandos/por-voz.ts`, con la misma frontera de solo lectura

**Checkpoint**: las consultas se resuelven sin navegar, y ninguna instrucción hablada o escrita puede escribir.

---

## Phase 12: Polish y asuntos transversales

**Propósito**: las verificaciones que la constitución exige como comprobaciones ejecutables, y el acabado.

### Verificaciones constitucionales ejecutables

- [ ] T152 **Verificación del principio III** en `tests/constitucion/proveedor-aislado.test.ts`: buscar el nombre del proveedor en todo el repositorio y comprobar que **no aparece fuera de `src/server/proveedor/factpro/`**. Es la comprobación que convierte la sustituibilidad en una propiedad y no en una intención
- [ ] T153 **Verificación del principio IV** en `tests/constitucion/asistencia-sin-clientes.test.ts`: inspeccionar el payload de la única función que habla con el servicio de asistencia y comprobar que ningún dato identificatorio de cliente aparece en él (SC-012)
- [ ] T154 [P] **Verificación del principio I** en `tests/constitucion/emision-con-confirmacion.test.ts`: no existe ningún camino que emita sin clave de idempotencia ni sin confirmación explícita atribuida a un vendedor identificado
- [ ] T155 [P] Verificación de trazabilidad en `tests/constitucion/trazabilidad.test.ts`: toda emisión, anulación e intento fallido queda atribuido a un vendedor y a un momento (SC-011)

### Accesibilidad y escena de uso

- [ ] T156 **Prueba de venta solo con teclado** en `tests/e2e/solo-teclado.spec.ts`: una venta completa, incluida la emisión, sin usar el puntero. La escena es un vendedor de pie y no se puede depender de la precisión del ratón
- [ ] T157 [P] Auditoría de contraste y tamaños en `tests/a11y/`, verificando los tamaños generosos que exige un monitor a distancia y una vista cansada
- [ ] T158 [P] Verificar que **ningún estado se distingue solo por color** en `tests/a11y/redundancia.test.ts`: siempre hay tachado, peso, sangrado, sello o etiqueta acompañando
- [ ] T159 [P] Implementar el respeto de movimiento reducido en `src/ui/tokens/movimiento.ts`, con todo apareciendo sin transición y **sin que ninguna funcionalidad dependa del movimiento**
- [ ] T160 [P] Verificar el comportamiento adaptable en móvil en `tests/e2e/movil.spec.ts`: columna a todo el ancho, entrada arriba y total abajo fijos, misma capacidad de venta (FR-004)

### Acabado

- [ ] T161 Ejecutar la guía de validación completa de [quickstart.md](./quickstart.md), incluidos los escenarios V3 de emisión indeterminada y V4 de la cotización en dos dispositivos
- [ ] T162 **Actualizar `DESIGN.md`** con los valores exactos de espaciado, ancho de columna y tipografía que sobrevivieron a la implementación, sustituyendo los marcadores provisionales
- [ ] T163 [P] Ejercitar la integración completa contra el **entorno de demostración** del proveedor antes de tocar el entorno real, como exige la disciplina de desarrollo de la constitución
- [ ] T164 [P] Desplegar en Firebase App Hosting y verificar el adaptador de Nitro. **Si el adaptador ha dejado de funcionar**, aplicar la contingencia de la decisión 1b de `research.md`: Cloud Run con el mismo artefacto
- [ ] T165 [P] Verificar el coste real de lecturas de una jornada contra la estimación de `data-model.md`, para confirmar que el diseño de una lectura por sesión se sostiene en la práctica
- [ ] T166 Revisar que el alcance excluido no se haya colado: sin contabilidad, sin guía de remisión, sin panel del jefe, sin alertas de stock, sin notas de crédito como flujo, sin comandos que escriban

---

## Dependencias y orden de ejecución

### Dependencias entre fases

- **Setup (Fase 1)**: sin dependencias. Empieza de inmediato.
- **Foundational (Fase 2)**: depende de Setup. **Bloquea todas las historias.**
- **Historias (Fases 3–11)**: todas dependen de Foundational. Luego pueden avanzar en paralelo o en orden de prioridad.
- **Polish (Fase 12)**: depende de que estén completas las historias que se quieran entregar.

### Dependencias entre historias

- **US1 (P1)**: solo depende de Foundational. Es el MVP y no depende de ninguna otra historia.
- **US2 (P2)**: solo depende de Foundational. US1 puede demostrarse con un catálogo cargado a mano, así que **no hay dependencia real** entre ellas.
- **US3 (P3)**: independiente. Se integra con la pantalla de US1 pero se prueba sola.
- **US4 (P4)**: necesita comprobantes emitidos, así que en la práctica va después de US1.
- **US5 (P5)**: toca `emitirComprobante` en T113, de modo que **T113 depende de T061**.
- **US6 (P6)**: independiente, pero **T115 debe resolverse antes de comprometer las tareas siguientes**.
- **US7 (P7)**: reutiliza `RevisionCaptura` de US6, así que **T133 depende de T122**.
- **US8 (P8)**: extiende la emisión y el compartir de US1. **T139 depende de T061** y **T143 de T071**.
- **US9 (P9)**: independiente. Consume la entrada de US1, así que **T146 depende de T053**.

### Dentro de cada historia

- Las pruebas obligatorias se escriben **antes** y deben fallar.
- Dominio antes que servidor; servidor antes que interfaz; interfaz antes que integración.
- Una historia se termina antes de pasar a la siguiente prioridad.

### Oportunidades de paralelismo

- Fase 1: T003 a T009 en paralelo tras T002.
- Fase 2: todo el dominio (T013 a T017) en paralelo; las cuatro piezas de interfaz (T037 a T040) en paralelo.
- Fase 3: las ocho pruebas de servidor (T042 a T049) en paralelo, y los componentes T054 a T056 en paralelo.
- Historias distintas en paralelo por personas distintas, una vez cerrada la Fase 2.

---

## Ejemplo de paralelismo: User Story 1

```bash
# Las ocho pruebas de servidor, a la vez:
T042 emitir-idempotencia.test.ts
T043 emitir-indeterminado.test.ts
T044 emitir-proveedor-caido.test.ts
T045 emitir-rechazo.test.ts
T046 emitir-sin-serie.test.ts
T047 emitir-umbral.test.ts
T048 emitir-total-servidor.test.ts
T049 emitir-importe.test.ts

# Los tres componentes independientes, a la vez:
T054 LineaPedido.tsx
T055 CabeceraDocumento.tsx
T056 EtiquetaSinValor.tsx
```

---

## Estrategia de implementación

### Primero el MVP: solo User Story 1

1. Fase 1 completa: Setup.
2. Fase 2 completa: Foundational. **Es crítica y bloquea todo.**
3. Fase 3 completa: User Story 1.
4. **Parar y validar** la historia de forma independiente.
5. Demostrar con un catálogo cargado a mano.

Con esto la empresa ya puede vender. Todo lo demás mejora un sistema que funciona.

### Entrega incremental

Después del MVP, el orden natural es **US2 para el catálogo real**, **US3 para el alta de clientes** y **US4 para la anulación**, que son las tres fricciones diarias verificadas del sistema anterior. Las historias asistidas —US6 y US7— vienen después porque no pueden sustituir al núcleo, y son las que probablemente convenzan a los vendedores.

### Nota sobre el orden y el criterio del dueño

El criterio de aceptación del dueño es cualitativo: que sus vendedores digan que prefieren SuitPay. Eso pesa a favor de no demorar demasiado US6, que es la capacidad más llamativa. Pero adelantarla antes de que el núcleo esté sólido sería el error clásico: una demostración impresionante sobre una base que todavía no emite bien.

---

## Notas

- Las tareas marcadas [P] tocan archivos distintos y no tienen dependencias pendientes.
- La etiqueta [Story] mantiene la trazabilidad hasta la historia de la especificación.
- Cada historia debe poder completarse y probarse de forma independiente.
- Verifica que las pruebas fallan antes de implementar.
- Confirma en cada punto de control antes de seguir.
