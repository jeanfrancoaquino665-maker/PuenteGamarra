'use strict';
// HU-01 (registro), HU-04 (consentimiento) y HU-02 (inicio de sesión con bloqueo por intentos).
const express = require('express');
const rateLimit = require('express-rate-limit');
const { hashear, comparar, firmarToken } = require('../seguridad');
const { validarDni, validarCelular, validarPassword } = require('../dominio');

const MAX_INTENTOS = 5;
const BLOQUEO_MS = 15 * 60 * 1000;

module.exports = (db) => {
  const r = express.Router();
  r.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: 'draft-7', legacyHeaders: false }));

  r.post('/registro', async (req, res) => {
    const { dni, celular, password, aceptaPrivacidad } = req.body || {};
    const errores = {};
    if (!validarDni(dni)) errores.dni = 'El DNI debe tener 8 dígitos';
    if (!validarCelular(celular)) errores.celular = 'El celular debe tener 9 dígitos y empezar con 9';
    if (!validarPassword(password)) errores.password = 'La contraseña debe tener al menos 8 caracteres, con letras y números';
    if (Object.keys(errores).length) return res.status(400).json({ error: 'Datos inválidos', errores });
    if (aceptaPrivacidad !== true) {
      return res.status(400).json({ error: 'Debes aceptar la política de privacidad para registrarte' });
    }
    if (db.uno('SELECT id FROM usuarios WHERE dni = ?', [dni])) {
      return res.status(409).json({ error: 'Ya existe una cuenta con este DNI' });
    }
    const id = db.ejecutar(
      'INSERT INTO usuarios (dni, celular, hash, rol, consentimiento_en) VALUES (?, ?, ?, ?, ?)',
      [dni, celular, await hashear(password), 'comerciante', new Date().toISOString()],
    );
    return res.status(201).json({ id, rol: 'comerciante' });
  });

  r.post('/login', async (req, res) => {
    const { dni, password } = req.body || {};
    const u = validarDni(dni) ? db.uno('SELECT * FROM usuarios WHERE dni = ?', [dni]) : undefined;
    if (u && u.bloqueado_hasta && u.bloqueado_hasta > Date.now()) {
      return res.status(423).json({ error: 'Cuenta bloqueada temporalmente por intentos fallidos. Intenta en 15 minutos.' });
    }
    if (!u || !(await comparar(String(password || ''), u.hash))) {
      if (u) {
        const intentos = u.intentos_fallidos + 1;
        const bloquear = intentos >= MAX_INTENTOS;
        db.ejecutar('UPDATE usuarios SET intentos_fallidos = ?, bloqueado_hasta = ? WHERE id = ?',
          [bloquear ? 0 : intentos, bloquear ? Date.now() + BLOQUEO_MS : null, u.id]);
      }
      return res.status(401).json({ error: 'DNI o contraseña incorrectos' });
    }
    db.ejecutar('UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = ?', [u.id]);
    return res.json({ token: firmarToken(u), rol: u.rol });
  });

  return r;
};
