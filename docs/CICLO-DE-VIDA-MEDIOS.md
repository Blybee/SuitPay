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

El cliente también ignora documentos con `caducaEn` vencido (el TTL de Firestore puede tardar en borrar).

## WhatsApp de la captura del vecino

`https://wa.me/{telefono}` abre el chat. No admite adjuntar PNG. SuitPay copia la imagen al portapapeles y abre el chat para que el vendedor la pegue.
