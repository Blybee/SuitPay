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
  - **Superseded parcialmente por T160** (volcado 5): `DESIGN.md` pivota a Modern Soft-Pill; hay que reintroducir radios/sombras suaves y neutros gris/blanco.
- [x] T007 [P] Instalar y autoalojar Atkinson Hyperlegible en `src/ui/tokens/tipografia.ts`, **verificando la disponibilidad de su compañero monoespaciado** y cayendo a Martian Mono si no existe; dejar constancia de cuál se usó
  - Constancia: el compañero monoespaciado **sí existe**. Se usa `@fontsource-variable/atkinson-hyperlegible-mono` junto a `atkinson-hyperlegible-next`. No hizo falta recurrir a Martian Mono.
- [x] T008 [P] Configurar Vitest y Testing Library en `vitest.config.ts`
- [x] T009 [P] Configurar Playwright en `playwright.config.ts` con proyectos de escritorio y móvil
- [x] T010 Crear el proyecto de Firebase independiente y escribir `firebase.json`, `firestore.rules`, `firestore.indexes.json` y `storage.rules` iniciales
  - Enlazado: `.firebaserc` default `blayblocklabs-antrax`, alias `emulador` → `demo-suitpay`; `firebase.json` hosting site **`suitpay`**; `apphosting.yaml` con valores públicos del cliente; `.env.example` + `.env.local` (gitignored). **App Check fuera de alcance.** Queda habilitar Blaze/Scheduler en consola y desplegar.
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
- [x] T022 Pruebas de las reglas de seguridad contra el emulador en `tests/emulador/reglas.test.ts`, verificando explícitamente que un cliente con rol de administrador **tampoco** puede escribir un comprobante ni una serie
  - Ejecutadas con JDK 21 + `npm run prueba:emulador` (37 pruebas del proyecto emulador en verde).
- [x] T023 [P] Inicializar el cliente de Firebase en `src/infra/firebase/` (**sin App Check**; decisión de alcance US1)
- [x] T024 [P] Inicializar el Admin SDK en `src/server/firebase/`
- [x] T025 Implementar la verificación transversal de las funciones de servidor en `src/server/auth/`: sesión válida, usuario activo y rol suficiente, **tomando la identidad del token y nunca de la petición** (principio I, FR-003). **Sin atestación App Check.**
- [x] T026 [P] Definir el catálogo de códigos de error estables en `src/server/errores.ts`, con mensajes aptos para mostrar al vendedor y **sin propagar nunca el mensaje crudo del proveedor**

### Frontera del proveedor

- [x] T027 **Comprobar en el entorno de demostración del proveedor…** (a) número explícito; (b) forma de errores
  - **Cerrado 2026-07-29**: número explícito respetado (`F001-900001`); reemisión → 404 `"El documento ya está registrado."`; consulta ausente → 404 `"Documento no encontrado."`; sin código en JSON, solo `errors[].message`. Ver `research.md` § T027. Adaptador y transporte actualizados. Script: `scripts/t027-sondeo-proveedor.mjs`. **Rotar el token** expuesto en chat.
- [x] T028 Definir la interfaz del proveedor de emisión en `src/server/proveedor/interfaz.ts` según `contracts/proveedor-emision.md`: `emitir`, `anular`, `consultarDocumento`, `consultarContribuyente`, con la clasificación de fallos en `rechazo_definitivo`, `indisponible` e `indeterminado`, apoyada en lo que T027 haya averiguado
- [x] T029 [P] Implementar el proveedor simulado en `src/server/proveedor/simulado.ts`, capaz de reproducir a voluntad los tres modos de fallo con la forma real que T027 haya observado. Es la pieza sin la cual las pruebas obligatorias de la constitución no se pueden escribir
- [x] T030 Implementar el adaptador de Factpro en `src/server/proveedor/factpro/`, con la autenticación, la normalización de sus respuestas a la interfaz propia y la **traducción de sus estados a los nuestros según la tabla de la decisión 4b**, recordando que sus estados `03` y `19` de "sin respuesta de SUNAT" **no son fallos nuestros** y no deben derivar en `indeterminado`
  - Traducción de estados, transporte y `emitir` alineados a hallazgos T027 (payload v3, errores con `errors[].message`). Anular sigue en US4.
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
  - **Superseded por T161–T163** (volcado 5): `design.md` exige sidebar, full-bleed y tabs; los renders `comp-*.png` están obsoletos.

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
- [x] T050 [P] [US1] Prueba de integración de la transacción en `tests/emulador/emitir-transaccion.test.ts`: el comprobante y el incremento del correlativo ocurren **en la misma transacción**, y un fallo deja ambos sin efecto
  - Credencial PEM de relleno para Admin SDK + `fileParallelism: false` en el proyecto emulador para no chocar con `clearFirestore` de T022.
- [x] T051 [US1] Prueba de extremo a extremo en `tests/e2e/venta-escrita.spec.ts`: buscar tres productos con los términos desordenados, ajustar un precio, cambiar de boleta a factura conservando el pedido, emitir, y comprobar que **una doble pulsación produce un solo comprobante**
  - Desbloqueada: con emuladores (JDK 21) la mitad de doble pulsación deja de saltarse vía `npm run prueba:e2e:completa`.

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
- [x] T066 [US1] ~~Documento interno de contingencia~~ — **CANCELADA** (decisión 10): FR-050a retirado. `contingencia.tsx` retirado en T172.
- [x] T067 [US1] ~~`procesarPendientes` + Scheduler~~ — **CANCELADA** (decisión 10): no hay cola en segundo plano.
- [x] T068 [US1] ~~`reconciliarEmisiones` programada~~ — **CANCELADA** (decisión 10): la consulta pasa a ser bajo demanda (T171).
- [x] T069 [US1] ~~Configurar Cloud Scheduler~~ — **CANCELADA** (decisión 10): no se usa.
- [x] T070 [P] [US1] Implementar la salida impresa en A4 en `src/features/emision/impresion.ts` desde los puestos de escritorio (FR-053) — *`.ts` y no `.tsx`: se imprime el PDF del proveedor, así que no hay plantilla que maquetar*
- [x] T071 [P] [US1] Implementar la obtención del comprobante como archivo compartible en `src/features/emision/compartir.ts`, pensada para el móvil (FR-054)
- [x] T072 [US1] Implementar la reimpresión de un comprobante ya emitido en `src/features/emision/reimprimir.ts`, de forma que **un fallo de impresión no invalide ni repita la emisión** (FR-055)
- [x] T073 [US1] Implementar la sesión persistente entre jornadas en `src/features/sesion/`, con revalidación en segundo plano y **bloqueo de la emisión cuando la sesión ya no sea válida o el vendedor esté desactivado** (FR-002, FR-003)
- [x] T074 [P] [US1] Implementar el estado de pedido vacío en `src/routes/index.tsx`: columna con sus cabeceras de columna y la entrada enfocada, **sin ilustración ni mensaje de bienvenida**
- [x] T173 [US1] Implementar la pantalla de acceso en `src/routes/acceso.tsx`: correo/contraseña vía `usarSesion.entrar`, redirección al mostrador o a administración según rol, y guarda de rutas sin sesión → `/acceso` (FR-002 complemento; el logout ya está en el sidebar)
- [x] T174 [US1] Implementar el puente de identidad a las server functions: middleware cliente que adjunta `Authorization: Bearer ${idToken}` registrado en `src/start.ts` (`functionMiddleware`), cubriendo **todas** las funciones que llaman `exigirIdentidad`

