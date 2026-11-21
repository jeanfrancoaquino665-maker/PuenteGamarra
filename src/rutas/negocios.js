'use strict';
// HU-05 (registro del negocio), HU-09/HU-10 (diagnóstico y ruta), HU-11 (RUC e insignia)
// y HU-14/HU-15 (vitrina pública sin datos personales).
const express = require('express');
const { autenticar, autorizar } = require('../seguridad');
const { validarRuc, generarRuta } = require('../dominio');
const { consultarRuc } = require('../consultaRuc');

const CAMPOS_PUBLICOS = 'id, nombre, rubro, tipo, galeria, puesto, zona, verificado';
const RUBROS = ['Jeans', 'Polos', 'Casacas', 'Ropa de bebé', 'Ropa deportiva', 'Telas', 'Uniformes', 'Accesorios', 'Otros'];
const publico = (n) => ({ ...n, verificado: n.verificado === 1, tipo: n.tipo === 'galeria' ? 'Galería' : 'Ambulante' });

module.exports = (db) => {
  const r = express.Router();
  const negocioDe = (usuarioId) => db.uno('SELECT * FROM negocios WHERE usuario_id = ?', [usuarioId]);

  r.get('/rubros', (req, res) => res.json(RUBROS));

  // Vitrina pública: no requiere cuenta y nunca devuelve DNI ni celular.
  r.get('/', (req, res) => {
    const q = `%${String(req.query.q || '').trim().slice(0, 60)}%`;
    const filas = db.todos(
      `SELECT ${CAMPOS_PUBLICOS} FROM negocios
       WHERE activo = 1 AND (nombre LIKE ? OR rubro LIKE ? OR IFNULL(galeria, '') LIKE ? OR IFNULL(zona, '') LIKE ?)
       ORDER BY verificado DESC, nombre LIMIT 50`,
      [q, q, q, q],
    );
    res.json(filas.map(publico));
  });

  r.get('/mio', autenticar, (req, res) => {
    const n = negocioDe(req.usuario.id);
    if (!n) return res.status(404).json({ error: 'Aún no registras tu negocio' });
    return res.json({
      ...publico({ id: n.id, nombre: n.nombre, rubro: n.rubro, tipo: n.tipo, galeria: n.galeria, puesto: n.puesto, zona: n.zona, verificado: n.verificado }),
      ruc: n.ruc,
      nivel: n.nivel,
      estado: n.verificado ? 'Verificado' : 'No verificado',
      ruta: n.respuestas ? generarRuta(JSON.parse(n.respuestas)) : null,
    });
  });

  r.post('/', autenticar, autorizar('comerciante'), (req, res) => {
    const { nombre, rubro, tipo, galeria, puesto, zona } = req.body || {};
    const errores = {};
    if (!nombre || !String(nombre).trim()) errores.nombre = 'El nombre comercial es obligatorio';
    if (!RUBROS.includes(rubro)) errores.rubro = 'Elige un rubro de la lista';
    if (!['galeria', 'ambulante'].includes(tipo)) errores.tipo = 'El tipo debe ser galería o ambulante';
    if (tipo === 'galeria' && (!galeria || !puesto)) errores.galeria = 'Indica la galería y el número de puesto';
    if (tipo === 'ambulante' && !zona) errores.zona = 'Indica la calle o zona donde vendes';
    if (Object.keys(errores).length) return res.status(400).json({ error: 'Completa los campos obligatorios', errores });
    if (negocioDe(req.usuario.id)) return res.status(409).json({ error: 'Ya registraste un negocio' });
    const esGaleria = tipo === 'galeria';
    const id = db.ejecutar(
      'INSERT INTO negocios (usuario_id, nombre, rubro, tipo, galeria, puesto, zona, creado_en) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [req.usuario.id, String(nombre).trim().slice(0, 80), rubro, tipo,
        esGaleria ? String(galeria).slice(0, 80) : null, esGaleria ? String(puesto).slice(0, 20) : null,
        esGaleria ? null : String(zona).slice(0, 120), new Date().toISOString()],
    );
    return res.status(201).json({ id, estado: 'No verificado' });
  });

  r.post('/mio/diagnostico', autenticar, autorizar('comerciante'), (req, res) => {
    const n = negocioDe(req.usuario.id);
    if (!n) return res.status(404).json({ error: 'Primero registra tu negocio' });
    const b = req.body || {};
    const respuestas = {
      tieneRuc: b.tieneRuc === true,
      emiteComprobantes: b.emiteComprobantes === true,
      tieneLicencia: b.tieneLicencia === true,
      tieneTrabajadores: b.tieneTrabajadores === true,
      trabajadoresEnPlanilla: b.trabajadoresEnPlanilla === true,
      ventasMensuales: Math.max(0, Number(b.ventasMensuales) || 0),
    };
    const ruta = generarRuta(respuestas);
    db.ejecutar('UPDATE negocios SET respuestas = ?, nivel = ? WHERE id = ?', [JSON.stringify(respuestas), ruta.nivel, n.id]);
    return res.json(ruta);
  });

  r.post('/mio/verificar-ruc', autenticar, autorizar('comerciante'), async (req, res) => {
    const n = negocioDe(req.usuario.id);
    if (!n) return res.status(404).json({ error: 'Primero registra tu negocio' });
    const ruc = String((req.body || {}).ruc || '');
    if (!validarRuc(ruc)) return res.status(400).json({ error: 'El RUC no es válido: revisa los 11 dígitos' });
    let datos;
    try {
      datos = await consultarRuc(ruc);
    } catch {
      return res.status(503).json({ error: 'Servicio no disponible, intenta más tarde' });
    }
    if (datos.estado !== 'ACTIVO' || datos.condicion !== 'HABIDO') {
      return res.status(422).json({ error: `No se otorgó la insignia: el RUC figura como ${datos.estado} / ${datos.condicion}` });
    }
    db.ejecutar('UPDATE negocios SET ruc = ?, verificado = 1 WHERE id = ?', [ruc, n.id]);
    return res.json({ verificado: true, insignia: 'Negocio verificado', razonSocial: datos.razonSocial });
  });

  r.get('/:id', (req, res) => {
    const n = db.uno(`SELECT ${CAMPOS_PUBLICOS} FROM negocios WHERE id = ? AND activo = 1`, [Number(req.params.id)]);
    if (!n) return res.status(404).json({ error: 'Este negocio no está disponible' });
    return res.json(publico(n));
  });

  return r;
};
