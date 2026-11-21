'use strict';
// Base de datos SQLite embebida (sql.js). Todas las consultas usan parámetros (?) para evitar inyección SQL.
const initSqlJs = require('sql.js');

const ESQUEMA = `
CREATE TABLE usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dni TEXT NOT NULL UNIQUE,
  celular TEXT NOT NULL,
  hash TEXT NOT NULL,
  rol TEXT NOT NULL DEFAULT 'comerciante' CHECK (rol IN ('comerciante', 'fiscalizador', 'admin')),
  consentimiento_en TEXT NOT NULL,
  intentos_fallidos INTEGER NOT NULL DEFAULT 0,
  bloqueado_hasta INTEGER
);
CREATE TABLE negocios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL UNIQUE REFERENCES usuarios(id),
  nombre TEXT NOT NULL,
  rubro TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('galeria', 'ambulante')),
  galeria TEXT,
  puesto TEXT,
  zona TEXT,
  ruc TEXT,
  verificado INTEGER NOT NULL DEFAULT 0,
  nivel TEXT,
  respuestas TEXT,
  activo INTEGER NOT NULL DEFAULT 1,
  creado_en TEXT NOT NULL
);`;

let SQL;

async function crearBaseDeDatos() {
  SQL = SQL || (await initSqlJs());
  const db = new SQL.Database();
  db.run('PRAGMA foreign_keys = ON;');
  db.exec(ESQUEMA);
  const repo = {
    todos(sql, params = []) {
      const st = db.prepare(sql);
      st.bind(params);
      const filas = [];
      while (st.step()) filas.push(st.getAsObject());
      st.free();
      return filas;
    },
    uno(sql, params = []) {
      return repo.todos(sql, params)[0];
    },
    ejecutar(sql, params = []) {
      db.run(sql, params);
      return db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0];
    },
  };
  return repo;
}

module.exports = { crearBaseDeDatos };
