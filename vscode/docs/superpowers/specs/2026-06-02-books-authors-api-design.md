# Design: Books & Authors REST API

**Date:** 2026-06-02

## Context

A REST API zur Verwaltung von Büchern und Autoren. Autoren und Bücher sind separate Ressourcen; ein Buch referenziert seinen Autor per `authorId` (MongoDB-Referenz). Beide Ressourcen unterstützen vollständiges CRUD mit Pagination und Suche.

---

## Tech Stack

| Komponente | Entscheidung |
|---|---|
| Runtime | Node 24 mit `--experimental-strip-types` (kein Build-Step) |
| Sprache | TypeScript 6 |
| Framework | Express 5 |
| Datenbank | MongoDB via Mongoose |
| Validierung | Zod |
| Env-Vars | Node 24 `--env-file=.env` (kein dotenv) |

---

## Projektstruktur

```
src/
  app.ts                    # Express-Setup, Middleware, Router-Mounting
  server.ts                 # Einstiegspunkt, MongoDB-Verbindung
  routes/
    authors.routes.ts
    books.routes.ts
  models/
    author.model.ts         # Mongoose Schema + Model (keine Klassen)
    book.model.ts
  controllers/
    authors.controller.ts   # Request-Handler-Funktionen
    books.controller.ts
  schemas/
    author.schema.ts        # Zod-Schemas für Validierung
    book.schema.ts
  middleware/
    validate.ts             # Zod-Validierungs-Middleware
    errorHandler.ts         # Globaler Error-Handler (RFC 7807)
.env
package.json
tsconfig.json
```

---

## Datenmodelle

### Author

| Feld | Typ | Pflicht |
|---|---|---|
| `_id` | ObjectId | auto |
| `name` | string | ja |
| `bio` | string | nein |
| `birthYear` | number | nein |
| `createdAt` / `updatedAt` | Date | auto (timestamps) |

### Book

| Feld | Typ | Pflicht |
|---|---|---|
| `_id` | ObjectId | auto |
| `title` | string | ja |
| `authorId` | ObjectId (ref: Author) | ja |
| `isbn` | string | nein |
| `publishedYear` | number | nein |
| `genre` | string | nein |
| `description` | string | nein |
| `createdAt` / `updatedAt` | Date | auto (timestamps) |

---

## API-Endpunkte

### Authors

| Method | Path | Beschreibung |
|---|---|---|
| GET | `/authors` | Liste mit Pagination + Suche nach `name` |
| GET | `/authors/:id` | Einzelner Author |
| POST | `/authors` | Anlegen |
| PUT | `/authors/:id` | Vollständiges Update |
| DELETE | `/authors/:id` | Löschen |

### Books

| Method | Path | Beschreibung |
|---|---|---|
| GET | `/books` | Liste mit Pagination + Suche nach `title`, `genre` |
| GET | `/books/:id` | Einzelnes Buch |
| POST | `/books` | Anlegen |
| PUT | `/books/:id` | Vollständiges Update |
| DELETE | `/books/:id` | Löschen |

### Pagination Query Params

Beide `GET`-Listen-Endpunkte akzeptieren:
- `page` (default: 1)
- `limit` (default: 10)

### Pagination Response

```json
{
  "data": [...],
  "total": 42,
  "page": 1,
  "limit": 10,
  "totalPages": 5
}
```

---

## Fehlerformat (RFC 7807)

Alle Fehler folgen dem Problem Details Standard:

```json
{
  "type": "/errors/not-found",
  "title": "Not Found",
  "status": 404,
  "detail": "Author with id '64abc...' not found"
}
```

Zod-Validierungsfehler (422):

```json
{
  "type": "/errors/validation",
  "title": "Unprocessable Entity",
  "status": 422,
  "detail": "Request body validation failed",
  "errors": [
    { "path": "name", "message": "Required" }
  ]
}
```

---

## Validierung (Zod)

Für jede Ressource gibt es zwei Schemas:
- **createSchema** — alle required Felder plus optionale
- **updateSchema** — alle Felder optional (via `.partial()`)

Die `validate`-Middleware nimmt ein Zod-Schema, validiert `req.body` und gibt bei Fehler direkt eine RFC-7807-Antwort zurück.

---

## Fehlerbehandlung

- `validate.ts` — Zod-Fehler → 422
- `errorHandler.ts` — Globaler Express-Error-Handler:
  - Mongoose `CastError` (ungültige ObjectId) → 400
  - Mongoose `ValidationError` → 422
  - Bekannte AppError-Klasse → Status aus Error
  - Sonstige → 500

---

## Node 24 Start-Konfiguration

```json
// package.json scripts
{
  "start": "node --experimental-strip-types --env-file=.env src/server.ts",
  "dev": "node --experimental-strip-types --watch --env-file=.env src/server.ts"
}
```

---

## Verifikation

1. `npm run dev` starten → Server läuft auf konfiguriertem Port
2. MongoDB-Verbindung erfolgreich (Log-Ausgabe)
3. `POST /authors` mit gültigem Body → 201 mit Author-Objekt
4. `POST /authors` mit fehlendem `name` → 422 mit RFC-7807-Fehler
5. `GET /authors?page=1&limit=5&name=Goethe` → paginiertes Ergebnis
6. `GET /authors/:invalidId` → 400 (CastError)
7. `GET /authors/:validButUnknownId` → 404
8. Gleiches für `/books`