**Checkpoint**: User Story 1 está implementada y su lógica verificada con 128 pruebas que pasan. La marca `[~]` señala lo que está escrito pero **no ejecutado todavía**, y conviene no confundirlo con hecho.

Lo que falta para poder decir que la empresa vende, y en este orden:

1. **Java** (T022), que desbloquea de golpe las reglas de seguridad, la transacción contra Firestore de T050 y la mitad de emisión de T051. *Aplazado: el camino operativo de emisión UI usa Firebase cloud, no emuladores.*
2. ~~**Firebase** (T010)~~ — enlazado. Falta desplegar. **Sin App Check. Sin Cloud Scheduler** (decisión 10).
3. ~~**T027**~~ — cerrado.
4. ~~**Alinear código a la decisión 10** (T170–T172)~~ — cerrado.
5. **T173 + T174** (acceso + Bearer) y **T083–T085** (admin completo) para emitir desde la UI contra cloud + proveedor demo.

**Decisiones de alcance (US1)**:
- No App Check.
- No Cloud Scheduler ni venta en espera automática (decisión 10 de `research.md`).
- Emisión UI operativa contra Firebase cloud (`VITE_USAR_EMULADORES=false`); emuladores no bloquean este camino.

---

## Phase 4: User Story 2 — Poner el catálogo en producción (Priority: P2)

**Goal**: el administrador carga el catálogo, revisa lo que el sistema entendió y confirma.

**Independent Test**: el administrador carga un archivo con productos y comprueba que quedan disponibles en la búsqueda, con sus precios y unidades.

- [x] T075 [P] [US2] Prueba de códigos duplicados en `tests/unit/server/importar-duplicados.test.ts`: el conflicto se informa y **no se resuelve por cuenta del sistema** (FR-010)
- [x] T076 [P] [US2] Prueba de comparación en `tests/unit/server/importar-diferencias.test.ts`: sobre un catálogo ya publicado, la validación distingue productos nuevos, cambios de precio y desapariciones (FR-011)
- [x] T077 [P] [US2] Implementar la interpretación de archivos estructurados en `src/server/catalogo/lector-json.ts` — formato `json_tienda` (decisión 11 de `research.md`); fixture `tests/fixtures/productos-tienda-muestra.json`
- [ ] T078 [US2] Importación PDF lista de precios (FR-009b, decisión 13). El JSON de tienda (T077/T082) sigue siendo camino paralelo válido. Desglose:
  - [ ] T078a [P] Añadir dependencia `unpdf` y sustituir el stub de `src/server/catalogo/lector-documento.ts` por extracción con `extractTextItems` + reconstrucción de filas (CODIGO | PRODUCTO | U.M. | PRECIO; ignorar % DCT.; `LINEA` → `marca` efímera)
  - [ ] T078b [P] Mapa U.M. → unidad SuitPay y precio a céntimos; ruido/cabeceras omitidos; tests unitarios contra `docs/LISTAS.pdf` (y/o fixture recortado) en `tests/unit/server/lector-documento.test.ts`
  - [ ] T078c Server fn `interpretarCatalogoDocumento` (base64 → filas, sin escribir) + extensión de `importarCatalogo` con formato `productos_revisados` (`contracts/functions.md`)
  - [ ] T078d UI en `src/routes/administracion/catalogo.tsx`: aceptar `.pdf`; grilla de revisión (virtualizada si hace falta) con selección, eliminar, autoselección por marca, edición inline; luego validar/publicar sin aplicar nada hasta confirmar
- [x] T079 [US2] Implementar la detección de conflictos en `src/server/catalogo/conflictos.ts`: códigos repetidos y unidades desconocidas (precio ausente → 0, no bloquea; decisión 11)
- [x] T080 [US2] Implementar la comparación contra el catálogo publicado en `src/server/catalogo/diferencias.ts`
- [x] T081 [US2] Implementar la función de servidor `importarCatalogo` en `src/server/catalogo/importar.ts` con sus modos `validar` y `publicar`, escribiendo el catálogo completo **en una sola escritura** e incrementando su versión
- [x] T082 [US2] Implementar la pantalla de importación en `src/routes/administracion/catalogo.tsx`, que muestra el resumen y las diferencias **antes de confirmar nada** (FR-009) — *JSON; PDF amplía en T078d*
- [x] T083 [P] [US2] Implementar la gestión de series en `src/routes/administracion/series.tsx`, con el alta por vendedor y tipo de documento que FR-031 presupone. **Insumo API** (decisión 12): una serie por vendedor+tipo; sync al proveedor. Frontera + UI admin + escritura Firestore `{vendedorId}__{tipo}` + cabecera del mostrador (`leerMiSerie`).
- [x] T084 [P] [US2] Implementar la gestión de usuarios y roles en `src/routes/administracion/usuarios.tsx`, replicando el rol en las reivindicaciones del token para que las reglas lo evalúen sin lecturas (FR-005). Bootstrap del primer admin: `scripts/bootstrap-admin.mjs`.
- [x] T085 [P] [US2] Implementar la edición de parámetros en `src/routes/administracion/parametros.tsx`, incluido el umbral de identificación, **que debe ser barato de cambiar porque es de origen regulatorio**

**Checkpoint**: el catálogo real está en producción y la administración puede configurar series, usuarios y parámetros.

---

## Phase 5: User Story 3 — Dar de alta un cliente sin abandonar la venta (Priority: P3)

**Goal**: el vendedor registra un cliente nuevo desde la propia pantalla de venta, sin perder el pedido.

**Independent Test**: partiendo de una venta en curso, el vendedor registra un cliente inexistente y termina la venta sin haber perdido el pedido.

