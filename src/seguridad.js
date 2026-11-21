'use strict';
// Autenticación (bcrypt + JWT) y autorización por rol.
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

function obtenerSecreto() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET es obligatorio en producción');
  }
  // Solo desarrollo y pruebas: secreto aleatorio por ejecución, nunca escrito en el código.
  return crypto.randomBytes(32).toString('hex');
}

const SECRETO = obtenerSecreto();

const hashear = (texto) => bcrypt.hash(texto, 10);
const comparar = (texto, hash) => bcrypt.compare(texto, hash);
const firmarToken = (usuario) =>
  jwt.sign({ sub: usuario.id, rol: usuario.rol }, SECRETO, { expiresIn: '2h', algorithm: 'HS256' });

function autenticar(req, res, next) {
  const [tipo, token] = (req.headers.authorization || '').split(' ');
  if (tipo !== 'Bearer' || !token) return res.status(401).json({ error: 'Debes iniciar sesión' });
  try {
    const datos = jwt.verify(token, SECRETO, { algorithms: ['HS256'] });
    req.usuario = { id: datos.sub, rol: datos.rol };
    return next();
  } catch {
    return res.status(401).json({ error: 'Sesión inválida o vencida' });
  }
}

const autorizar = (...roles) => (req, res, next) =>
  roles.includes(req.usuario.rol)
    ? next()
    : res.status(403).json({ error: 'No tienes permiso para ver esta página' });

module.exports = { hashear, comparar, firmarToken, autenticar, autorizar };
