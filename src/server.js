'use strict';
// Versión inicial (Sprint 0): servidor mínimo para validar el despliegue en la nube.
const express = require('express');

const app = express();
app.get('/api/salud', (req, res) => res.json({ estado: 'ok', servicio: 'puente-gamarra' }));
app.get('/', (req, res) => res.send('Puente Gamarra: en construcción'));
app.listen(process.env.PORT || 3000);