- [x] T086 [P] [US3] Prueba de la consulta de contribuyente en `tests/unit/server/consultar-contribuyente.test.ts`: la función **devuelve datos para revisión y no crea el cliente** (principio I), y ante servicio caído devuelve un error que no bloquea
- [x] T087 [US3] Implementar la función de servidor `consultarContribuyente` en `src/server/contribuyentes/consultar.ts`, señalando explícitamente la condición de no habido
- [x] T088 [P] [US3] Implementar `consultarContribuyente` en el adaptador de Factpro en `src/server/proveedor/factpro/contribuyentes.ts`
- [x] T089 [US3] Implementar la comprobación de existencia de un cliente en `src/features/clientes/existencia.ts` mediante **lectura directa por identificador**, sin consulta ni índice
- [x] T090 [US3] Implementar el alta en contexto en `src/features/clientes/alta-en-contexto.tsx`, ofrecida en la propia pantalla de venta cuando el documento no está registrado (FR-022)
- [x] T091 [US3] Implementar la revisión y confirmación de los datos traídos en `src/features/clientes/revision.tsx`, guardando **solo tras la confirmación del vendedor** (FR-023)
- [x] T092 [P] [US3] Implementar la advertencia visible de contribuyente no habido en `src/features/clientes/advertencia.tsx`, **dejando la decisión al vendedor** (FR-024)
- [x] T093 [US3] Implementar la resolución local de coincidencias de razón social en `src/features/clientes/coincidencias.ts` sobre `indices/clientes` en caché, presentándolas en la papeleta de contexto (FR-025)
- [x] T094 [P] [US3] Implementar la introducción manual de datos en `src/features/clientes/manual.tsx` para cuando la consulta no responda, **sin bloquear la venta** (FR-026)
- [x] T095 [US3] Implementar la escritura del cliente y su entrada en el índice en `src/server/clientes/crear.ts`, en una sola operación

**Checkpoint**: un cliente nuevo se registra sin salir de la venta.

---

## Phase 6: User Story 4 — Anular un comprobante dentro de plazo (Priority: P4)

**Goal**: localizar un comprobante emitido hoy, ver qué se va a anular, indicar el motivo y confirmar.

**Independent Test**: emitido un comprobante, se anula dentro de plazo y queda registrado como anulado con su motivo y su autor.

### Pruebas obligatorias de User Story 4 ⚠️

- [x] T096 [P] [US4] Prueba de la ventana de anulación en `tests/unit/server/anular-ventana.test.ts`: un comprobante de ayer se rechaza con `fuera_de_ventana_anulacion`, y el cálculo se hace **en horario de Lima**, incluido el caso de las 19:00 que en UTC ya sería del día siguiente (FR-037, FR-038)
- [x] T097 [P] [US4] Prueba de fallo del proveedor al anular en `tests/unit/server/anular-proveedor-caido.test.ts`: el comprobante **no queda anulado localmente** si el proveedor no confirmó la baja
- [x] T098 [P] [US4] Prueba de reintento de anulación en `tests/unit/server/anular-idempotencia.test.ts`: anular dos veces el mismo comprobante no duplica la baja ni altera el registro original
- [x] T099 [P] [US4] Prueba de que nada se borra en `tests/emulador/anular-no-borra.test.ts`: tras la anulación el documento **sigue existiendo** con su estado, motivo, autor y momento (FR-030)
  - Escrita; se ejecuta con emulador (`npm run prueba:emulador`). Sin emulador se omite.
- [x] T100 [P] [US4] **Prueba de vocabulario** en `tests/unit/ui/sin-eliminar.test.ts`: la palabra "eliminar" no aparece en ninguna etiqueta, mensaje ni texto de ayuda referido a un comprobante, recorriendo las cadenas de la interfaz (FR-039)

### Implementación de User Story 4

- [x] T101 [US4] Implementar la función de servidor `anularComprobante` en `src/server/emision/anular.ts`: verifica estado y ventana, solicita la baja al proveedor, y registra motivo, autor y momento en el propio documento. **No borra nada**
- [x] T102 [P] [US4] Implementar `anular` en el adaptador de Factpro en `src/server/proveedor/factpro/anular.ts`
- [x] T103 [US4] Implementar la consulta de comprobantes en `src/routes/comprobantes/index.tsx`, con paginación por cursores y **nunca por desplazamiento de posición**
- [x] T104 [US4] Implementar el detalle del comprobante en `src/routes/comprobantes/$comprobanteId.tsx`, con el sello violeta si está aceptado y la marca de ANULADO si lo está
- [x] T105 [US4] Implementar la confirmación de anulación en `src/features/emision/confirmar-anulacion.tsx`, que **muestra qué documento se va a anular** y exige el motivo antes de proceder (FR-037)
- [x] T106 [P] [US4] Implementar el estado de fuera de ventana en `src/features/emision/fuera-de-ventana.tsx`, que explica que corresponde una nota de crédito y **no ofrece un botón que va a fallar**

**Checkpoint**: la anulación funciona dentro de plazo, se impide fuera de plazo, y nada se borra nunca. *Alcanzado en código (2026-08-05): pruebas de servidor/UI en verde; T099 requiere emulador.*

---

## Phase 7: User Story 5 — Guardar el pedido como cotización y recuperarlo (Priority: P5)

**Goal**: guardar un pedido con un número que lo identifica y recuperarlo después desde cualquier dispositivo.

**Independent Test**: se guarda una cotización en un dispositivo y se recupera y convierte en comprobante desde otro.

### Pruebas obligatorias de User Story 5 ⚠️

- [x] T107 [P] [US5] **Prueba de la carrera entre dispositivos** en `tests/emulador/cotizacion-dos-dispositivos.test.ts`: dos claves de idempotencia distintas sobre la misma cotización producen **un solo comprobante**, y la segunda recibe `cotizacion_ya_convertida`. Es el hueco que la clave de idempotencia por sí sola no cubre
  - **Superseded por T173/T176** (enmienda 2026-08-07): el segundo error pasa a `cotizacion_ya_usada` y la cotización se borra en duro.
- [x] T108 [P] [US5] Prueba de la transacción de conversión en `tests/emulador/cotizacion-transaccion.test.ts`: la cotización pasa a `convertida` **en la misma transacción** que crea el comprobante, y un fallo deja ambos sin efecto
  - **Superseded por T173/T176**: la transacción **borra** la cotización; un fallo deja comprobante y cotización sin el efecto parcial de conversión.

### Implementación de User Story 5

