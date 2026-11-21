'use strict';
// Adaptador del servicio externo de consulta RUC (HU-11).
// Con RUC_API_URL (y RUC_API_TOKEN) consulta a un proveedor real por HTTPS.
// Sin esas variables usa un padrón simulado para desarrollo, pruebas y demostración.

const PADRON_SIMULADO = {
  '20512345671': { estado: 'ACTIVO', condicion: 'NO HABIDO', razonSocial: 'Contribuyente de prueba no habido' },
  '20123456786': { estado: 'BAJA DE OFICIO', condicion: 'HABIDO', razonSocial: 'Contribuyente de prueba de baja' },
};
const RUC_SERVICIO_CAIDO = '20000000001';

async function consultarRuc(ruc) {
  if (process.env.RUC_API_URL) {
    const resp = await fetch(`${process.env.RUC_API_URL}?numero=${encodeURIComponent(ruc)}`, {
      headers: { Authorization: `Bearer ${process.env.RUC_API_TOKEN || ''}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) throw new Error(`El servicio RUC respondió ${resp.status}`);
    const d = await resp.json();
    return {
      estado: String(d.estado || '').toUpperCase(),
      condicion: String(d.condicion || '').toUpperCase(),
      razonSocial: d.razonSocial || d.nombre || '',
    };
  }
  if (ruc === RUC_SERVICIO_CAIDO) throw new Error('Servicio RUC no disponible (simulado)');
  return PADRON_SIMULADO[ruc] || { estado: 'ACTIVO', condicion: 'HABIDO', razonSocial: 'Contribuyente de prueba' };
}

module.exports = { consultarRuc, RUC_SERVICIO_CAIDO };
