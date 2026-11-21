'use strict';
const crypto = require('crypto');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const { crearBaseDeDatos } = require('./db');
const { hashear } = require('./seguridad');
const { version } = require('../package.json');

const NEGOCIOS_DEMO = [
  ['Jeans Ruta Norte', 'Jeans', 'galeria', 'Galería Central', '214', null, 1],
  ['Casacas Huallaga', 'Casacas', 'galeria', 'Galería Los Andes', '512', null, 1],
  ['Polos Don Chema', 'Polos', 'ambulante', null, null, 'Jr. Gamarra, cuadra 6', 0],
  ['Bebé Feliz', 'Ropa de bebé', 'ambulante', null, null, 'Jr. Humboldt, cuadra 12', 0],
];

async function cargarDatosIniciales(db) {
  const ahora = new Date().toISOString();
  if (process.env.ADMIN_DNI && process.env.ADMIN_PASSWORD) {
    db.ejecutar('INSERT INTO usuarios (dni, celular, hash, rol, consentimiento_en) VALUES (?, ?, ?, ?, ?)',
      [process.env.ADMIN_DNI, '900000000', await hashear(process.env.ADMIN_PASSWORD), 'admin', ahora]);
  }
  if (process.env.DATOS_DEMO === 'no') return;
  for (const [i, [nombre, rubro, tipo, galeria, puesto, zona, verificado]] of NEGOCIOS_DEMO.entries()) {
    const usuarioId = db.ejecutar('INSERT INTO usuarios (dni, celular, hash, consentimiento_en) VALUES (?, ?, ?, ?)',
      [`7000000${i}`, '900000000', await hashear(crypto.randomBytes(16).toString('hex')), ahora]);
    db.ejecutar('INSERT INTO negocios (usuario_id, nombre, rubro, tipo, galeria, puesto, zona, verificado, creado_en) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [usuarioId, nombre, rubro, tipo, galeria, puesto, zona, verificado, ahora]);
  }
}

async function crearApp() {
  const db = await crearBaseDeDatos();
  await cargarDatosIniciales(db);

  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(express.json({ limit: '10kb' }));

  app.get('/api/salud', (req, res) => res.json({ estado: 'ok', servicio: 'puente-gamarra', version }));
  app.use('/api/auth', require('./rutas/auth')(db));
  app.use('/api/usuarios', require('./rutas/admin')(db));
  app.use('/api/negocios', require('./rutas/negocios')(db));
  app.use('/api', (req, res) => res.status(404).json({ error: 'Recurso no encontrado' }));
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // Manejo de errores sin exponer detalles internos.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido' });
    console.error(err.message);
    return res.status(500).json({ error: 'Error interno' });
  });

  app.locals.db = db;
  return app;
}

module.exports = { crearApp };