- [x] T109 [P] [US5] Implementar la numeración de cotizaciones en `src/server/cotizaciones/numerar.ts`, con un número legible para poder pedirla por voz o por comando
- [x] T110 [US5] Implementar el guardado de la cotización en `src/features/cotizaciones/guardar.ts` (FR-016)
- [x] T111 [US5] Implementar la recuperación por número en `src/routes/cotizaciones/index.tsx`, accesible **desde cualquier dispositivo y para cualquier vendedor autorizado** (FR-017)
- [x] T112 [US5] Implementar la advertencia de cambios al recuperar en `src/features/cotizaciones/diferencias.ts`, comparando contra el catálogo en caché **sin lecturas adicionales** y señalando precios cambiados y productos desaparecidos (FR-018)
- [x] T113 [US5] Extender `emitirComprobante` en `src/server/emision/emitir.ts` para marcar la cotización como `convertida` en la misma transacción
  - **Superseded por T174**: borrar en duro en lugar de marcar `convertida`.
- [x] T114 [P] [US5] Implementar el estado de cotización ya convertida en `src/features/cotizaciones/ya-convertida.tsx`, que **indica en qué comprobante terminó** y ofrece abrirlo (FR-019)
  - **Superseded por T175**: aviso de cotización inexistente / ya usada (sin enlace a comprobante vía estado `convertida`).

**Checkpoint**: las cotizaciones viajan entre dispositivos y solo pueden convertirse una vez.

---

## Phase 8: User Story 6 — Dictar el pedido (Priority: P6)

**Goal**: el vendedor dicta el pedido y obtiene una propuesta revisable línea a línea.

**Independent Test**: se dicta un pedido de varios productos y se obtiene una propuesta revisable que, tras aprobarse, produce el mismo pedido que se habría escrito a mano.

> **Aviso de riesgo**: las historias 6 y 7 reutilizan herramientas que ya funcionan en el proyecto de la tienda virtual pero están acopladas a él. El grado de reelaboración está sin evaluar. La tarea T115 existe para averiguarlo antes de comprometerse.

- [x] T115 [US6] **Evaluar el acoplamiento** de las herramientas de captura existentes en el proyecto de la tienda virtual y decidir entre reutilizar, adaptar o reescribir, dejando la conclusión en `specs/001-mostrador-asistido/research.md`. Si resultara profundo, las historias 6 y 7 se replantean antes de seguir
- [x] T116 [P] [US6] **Prueba del principio IV** en `tests/unit/server/asistencia-payload.test.ts`: se inspecciona el payload que sale hacia el servicio de asistencia y se verifica que **no contiene razón social, RUC, DNI, dirección, teléfono, correo ni historial de compras** (FR-045). Es la prueba que hace verificable un principio no negociable
- [x] T117 [P] [US6] Prueba de conmutación de credencial en `tests/unit/server/asistencia-conmutacion.test.ts`: ante error de cuota, la función conmuta a la segunda credencial configurada
- [x] T118 [P] [US6] Prueba de asistencia caída en `tests/unit/server/asistencia-caida.test.ts`: se devuelve `asistencia_no_disponible` y **la venta se puede completar escribiendo** (FR-046)
- [x] T119 [US6] Implementar la función de servidor `interpretarCaptura` en `src/server/asistencia/interpretar.ts` como **único punto de salida del sistema hacia el servicio de asistencia**, construyendo el payload con el medio y el lote de productos y nada más
- [x] T120 [P] [US6] Implementar el envío del lote filtrado de candidatos en `src/features/captura/lote.ts`, preseleccionado con la búsqueda difusa local para no enviar los 500 productos
- [x] T121 [US6] Implementar la grabación y subida del audio en `src/features/captura/audio.tsx`, con el original en Cloud Storage y **la posibilidad de abandonar la espera y seguir escribiendo**
- [x] T122 [US6] Implementar `RevisionCaptura` en `src/ui/componentes/RevisionCaptura.tsx`: por cada renglón, la lectura original **tachada en tinta desvaída** y debajo, sangrada, la propuesta limpia, conservando las mismas columnas que el pedido normal (FR-042)
- [x] T123 [US6] Implementar la elección entre candidatos ambiguos en `src/features/captura/ambiguos.tsx`, en rojo hasta que se elija, **presentando las opciones en lugar de escoger** (FR-043)
- [x] T124 [US6] Implementar el marcado de renglones pendientes en `src/features/captura/pendientes.tsx`, que **impide emitir mientras quede uno sin resolver** y no descarta nada en silencio (FR-044)
- [x] T125 [US6] Implementar la aprobación de la propuesta en `src/features/captura/aprobar.ts`, que convierte la revisión en líneas normales del pedido y **no emite nada por sí sola** (FR-041)
- [x] T126 [P] [US6] Implementar la resolución de la identidad del cliente en el cliente y el servidor en `src/features/captura/cliente.ts`, **nunca en el modelo** (FR-045)
- [x] T127 [P] [US6] Implementar el estado de asistencia caída en la entrada en `src/ui/componentes/Entrada.tsx`: los botones de micrófono y cámara **visiblemente inertes con el motivo dicho**, sin presentar la escritura como plan B
- [x] T128 [US6] Prueba de extremo a extremo del dictado en `tests/e2e/dictado.spec.ts`: dictar tres productos, corregir una línea, aprobar y comprobar que el pedido resultante es el mismo que se habría escrito

**Checkpoint**: el dictado produce propuestas revisables y ningún dato de cliente sale del sistema.

---

## Phase 9: User Story 7 — Capturar una guía manual por fotografía (Priority: P7)

**Goal**: fotografiar una guía manual y obtener un pedido revisable, comparable renglón a renglón con la foto.

**Independent Test**: se fotografía una guía manual real y se obtiene un pedido revisable cuyo contenido puede compararse renglón a renglón con la foto.

- [x] T129 [P] [US7] Prueba de medio ilegible en `tests/unit/server/captura-ilegible.test.ts`: se devuelve `medio_ilegible`, **la fotografía original se conserva** y se permite reintentar con otra
- [x] T130 [P] [US7] Prueba de renglones tachados en `tests/unit/server/captura-tachados.test.ts`: los renglones que no se pudieron interpretar quedan marcados como pendientes y **ninguno se descarta en silencio**
- [x] T131 [US7] Implementar la captura y subida de la fotografía en `src/features/captura/imagen.tsx`, con el original en Cloud Storage
- [x] T132 [US7] Extender `interpretarCaptura` en `src/server/asistencia/interpretar.ts` para el tipo imagen, devolviendo **el texto extraído de cada renglón antes de proponer productos**
- [x] T133 [US7] Implementar la revisión en dos pasos en `src/features/captura/revision-imagen.tsx`: primero el texto extraído, después el emparejamiento contra el lote filtrado (FR-042)
- [x] T134 [P] [US7] Implementar la miniatura de la fotografía junto a la revisión en `src/features/captura/miniatura.tsx`, para poder comparar contra el original sin salir de la pantalla
- [x] T135 [P] [US7] Implementar el estado de fotografía ilegible en `src/features/captura/ilegible.tsx`, con el motivo y el reintento
- [x] T136 [US7] Prueba de extremo a extremo de la fotografía en `tests/e2e/fotografia.spec.ts` con una guía manual real, verificando que un renglón ilegible bloquea la emisión hasta resolverse

