'use strict';
// HU-03: el administrador asigna roles. Solo accesible con rol admin.
const express = require('express');
const { autenticar, autorizar } = require('../seguridad');

const ROLES = ['comerciante', 'fiscalizador', 'admin'];

module.exports = (db) => {
  const r = express.Router();
  r.use(autenticar, autorizar('admin'));

  r.get('/', (req, res) => res.json(db.todos('SELECT id, dni, rol, consentimiento_en FROM usuarios ORDER BY id')));

  r.patch('/:id/rol', (req, res) => {
    const { rol } = req.body || {};
    if (!ROLES.includes(rol)) return res.status(400).json({ error: `Rol inválido. Usa: ${ROLES.join(', ')}` });
    const u = db.uno('SELECT id FROM usuarios WHERE id = ?', [Number(req.params.id)]);
    if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });
    db.ejecutar('UPDATE usuarios SET rol = ? WHERE id = ?', [rol, u.id]);
    return res.json({ id: u.id, rol });
  });

  return r;
};
