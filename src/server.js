'use strict';
const { crearApp } = require('./app');

const PUERTO = process.env.PORT || 3000;

crearApp()
  .then((app) => app.listen(PUERTO, () => console.log(`Puente Gamarra escuchando en el puerto ${PUERTO}`)))
  .catch((e) => {
    console.error('No se pudo iniciar la aplicación:', e.message);
    process.exit(1);
  });