**Checkpoint**: el trabajo en papel entra al sistema sin descartar nada en silencio.

---

## Phase 10: User Story 8 — Canal de vecinos como cotizaciones por alias (Priority: P8)

**Goal**: documentar la entrega al vecino como cotización viva por alias; cuando paga, convertirla en boleta, factura o nota de venta (la cotización se elimina). **No** incluye UX de crédito/cobro.

**Independent Test**: se crea un vecino por comando confirmado, se le agregan productos en su tab y se convierte la cotización en comprobante; la cotización desaparece.

**Dependencias**: Phase C7 (borrado de cotizaciones T173–T177) y US5 deben estar hechas.

### Pruebas obligatorias de User Story 8 ⚠️

- [x] T137 [P] [US8] Prueba unitaria de parseo `/crear vecino` en `tests/unit/features/crear-vecino.test.ts` (propuesta sin escritura). Emulador de creación completa: pendiente de semilla con cliente en suite emulador
- [x] T138 [P] [US8] Prueba de emisión desde cotización de vecino en `tests/emulador/vecino-emitir.test.ts`: emitir borra la cotización (FR-019/FR-035a); segundo intento → `cotizacion_ya_usada`

### Implementación de User Story 8

- [x] T139 [US8] Extender modelo/tipos/reglas/índice para `canal` y `aliasVecino` en `src/features/cotizaciones/tipos.ts`, `firestore.rules`, `firestore.indexes.json` y listados por canal (FR-016/FR-034)
- [x] T140 [US8] Implementar parseo de `/crear vecino {alias} {DNI/RUC}` y propuesta Confirmar|Cancelar en `src/features/comandos/` + cableado en el mostrador (FR-034a, principio I)
- [x] T141 [US8] Implementar alta de vecino al confirmar: resolver/alta cliente en contexto + crear cotización viva `canal: vecino` en `src/features/vecinos/`, y abrir tab Vecinos en ese alias (FR-034b)
- [x] T142 [US8] Implementar UI del tab Vecinos en `src/features/vecinos/panel.tsx`: sub-tabs solo con alias; cuerpo = líneas + total reutilizando `LineaPedido` / pie; vacío con pista del comando (FR-034)
- [x] T143 [US8] Enrutar altas de producto desde Entrada al vecino activo y persistir la cotización viva (create/update) mientras el sub-tab esté seleccionado (FR-035)
- [x] T143a [P] [US8] Permitir convertir/emitir la cotización del vecino activo a boleta, factura o nota de venta reutilizando el flujo de emisión + borrado T174 (FR-035a)
- [ ] T143b [P] [US8] Prueba e2e o de integración del flujo vecino en `tests/e2e/vecinos.spec.ts` (o emulador): crear → agregar líneas → emitir → cotización ausente

**Checkpoint**: el canal de vecinos queda documentado el mismo día de la entrega como cotización; el comprobante nace al convertir cuando el vecino paga.

> **Superseded (crédito/cobro)**: las tareas previas T137–T143 que cubrían emisión a crédito, `registrar-cobro`, ruta `/credito` y sello COBRADO quedan **canceladas** por la enmienda 2026-08-07 (decisión 11 de `research.md`). El esquema `condicionPago` crédito puede seguir existiendo en dominio/emisión, pero sin UX ni Phase 10.

---

## Phase 11: User Story 9 — Consultar desde el buscador con comandos (Priority: P9)

**Goal**: resolver consultas cortas desde la misma entrada que se usa para productos, sin cambiar de pantalla.

**Independent Test**: se pide por comando la lista de comprobantes de un cliente y se obtiene sin salir de la pantalla de venta.

- [ ] T144 [P] [US9] **Prueba de la frontera de los comandos** en `tests/unit/features/comandos-solo-lectura.test.ts`: ninguna instrucción en lenguaje natural puede crear, modificar, anular o dar de baja un **comprobante**, y el intento **indica dónde se realiza esa operación** (FR-048, principio I). `/crear vecino` es de US8 (T140) y queda fuera de este catálogo de solo-consulta
- [ ] T145 [US9] Implementar el catálogo cerrado de operaciones de consulta en `src/features/comandos/catalogo.ts`. Es un catálogo cerrado por diseño: **no hay interpretación libre de intenciones**. **Cada comando nuevo MUST también registrarse** en `src/features/comandos/pistas.ts` → `CATALOGO_DE_COMANDOS` (`prefijo` + `parametros`) para las pistas del buscador (FR-047a); `/crear vecino` ya está
- [ ] T146 [US9] Extender el reconocimiento de comandos reutilizando modo `/` de `Entrada` + `pistas.ts` (ya oculta sugerencias de producto y muestra parámetros fantasma). Completar en `src/features/comandos/reconocer.ts` el despacho a consultas; no reinventar el catálogo de pistas
- [ ] T147 [P] [US9] Implementar la consulta de últimos comprobantes de un cliente en `src/features/comandos/comprobantes-cliente.ts`, con cursor y página corta; **añadir** su entrada en `CATALOGO_DE_COMANDOS`
- [ ] T148 [P] [US9] Implementar la consulta de cotización por número en `src/features/comandos/cotizacion.ts`; **añadir** su entrada en `CATALOGO_DE_COMANDOS`
- [ ] T149 [US9] Implementar la resolución de instrucciones incompletas en `src/features/comandos/incompletas.tsx` mediante la papeleta de contexto, que **pide lo que falta en lugar de fallar** (FR-049)
- [ ] T150 [P] [US9] Implementar la presentación de resultados sin abandonar la pantalla de venta en `src/features/comandos/resultados.tsx` (FR-047)
- [ ] T151 [US9] Extender el dictado para admitir comandos hablados en `src/features/comandos/por-voz.ts`, con la misma frontera: consultas sí; escritura de comprobantes no

**Checkpoint**: las consultas se resuelven sin navegar, y ninguna instrucción hablada o escrita puede escribir.

---

## Phase 12: Polish y asuntos transversales

**Propósito**: las verificaciones que la constitución exige como comprobaciones ejecutables, y el acabado.

### Verificaciones constitucionales ejecutables

