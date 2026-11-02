# Ciclo de vida de medios de captura

Los originales de dictado y fotografía viven en Cloud Storage (`capturas/{uid}/{id}.{ext}`).

## Por qué caducan solos

Acumular audios pequeños todos los días —que no tienen uso más allá del día civil en Lima— consumiría más recursos de los necesarios. La gerencia exige limpieza automática. La UI **no** ofrece eliminar grabaciones: el vendedor reproduce las de hoy; el bucket caduca el resto.

## Lifecycle nativo del bucket

Fuente: `storage.lifecycle.json`. Lo ejecuta GCS con privilegios de infraestructura, **no** las reglas de Storage del cliente. `allow delete` en `storage.rules` sigue en `false`: un cliente no puede borrar la traza.

Aplicar al bucket de Storage (GCS):

```bash
gcloud storage buckets update gs://BUCKET --lifecycle-file=storage.lifecycle.json
```

Comprobar:

```bash
gcloud storage buckets describe gs://BUCKET --format="json(lifecycle)"
```

| Medio | Sufijos | Edad |
|-------|---------|------|
| Audio | `.webm` `.mp4` `.m4a` `.ogg` | 1 día |
| Fotografía | `.jpg` `.jpeg` `.png` `.webp` | 7 días |

El emulador no ejecuta lifecycle. En local el dropdown ya filtra al día actual (`America/Lima`).

## Firestore: lista de requerimiento

Un documento por vendedor y día laboral: `listasRequerimiento/{uid}/diasLista/{AAAA-MM-DD}`, con campo `caducaEn` (7 días desde la última escritura). El id de subcolección es `diasLista` (no `dias`) para que el TTL no cubra otros grupos de colecciones homónimos.

Habilitar TTL sobre el grupo de subcolecciones `diasLista`:

```bash
gcloud firestore fields ttls update caducaEn \
  --collection-group=diasLista \
  --enable-ttl
```

El cliente también ignora documentos con `caducaEn` vencido. Escribir el campo no borra nada: hace falta la política de TTL del proyecto, y el borrado puede tardar hasta un día después del vencimiento.

## Firestore: capturas

`capturas/{id}` es la propuesta de foto, audio o PDF. Nadie la vuelve a leer: el pedido y la cotización ya guardan lo que sirvió. El PDF puede traer DNI o RUC. El archivo en Storage caduca por su lado (audio 1 día, foto 7). El documento lleva `caducaEn` a **7 días** desde la escritura.

```bash
gcloud firestore fields ttls update caducaEn --collection-group=capturas --enable-ttl
```

## Firestore: lotes de aprendizaje

Un documento por día civil Lima: `lotesAprendizaje/{AAAA-MM-DD}`, con campo `caducaEn` (3 días). El id de colección es `lotesAprendizaje` (no `lotes`) para que el TTL no cubra otros grupos homónimos. La memoria consolidada vive en `aprendizaje/memoria` y **no** caduca.

`revisionesAprendizaje` es la cola del lote, no una pantalla. Al encolarse lleva `caducaEn` a **14 días**, para que una semana sin abrir la app no pierda el par. Al procesarse, el campo pasa a **+3 días**: lo aprendido ya está en la memoria. No guarda el número de documento del cliente. La consulta de pendientes acota `diaLima` a esa ventana de 14 días.

`sesionesEntrenamiento/{id}` es la auditoría de un par confirmado (cobertura, uid, modelo). Lleva `caducaEn` a 3 días. No hay pantalla que la liste.

El campo sin la política de TTL no borra el documento. Cada grupo de colección se habilita aparte:

```bash
gcloud firestore fields ttls update caducaEn --collection-group=lotesAprendizaje --enable-ttl
gcloud firestore fields ttls update caducaEn --collection-group=revisionesAprendizaje --enable-ttl
gcloud firestore fields ttls update caducaEn --collection-group=sesionesEntrenamiento --enable-ttl
```

El admin ignora lotes vencidos (el borrado de Firestore no es inmediato).

Documentos viejos sin `caducaEn` no entran en la política. Una pasada:

```bash
node scripts/caducar-trazas.mjs
```

## WhatsApp de la captura del vecino

`https://wa.me/{telefono}` abre el chat. No admite adjuntar PNG. SuitPay copia la imagen al portapapeles y abre el chat para que el vendedor la pegue.
