'use strict';
// Reglas de negocio puras (sin dependencias): validaciones, diagnóstico y ruta de formalización.

const FACTORES_RUC = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
const PREFIJOS_RUC = ['10', '15', '16', '17', '20'];

// Valida el RUC con el algoritmo de dígito verificador (módulo 11) de la SUNAT.
function validarRuc(ruc) {
  const texto = String(ruc || '');
  if (!/^\d{11}$/.test(texto) || !PREFIJOS_RUC.includes(texto.slice(0, 2))) return false;
  const d = texto.split('').map(Number);
  const suma = FACTORES_RUC.reduce((acc, factor, i) => acc + factor * d[i], 0);
  let verificador = 11 - (suma % 11);
  if (verificador === 10) verificador = 0;
  if (verificador === 11) verificador = 1;
  return verificador === d[10];
}

const validarDni = (dni) => /^\d{8}$/.test(String(dni || ''));
const validarCelular = (celular) => /^9\d{8}$/.test(String(celular || ''));
const validarPassword = (p) => typeof p === 'string' && p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p);

function pasosCumplidos(r) {
  return [!!r.tieneRuc, !!r.emiteComprobantes, !!r.tieneLicencia, !r.tieneTrabajadores || !!r.trabajadoresEnPlanilla];
}

function calcularNivel(r) {
  const cumplidos = pasosCumplidos(r).filter(Boolean).length;
  if (cumplidos === 4) return 'Formal';
  if (cumplidos >= 2) return 'En proceso';
  return 'Inicial';
}

function regimenSugerido(ventasMensuales) {
  return Number(ventasMensuales) <= 8000
    ? 'Nuevo RUS: pagas una cuota fija mensual; ideal si vendes hasta S/ 8 000 al mes.'
    : 'Régimen MYPE Tributario (RMT): pagos a cuenta según tus ingresos.';
}

function generarRuta(r) {
  const [ruc, comprobantes, licencia, trabajadores] = pasosCumplidos(r);
  const pasos = [
    { id: 'ruc', titulo: 'Obtener RUC', cumplido: ruc, detalle: 'Inscríbete en el RUC de la SUNAT con tu DNI; el trámite es gratuito.', enlace: 'https://www.gob.pe/sunat' },
    { id: 'regimen', titulo: 'Elegir régimen tributario y emitir comprobantes', cumplido: comprobantes, detalle: regimenSugerido(r.ventasMensuales), enlace: 'https://www.gob.pe/sunat' },
    { id: 'licencia', titulo: 'Tramitar la licencia de funcionamiento', cumplido: licencia, detalle: 'Solicítala en la Municipalidad de La Victoria.', enlace: 'https://www.munilavictoria.gob.pe' },
    { id: 'trabajadores', titulo: 'Formalizar a tus trabajadores', cumplido: trabajadores, detalle: 'Regístralos en la planilla electrónica (T-Registro).', enlace: 'https://www.gob.pe/mtpe' },
  ];
  const siguiente = pasos.find((p) => !p.cumplido);
  return {
    nivel: calcularNivel(r),
    avance: Math.round((100 * pasos.filter((p) => p.cumplido).length) / pasos.length),
    siguiente: siguiente ? siguiente.id : null,
    pasos,
  };
}

module.exports = { validarRuc, validarDni, validarCelular, validarPassword, calcularNivel, generarRuta, regimenSugerido };