- [x] T152 **Verificación del principio III** en `tests/constitucion/proveedor-aislado.test.ts`: el nombre del proveedor **no aparece** en `domain`/`features`/`ui`/`routes`/`infra` (sí puede vivir en `src/server/proveedor/**` y tooling de frontera)
- [ ] T153 **Verificación del principio IV** en `tests/constitucion/asistencia-sin-clientes.test.ts`: inspeccionar el payload de la única función que habla con el servicio de asistencia y comprobar que ningún dato identificatorio de cliente aparece en él (SC-012)
- [x] T154 [P] **Verificación del principio I** en `tests/constitucion/emision-con-confirmacion.test.ts`: no existe ningún camino que emita sin clave de idempotencia ni sin confirmación explícita atribuida a un vendedor identificado
- [ ] T155 [P] Verificación de trazabilidad en `tests/constitucion/trazabilidad.test.ts`: toda emisión, anulación e intento fallido queda atribuido a un vendedor y a un momento (SC-011)

### Accesibilidad y escena de uso

- [ ] T156 **Prueba de venta solo con teclado** en `tests/e2e/solo-teclado.spec.ts`: una venta completa, incluida la emisión, sin usar el puntero. La escena es un vendedor de pie y no se puede depender de la precisión del ratón
- [ ] T157 [P] Auditoría de contraste y tamaños en `tests/a11y/`, verificando los tamaños generosos que exige un monitor a distancia y una vista cansada
- [ ] T158 [P] Verificar que **ningún estado se distingue solo por color** en `tests/a11y/redundancia.test.ts`: siempre hay tachado, peso, sangrado, sello o etiqueta acompañando
- [ ] T159 [P] Implementar el respeto de movimiento reducido en `src/ui/tokens/movimiento.ts`, con todo apareciendo sin transición y **sin que ninguna funcionalidad dependa del movimiento**
- [ ] T160 [P] Verificar el comportamiento adaptable en móvil en `tests/e2e/movil.spec.ts`: columna a todo el ancho, entrada arriba y total abajo fijos, misma capacidad de venta (FR-004)

### Acabado

- [ ] T161 Ejecutar la guía de validación completa de [quickstart.md](./quickstart.md), incluidos los escenarios V3 de emisión indeterminada, V4/V4b de cotizaciones y V14b de vecinos
- [ ] T162 **Actualizar `DESIGN.md`** con los valores exactos de espaciado, ancho de columna y tipografía que sobrevivieron a la implementación, sustituyendo los marcadores provisionales
- [ ] T163 [P] Ejercitar la integración completa contra el **entorno de demostración** del proveedor antes de tocar el entorno real, como exige la disciplina de desarrollo de la constitución
- [ ] T164 [P] Desplegar en Firebase App Hosting y verificar el adaptador de Nitro. **Si el adaptador ha dejado de funcionar**, aplicar la contingencia de la decisión 1b de `research.md`: Cloud Run con el mismo artefacto
- [ ] T165 [P] Verificar el coste real de lecturas de una jornada contra la estimación de `data-model.md`, para confirmar que el diseño de una lectura por sesión se sostiene en la práctica
- [ ] T166 Revisar que el alcance excluido no se haya colado: sin contabilidad, sin cobranzas/crédito como UX, sin guía de remisión en este código (vive en `002`), sin notas de crédito como flujo, sin login por alias, sin comandos que escriban **salvo** `/crear vecino` con confirmación (FR-034a). Inventario/alertas → `003-inventario-almacen`; ranking/estadísticas → `004-ranking-productos` (no “colados” en `001` si solo hay enlaces)

---

## Dependencias y orden de ejecución

### Dependencias entre fases

- **Setup (Fase 1)**: sin dependencias. Empieza de inmediato.
- **Foundational (Fase 2)**: depende de Setup. **Bloquea todas las historias.**
- **Historias (Fases 3–11)**: todas dependen de Foundational. Luego pueden avanzar en paralelo o en orden de prioridad.
- **Phase C7 (borrado de cotizaciones)**: depende de US5 (Phase 7). **Bloquea Phase 10 / US8.**
- **Polish (Fase 12)**: depende de que estén completas las historias que se quieran entregar.

### Dependencias entre historias

- **US1 (P1)**: solo depende de Foundational. Es el MVP y no depende de ninguna otra historia.
- **US2 (P2)**: solo depende de Foundational. US1 puede demostrarse con un catálogo cargado a mano, así que **no hay dependencia real** entre ellas.
- **US3 (P3)**: independiente. Se integra con la pantalla de US1 pero se prueba sola.
- **US4 (P4)**: necesita comprobantes emitidos, así que en la práctica va después de US1.
- **US5 (P5)**: toca `emitirComprobante` en T113, de modo que **T113 depende de T061**. La enmienda de borrado (T173–T177) supersede T113/T114.
- **US6 (P6)**: independiente, pero **T115 debe resolverse antes de comprometer las tareas siguientes**.
- **US7 (P7)**: reutiliza `RevisionCaptura` de US6, así que **T133 depende de T122**.
- **US8 (P8)**: cotizaciones de vecino sobre US5 + C7. **T139–T143 dependen de T174/T177**; emisión reutiliza T061.
- **US9 (P9)**: independiente. Consume la entrada de US1, así que **T146 depende de T053**. El comando `/crear vecino` vive en US8 (T140), no en el catálogo de solo-consulta de US9.

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

## Phase C5: Converge — Enmienda volcado 5 (2026-07-29)

**Propósito**: trabajo documentado en assessment + SDD tras el volcado 5, aún **sin implementar** hasta que el usuario pida `/speckit-implement` o tareas concretas. Origen: `.specify/assessments/sistema-facturacion/` (intake/research/concept/decision) y enmiendas a `DESIGN.md`, `design.md`, `spec.md`, `data-model.md`, `research.md`, `plan.md`.

**Dependencias**: T010 y T027 siguen bloqueantes operativos; T160–T165 afectan UI ya construida (T006/T037/T041).

- [x] T160 [P] **Pivote tokens Modern Soft-Pill** en `src/ui/tokens/tema.css` y `src/ui/tokens/colores.ts`: sustituir papel/mesa por lienzo `gray-50`/`gray-100` y superficie blanca; reintroducir `--radius-*` y `--shadow-*` para `rounded-full`, `rounded-2xl`/`3xl`, `shadow-sm`/`shadow-md`; purgar vaciado que bloqueaba Soft-Pill. Alinear con `DESIGN.md` enmendado. Mantener prohibición de verde.
  - `papel` = blanco, `mesa` = `#f9fafb`, `borde` = `#e5e7eb`; radios y sombras Soft-Pill activos; sin verde.
- [x] T161 [P] **Shell con sidebar** en `src/routes/__root.tsx` (+ componente `src/ui/componentes/BarraLateral.tsx`): marca SuitPay arriba; nav Inicio y Configuración; perfil + logout al pie (FR-005a). Quitar marca del header si aún vive ahí.
  - Sidebar desktop + barra compacta móvil; área de trabajo full-bleed.
