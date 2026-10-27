// Migraciones versionadas. Cada una se aplica una sola vez y queda anotada en schema_migrations.
export interface Migration {
  version: number;
  nombre: string;
  sql: string;
  /** Reconstruye una tabla que es padre de una foreign key: SQLite exige desactivar su chequeo fuera de la transacción. */
  requiereForeignKeysOff?: boolean;
}

export const migrations: Migration[] = [
  {
    version: 1,
    nombre: 'esquema inicial',
    sql: `
      CREATE TABLE users (
        id            INTEGER PRIMARY KEY,
        nombre        TEXT NOT NULL,
        email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        rol           TEXT NOT NULL CHECK (rol IN ('mayor', 'familiar')),
        creado_en     TEXT NOT NULL
      );

      CREATE TABLE sessions (
        id         INTEGER PRIMARY KEY,
        token_hash TEXT NOT NULL UNIQUE,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        creado_en  TEXT NOT NULL,
        expira_en  TEXT NOT NULL
      );
      CREATE INDEX idx_sessions_user ON sessions(user_id);

      -- Perfil de medicación: lo que se consulta. Separado de la identidad que inicia sesión.
      CREATE TABLE perfiles (
        id              INTEGER PRIMARY KEY,
        titular_user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        nombre          TEXT NOT NULL,
        plan_desde      TEXT NOT NULL,
        creado_en       TEXT NOT NULL
      );

      CREATE TABLE vinculos (
        id               INTEGER PRIMARY KEY,
        perfil_id        INTEGER NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
        familiar_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        creado_en        TEXT NOT NULL,
        UNIQUE (perfil_id, familiar_user_id)
      );
      CREATE INDEX idx_vinculos_familiar ON vinculos(familiar_user_id);

      CREATE TABLE codigos_vinculacion (
        id         INTEGER PRIMARY KEY,
        perfil_id  INTEGER NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
        codigo     TEXT NOT NULL UNIQUE,
        creado_en  TEXT NOT NULL,
        expira_en  TEXT NOT NULL,
        usado_en   TEXT,
        usado_por  INTEGER REFERENCES users(id),
        anulado_en TEXT
      );

      CREATE TABLE intentos_vinculacion (
        id        INTEGER PRIMARY KEY,
        user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        exito     INTEGER NOT NULL,
        creado_en TEXT NOT NULL
      );

      CREATE TABLE bloques (
        id             INTEGER PRIMARY KEY,
        perfil_id      INTEGER NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
        clave          TEXT NOT NULL CHECK (clave IN ('manana', 'noche')),
        inicio         TEXT NOT NULL,
        fin            TEXT NOT NULL,
        actualizado_en TEXT NOT NULL,
        UNIQUE (perfil_id, clave),
        CHECK (fin > inicio)
      );

      CREATE TABLE medicamentos (
        id                 INTEGER PRIMARY KEY,
        perfil_id          INTEGER NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
        bloque_clave       TEXT NOT NULL CHECK (bloque_clave IN ('manana', 'noche')),
        nombre             TEXT NOT NULL,
        nombre_normalizado TEXT NOT NULL,
        dosis              TEXT NOT NULL,
        etiqueta           TEXT,
        orden              INTEGER NOT NULL,
        activo             INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
        creado_en          TEXT NOT NULL,
        actualizado_en     TEXT NOT NULL,
        desactivado_en     TEXT,
        CHECK (etiqueta IS NULL OR length(etiqueta) <= 25)
      );
      -- Repetido solo dentro del mismo bloque y entre medicamentos activos.
      CREATE UNIQUE INDEX uq_medicamento_bloque
        ON medicamentos(perfil_id, bloque_clave, nombre_normalizado) WHERE activo = 1;

      -- Días cuyo plan ya quedó armado (también los días sin medicamentos).
      CREATE TABLE plan_dias (
        perfil_id INTEGER NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
        fecha     TEXT NOT NULL,
        PRIMARY KEY (perfil_id, fecha)
      );

      -- Copia de cómo era cada medicamento ese día: el historial no cambia si luego se edita.
      CREATE TABLE plan_items (
        id             INTEGER PRIMARY KEY,
        perfil_id      INTEGER NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
        fecha          TEXT NOT NULL,
        medicamento_id INTEGER NOT NULL REFERENCES medicamentos(id),
        bloque_clave   TEXT NOT NULL CHECK (bloque_clave IN ('manana', 'noche')),
        bloque_inicio  TEXT NOT NULL,
        bloque_fin     TEXT NOT NULL,
        nombre         TEXT NOT NULL,
        dosis          TEXT NOT NULL,
        etiqueta       TEXT,
        orden          INTEGER NOT NULL,
        retirado       INTEGER NOT NULL DEFAULT 0 CHECK (retirado IN (0, 1)),
        UNIQUE (fecha, medicamento_id)
      );
      CREATE INDEX idx_plan_items_perfil_fecha ON plan_items(perfil_id, fecha);

      CREATE TABLE tomas (
        id             INTEGER PRIMARY KEY,
        plan_item_id   INTEGER NOT NULL REFERENCES plan_items(id),
        perfil_id      INTEGER NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
        estado         TEXT NOT NULL CHECK (estado IN ('tomado', 'no_tomado')),
        tarde          INTEGER NOT NULL DEFAULT 0 CHECK (tarde IN (0, 1)),
        hora           TEXT NOT NULL,
        registrado_en  TEXT NOT NULL,
        registrado_por INTEGER NOT NULL REFERENCES users(id),
        origen         TEXT NOT NULL CHECK (origen IN ('individual', 'bloque', 'confirmar_bloque')),
        anulado_en     TEXT,
        anulado_por    INTEGER REFERENCES users(id)
      );
      -- Un solo resultado vigente por pastilla y día: evita duplicados por doble clic o reenvío.
      CREATE UNIQUE INDEX uq_toma_vigente ON tomas(plan_item_id) WHERE anulado_en IS NULL;
      CREATE INDEX idx_tomas_perfil ON tomas(perfil_id);

      CREATE TABLE eventos (
        id          INTEGER PRIMARY KEY,
        perfil_id   INTEGER NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
        user_id     INTEGER REFERENCES users(id),
        fecha       TEXT NOT NULL,
        tipo        TEXT NOT NULL,
        descripcion TEXT NOT NULL,
        creado_en   TEXT NOT NULL
      );
      CREATE INDEX idx_eventos_perfil_fecha ON eventos(perfil_id, fecha);

      CREATE TABLE avisos_mostrados (
        perfil_id    INTEGER NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
        fecha        TEXT NOT NULL,
        bloque_clave TEXT NOT NULL,
        numero       INTEGER NOT NULL CHECK (numero BETWEEN 1 AND 3),
        mostrado_en  TEXT NOT NULL,
        PRIMARY KEY (perfil_id, fecha, bloque_clave, numero)
      );
    `,
  },
  {
    version: 2,
    nombre: 'etiqueta de medicamento hasta 50 caracteres',
    requiereForeignKeysOff: true,
    sql: `
      CREATE TABLE medicamentos_nuevo (
        id                 INTEGER PRIMARY KEY,
        perfil_id          INTEGER NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
        bloque_clave       TEXT NOT NULL CHECK (bloque_clave IN ('manana', 'noche')),
        nombre             TEXT NOT NULL,
        nombre_normalizado TEXT NOT NULL,
        dosis              TEXT NOT NULL,
        etiqueta           TEXT,
        orden              INTEGER NOT NULL,
        activo             INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
        creado_en          TEXT NOT NULL,
        actualizado_en     TEXT NOT NULL,
        desactivado_en     TEXT,
        CHECK (etiqueta IS NULL OR length(etiqueta) <= 50)
      );
      INSERT INTO medicamentos_nuevo SELECT * FROM medicamentos;
      DROP TABLE medicamentos;
      ALTER TABLE medicamentos_nuevo RENAME TO medicamentos;
      CREATE UNIQUE INDEX uq_medicamento_bloque
        ON medicamentos(perfil_id, bloque_clave, nombre_normalizado) WHERE activo = 1;
    `,
  },
  {
    version: 3,
    nombre: 'etiqueta de medicamento hasta 35 caracteres',
    requiereForeignKeysOff: true,
    sql: `
      UPDATE medicamentos SET etiqueta = substr(etiqueta, 1, 35)
        WHERE etiqueta IS NOT NULL AND length(etiqueta) > 35;
      CREATE TABLE medicamentos_nuevo (
        id                 INTEGER PRIMARY KEY,
        perfil_id          INTEGER NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
        bloque_clave       TEXT NOT NULL CHECK (bloque_clave IN ('manana', 'noche')),
        nombre             TEXT NOT NULL,
        nombre_normalizado TEXT NOT NULL,
        dosis              TEXT NOT NULL,
        etiqueta           TEXT,
        orden              INTEGER NOT NULL,
        activo             INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
        creado_en          TEXT NOT NULL,
        actualizado_en     TEXT NOT NULL,
        desactivado_en     TEXT,
        CHECK (etiqueta IS NULL OR length(etiqueta) <= 35)
      );
      INSERT INTO medicamentos_nuevo SELECT * FROM medicamentos;
      DROP TABLE medicamentos;
      ALTER TABLE medicamentos_nuevo RENAME TO medicamentos;
      CREATE UNIQUE INDEX uq_medicamento_bloque
        ON medicamentos(perfil_id, bloque_clave, nombre_normalizado) WHERE activo = 1;
    `,
  },
];