- [x] T162 [P] **Ruta Configuración** en `src/routes/configuracion/` (placeholder o panel mínimo según rol). Enlazar desde el sidebar.
  - `src/routes/configuracion.tsx` placeholder.
- [x] T163 [US1] **Tabs del mostrador** Pedido | Cotizaciones | Vecinos | Lista en `src/routes/index.tsx` (o feature dedicada): default tab Pedido; contenido a todo el ancho del área de trabajo (FR-005b). Tab Lista: contenido TBD hasta clarify.
  - `PestanasMostrador.tsx`; placeholders Cotizaciones/Vecinos/Lista.
- [x] T164 [US1] **Default Nota de Venta** en el almacén del pedido / `CabeceraDocumento` (FR-014a): todo pedido nuevo arranca con ese tipo.
  - `src/features/pedido/almacen.ts`: `ESTADO_INICIAL.tipoDocumento = 'nota_venta'`.
- [x] T165 [P] **Migrar primitivas UI a Soft-Pill** en `src/ui/componentes/`: botones/badges/controles `rounded-full`; paneles `rounded-2xl`/`3xl`; bordes solo `border-gray-200`; sin `border-2`/`border-black` ni sombras brutales. Incluye `PapeletaContexto`, `PieTotal`, `CabeceraDocumento`, `EtiquetaSinValor`, etc.
  - Primitivas + Entrada/PieTotal/Cabecera/Papeleta/Etiqueta/Linea/Banda/Sello + estados de emisión.
- [x] T166 **`numeroInicial` en series**: actualizar dominio/esquemas, `src/server/emision/series.ts`, alta administrativa y `data-model.md` ya documentado — inicializar `ultimoNumero = numeroInicial - 1` (FR-031a). Pruebas de que el primer reclamado es el número inicial.
  - Campo en `Serie` + esquema Zod + lectura Firestore; pruebas en `tests/unit/server/series-numero-inicial.test.ts` (origen 0 y 100). Alta administrativa (T083) aún debe exponer el campo en UI.
- [x] T167 [P] **Nueva composición visual** Soft-Pill + sidebar + tabs: producir y aprobar renders que sustituyan `specs/001-mostrador-asistido/assets/comp-*.png` antes de dar por cerrado el pivote de UI.
  - Soft-Pill oficial; retoques iterativos (foco de inputs sobre el borde base, sin outline-offset).
- [x] T168 Completar **T010** apuntando `.firebaserc` / hosting al proyecto `blayblocklabs-antrax` y site `suitpay`; variables públicas de Firebase solo vía env; documentar en quickstart el site.
- [x] T169 Ejecutar **T027** en demo con la API del proveedor (secreto fuera de repo); registrar hallazgos en `specs/001-mostrador-asistido/research.md` y quitar marcas `PENDIENTE DE T027` del adaptador.

**Checkpoint C5**: Soft-Pill/shell/tabs/`numeroInicial`/T027 hechos en código. T167 pendiente de aprobación visual de los renders Soft-Pill.

---

## Phase C6: Converge — Sin Scheduler; reintento manual (2026-07-29)

**Propósito**: materializar la **decisión 10** de `research.md` (producto: sin Cloud Scheduler, sin cola de pendientes, sin documento interno de contingencia).

- [x] T170 [US1] **Proveedor `indisponible`**: en emitir + UI, informar fallo, conservar pedido, permitir **reintento manual** con la misma clave de idempotencia. Retirar flujo de “venta en espera” / recogida de contacto (FR-050 enmendado). Actualizar pruebas T044 y mensajes de `PieTotal`/`estados.tsx`.
- [x] T171 [US1] **`consultarEstadoEmision` bajo demanda**: función de servidor (+ botón en UI de `indeterminado`) que solo llama a `consultarDocumento` y adopta estado. **Nunca emite.** Sustituye T068 programada. Prueba: indeterminado → consultar → aceptado/no encontrado/`requiere_intervencion`.
- [x] T172 [P] [US1] **Retirar artefactos Scheduler/contingencia**: rutas `/api/procesar-pendientes` y `/api/reconciliar`, `TAREAS_SECRETO_*` de env/apphosting si ya no se usan, y dejar de enlazar `contingencia.tsx` en el flujo de emisión. Actualizar `contracts/functions.md` y `data-model.md` (estados `pendiente` de contingencia / índice de barrido programado).

**Checkpoint C6**: US1 ya no depende de Cloud Scheduler; el principio II se sostiene con idempotencia + consulta explícita.

---

## Phase C7: Converge — Borrado duro de cotizaciones (2026-08-07)

**Propósito**: materializar FR-019 / FR-019a (enmienda SpecKit): eliminar cotizaciones en duro —manual con confirmación e implícito al emitir— en lugar de marcar `convertida`. Origen: decisión 11 de `research.md`.

**Dependencias**: Phase 7 (US5) hecha. **Bloquea Phase 10 / US8.**

### Pruebas obligatorias ⚠️

- [x] T173 [P] [US5] Actualizar `tests/emulador/cotizacion-dos-dispositivos.test.ts` y `tests/emulador/cotizacion-transaccion.test.ts`: tras emitir, la cotización **no existe**; el segundo intento recibe `cotizacion_ya_usada`; un fallo de transacción no borra la cotización ni crea comprobante huérfano
- [x] T173a [P] [US5] Prueba de borrado manual en `tests/emulador/cotizacion-eliminar.test.ts`: vendedor autenticado puede borrar pendiente (propia o de otro); comprobantes siguen sin `allow delete`

### Implementación

- [x] T174 [US5] Cambiar `emitirComprobante` en `src/server/emision/emitir.ts` para **borrar** la cotización en la misma transacción (FR-019); renombrar/mapear error a `cotizacion_ya_usada` en `src/server/errores.ts` y contratos
- [x] T175 [US5] Sustituir `src/features/cotizaciones/ya-convertida.tsx` por estado de cotización inexistente/ya usada (sin depender de `comprobanteId` en la cotización)
- [x] T176 [US5] Implementar eliminación en cliente `src/features/cotizaciones/eliminar.ts` + IconButton y diálogo de confirmación en `src/features/cotizaciones/panel.tsx` (FR-019a)
- [x] T177 [US5] Actualizar `firestore.rules` (y pruebas en `tests/emulador/reglas.test.ts`) para `allow delete` de cotizaciones `pendiente`; retirar campos/estados `convertida`/`descartada`/`comprobanteId`/`convertidaEn` del modelo vigente en `src/features/cotizaciones/tipos.ts` y escrituras

**Checkpoint C7**: cotizaciones pendientes se borran a mano (con confirmación) o al emitir; la carrera entre dispositivos sigue cubierta.

---

## Phase C8: Converge — Alta auto-modal, PDF post-emisión, comandos seleccionables, UI (2026-08-09)

**Propósito**: materializar FR-022/023/026 enmendados, FR-054a, FR-047a/b y ajustes Soft-Pill menores. GRE queda en `002-guias-remision`.

### Implementación

- [x] T178 [US3] Tras confirmar DNI/RUC no registrado en cabecera, consultar padrón y abrir `AltaClienteEnContexto` con datos (sin morph «Agregar»); degradar a alta manual si falla (FR-022, FR-026). Archivos: `src/routes/index.tsx`, `src/ui/componentes/CabeceraDocumento.tsx`, `src/features/clientes/*`
- [x] T179 [US1] En `EstadoDeEmision`, usar `archivos.pdf` de la respuesta de emisión para Imprimir / Guardar / Compartir de inmediato (FR-054a). Archivos: `src/features/emision/estados.tsx`, `flujo.ts`, `impresion.ts` / `compartir.ts` según haga falta
- [x] T180 [P] [US9] Ampliar `CATALOGO_DE_COMANDOS` (FR-047b) y mostrar lista seleccionable en modo `/` en `Entrada` (FR-047a). Archivos: `src/features/comandos/pistas.ts`, `src/ui/componentes/Entrada.tsx`
- [x] T181 [P] Icono ojo centrado para ocultar sugerencias en `Entrada`; trash de cotizaciones sin chrome hasta hover rojo suave en `panel.tsx`

**Checkpoint C8**: alta de cliente nuevo sin morph; PDF usable al emitir; `/` lista comandos; UI menor alineada a `design.md`.

---

## Phase C9: Converge — Piso de precio y reutilizar pedido (post reunión gerencia)

**Propósito**: FR-012 enmendado (piso mayorista) y FR-056 / US10 (reutilizar líneas de un comprobante emitido).

### Implementación

- [x] T182 [P] [US1] Piso de precio: dominio + UI en `LineaPedido` (marca en rojo) + bloqueo de Emitir/Guardar en mostrador; validación en servidor al emitir (`precio_bajo_catalogo`). Archivos: `src/domain/totales/calculo.ts`, `src/ui/componentes/LineaPedido.tsx`, `src/routes/index.tsx`, `src/server/emision/emitir.ts`, `src/server/errores.ts`, `src/features/emision/emitir.funciones.ts`
- [x] T183 [US10] «Reutilizar pedido» en detalle de comprobante → `cargarDesdeComprobante` + navegación al mostrador (FR-056). Archivos: `src/features/pedido/almacen.ts`, `src/routes/comprobantes/$comprobanteId.tsx`
- [x] T184 [P] Pruebas de unidad del piso de precio y de rechazo en emisión; actualizar e2e de venta escrita (negociar al alza). Archivos: `tests/unit/domain/totales.test.ts`, `tests/unit/server/emitir-precio-piso.test.ts`, `tests/e2e/venta-escrita.spec.ts`

**Checkpoint C9**: no se emite ni guarda bajo el mayorista; se puede clonar el pedido de un comprobante emitido sin tocarlo.

---

## Phase C10: Converge — US4b resumen, filtros, impresión colaborativa (2026-08-10)

**Propósito**: FR-037a, FR-057…FR-059, FR-056a. Listado bajo demanda, ACL colaborativa, PDF como URL (sin Storage). Inventario/ranking fuera (`003`/`004`).

**Dependencias**: US4 (T101–T106) y reutilizar (T183) hechos.

### Pruebas obligatorias ⚠️

- [x] T185 [P] [US4b] Prueba de ACL colaborativa: listado memoria sin filtro por emisor (`tests/unit/server/listar-comprobantes-filtros.test.ts`); anulación colaborativa cubierta por ACL serverFn sin check de emisor
- [x] T186 [P] [US4b] Prueba de resumen Hoy: anulados no suman (`tests/unit/domain/resumen-comprobantes.test.ts`); Hoy carga completo / rango pagina 20 en serverFn
- [x] T187 [P] [US4b] Prueba rango+cliente (AND) en almacén memoria; UI desactiva Hoy al aplicar rango
- [x] T188 [P] [US4b] Prueba búsqueda serie+número + URL PDF: mapeo/persistencia en `obtenerUrlPdfComprobante`; `imprimirDocumento` no marca error falso por `noopener` (`tests/unit/features/impresion-ventana.test.ts`); toasts sobre modal vía `CapaDeToasts`

### Implementación

- [x] T189 [US4b] Quitar filtro por `vendedorId` del emisor en `listarComprobantes` / `leerComprobante` / `anular` (sesión + rol activo sí). Archivos: `src/features/emision/emitir.funciones.ts`, almacén Firestore, reglas/ACL de serverFn
- [x] T190 [US4b] Extender listado: modos `hoy` \| `rango`, filtro cliente, cursores solo en rango, día America/Lima. Índices en `firestore.indexes.json` + `data-model.md`
- [x] T191 [US4b] Rediseñar `src/routes/comprobantes/index.tsx`: sin lista al montar; controles Hoy / rango / cliente / búsqueda; resumen de ventas en Hoy; Imprimir + Reutilizar por fila
- [x] T192 [US4b] Búsqueda exacta serie+número (UI + `buscarComprobantePorSerieNumero`) con opción Imprimir
- [x] T193 [US4b] Mapear `archivos.pdf` en `src/server/proveedor/*/consultar.ts`; `obtenerUrlPdfComprobante` persiste URL en el doc; cablear Imprimir en lista/detalle
- [x] T194 [P] [US4b] Actualizar copy de la página (consulta/anulación colaborativa; sin “eliminar”)

**Checkpoint C10**: cierre de caja con Hoy; filtros bajo demanda; cualquier vendedor opera sobre cualquier comprobante; PDF por URL.

**Puerta de implementación**: tras C10 en código, **no** implementar `003` hasta cerrar fuente de verdad de stock; `004` puede especificarse completo (empujón diferido) e implementarse con defaults (top 20 por unidades, 7/30 días) cuando se priorice.

---

## Notas

- Las tareas marcadas [P] tocan archivos distintos y no tienen dependencias pendientes.
- La etiqueta [Story] mantiene la trazabilidad hasta la historia de la especificación.
- Cada historia debe poder completarse y probarse de forma independiente.
- Verifica que las pruebas fallan antes de implementar.
- Confirma en cada punto de control antes de seguir.
- **Volcado 5**: no se tocó `src/` en la enmienda documental; T160–T169 son el backlog de converge.
- **2026-08-09**: guía de remisión → `specs/002-guias-remision/`; T178–T181 son el backlog de esta enmienda.
- **2026-08-10**: US4b → T185–T194; inventario → `003`; ranking → `004`.
