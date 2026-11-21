const crypto = require('crypto');
const request = require('supertest');

// Credenciales generadas en cada ejecución: no hay secretos escritos en el repositorio.
const ADMIN_DNI = '99999999';
const ADMIN_CLAVE = `Adm${crypto.randomBytes(6).toString('hex')}9`;
process.env.ADMIN_DNI = ADMIN_DNI;
process.env.ADMIN_PASSWORD = ADMIN_CLAVE;
const CLAVE = `Gm${crypto.randomBytes(4).toString('hex')}7`;

const { crearApp } = require('../src/app');

let app;
beforeAll(async () => { app = await crearApp(); });

async function registrarYEntrar(dni) {
  await request(app).post('/api/auth/registro').send({ dni, celular: '987654321', password: CLAVE, aceptaPrivacidad: true });
  const r = await request(app).post('/api/auth/login').send({ dni, password: CLAVE });
  return r.body.token;
}

describe('Integración · HU-01 y HU-04: registro con consentimiento', () => {
  test('registra un comerciante y guarda la contraseña cifrada con su consentimiento', async () => {
    const r = await request(app).post('/api/auth/registro').send({ dni: '40000001', celular: '987654321', password: CLAVE, aceptaPrivacidad: true });
    expect(r.status).toBe(201);
    expect(r.body.rol).toBe('comerciante');
    const u = app.locals.db.uno('SELECT hash, consentimiento_en FROM usuarios WHERE dni = ?', ['40000001']);
    expect(u.hash).not.toBe(CLAVE);
    expect(u.hash.startsWith('$2')).toBe(true);
    expect(u.consentimiento_en).toBeTruthy();
  });
  test('rechaza un DNI ya registrado', async () => {
    const r = await request(app).post('/api/auth/registro').send({ dni: '40000001', celular: '987654321', password: CLAVE, aceptaPrivacidad: true });
    expect(r.status).toBe(409);
    expect(r.body.error).toBe('Ya existe una cuenta con este DNI');
  });
  test('rechaza datos con formato inválido', async () => {
    const r = await request(app).post('/api/auth/registro').send({ dni: '12ab', celular: '123', password: 'x', aceptaPrivacidad: true });
    expect(r.status).toBe(400);
    expect(Object.keys(r.body.errores)).toEqual(expect.arrayContaining(['dni', 'celular', 'password']));
  });
  test('no crea la cuenta si no se acepta la política de privacidad', async () => {
    const r = await request(app).post('/api/auth/registro').send({ dni: '40000002', celular: '987654321', password: CLAVE, aceptaPrivacidad: false });
    expect(r.status).toBe(400);
    expect(app.locals.db.uno('SELECT id FROM usuarios WHERE dni = ?', ['40000002'])).toBeUndefined();
  });
});

describe('Integración · HU-02: inicio de sesión seguro', () => {
  test('entrega un token con credenciales correctas', async () => {
    const r = await request(app).post('/api/auth/login').send({ dni: '40000001', password: CLAVE });
    expect(r.status).toBe(200);
    expect(r.body.token).toBeTruthy();
  });
  test('responde con un mensaje genérico ante credenciales incorrectas', async () => {
    const r = await request(app).post('/api/auth/login').send({ dni: '40000001', password: `${CLAVE}x` });
    expect(r.status).toBe(401);
    expect(r.body.error).toBe('DNI o contraseña incorrectos');
  });
  test('bloquea la cuenta tras 5 intentos fallidos', async () => {
    await request(app).post('/api/auth/registro').send({ dni: '40000003', celular: '987654321', password: CLAVE, aceptaPrivacidad: true });
    for (let i = 0; i < 5; i += 1) {
      await request(app).post('/api/auth/login').send({ dni: '40000003', password: `${CLAVE}${i}` });
    }
    const r = await request(app).post('/api/auth/login').send({ dni: '40000003', password: CLAVE });
    expect(r.status).toBe(423);
  });
});

describe('Integración · HU-03: roles', () => {
  test('un comerciante no puede entrar a la administración', async () => {
    const token = await registrarYEntrar('40000004');
    const r = await request(app).get('/api/usuarios').set('Authorization', `Bearer ${token}`);
    expect(r.status).toBe(403);
  });
  test('el administrador asigna el rol de fiscalizador', async () => {
    const login = await request(app).post('/api/auth/login').send({ dni: ADMIN_DNI, password: ADMIN_CLAVE });
    const usuario = app.locals.db.uno('SELECT id FROM usuarios WHERE dni = ?', ['40000004']);
    const r = await request(app).patch(`/api/usuarios/${usuario.id}/rol`)
      .set('Authorization', `Bearer ${login.body.token}`).send({ rol: 'fiscalizador' });
    expect(r.status).toBe(200);
    const nuevo = await request(app).post('/api/auth/login').send({ dni: '40000004', password: CLAVE });
    expect(nuevo.body.rol).toBe('fiscalizador');
  });
});

describe('Integración · HU-05, HU-09, HU-10 y HU-11: negocio, ruta e insignia', () => {
  let token;
  beforeAll(async () => { token = await registrarYEntrar('40000005'); });
  const conToken = (req) => req.set('Authorization', `Bearer ${token}`);

  test('exige los campos obligatorios', async () => {
    const r = await conToken(request(app).post('/api/negocios')).send({ tipo: 'galeria' });
    expect(r.status).toBe(400);
  });
  test('pide la calle o zona a un comerciante ambulante', async () => {
    const r = await conToken(request(app).post('/api/negocios')).send({ nombre: 'Polos Lima', rubro: 'Polos', tipo: 'ambulante' });
    expect(r.status).toBe(400);
    expect(r.body.errores.zona).toBeDefined();
  });
  test('registra un negocio de galería en estado No verificado', async () => {
    const r = await conToken(request(app).post('/api/negocios'))
      .send({ nombre: 'Jeans Prueba', rubro: 'Jeans', tipo: 'galeria', galeria: 'Galería Central', puesto: '101' });
    expect(r.status).toBe(201);
    expect(r.body.estado).toBe('No verificado');
  });
  test('el diagnóstico devuelve el nivel y la ruta con el primer paso pendiente', async () => {
    const r = await conToken(request(app).post('/api/negocios/mio/diagnostico')).send({ tieneRuc: false, tieneTrabajadores: true, ventasMensuales: 6000 });
    expect(r.status).toBe(200);
    expect(r.body.nivel).toBe('Inicial');
    expect(r.body.siguiente).toBe('ruc');
  });
  test('rechaza un RUC con formato inválido', async () => {
    const r = await conToken(request(app).post('/api/negocios/mio/verificar-ruc')).send({ ruc: '123' });
    expect(r.status).toBe(400);
  });
  test('no otorga la insignia a un RUC no habido', async () => {
    const r = await conToken(request(app).post('/api/negocios/mio/verificar-ruc')).send({ ruc: '20512345671' });
    expect(r.status).toBe(422);
  });
  test('informa cuando el servicio externo de RUC no responde', async () => {
    const r = await conToken(request(app).post('/api/negocios/mio/verificar-ruc')).send({ ruc: '20000000001' });
    expect(r.status).toBe(503);
    expect(r.body.error).toBe('Servicio no disponible, intenta más tarde');
  });
  test('otorga la insignia con un RUC activo y habido', async () => {
    const r = await conToken(request(app).post('/api/negocios/mio/verificar-ruc')).send({ ruc: '10456789019' });
    expect(r.status).toBe(200);
    expect(r.body.insignia).toBe('Negocio verificado');
  });
});

describe('Integración · HU-14 y HU-15: vitrina pública', () => {
  test('busca negocios sin iniciar sesión y sin exponer datos personales', async () => {
    const r = await request(app).get('/api/negocios').query({ q: 'jeans' });
    expect(r.status).toBe(200);
    expect(r.body.length).toBeGreaterThan(0);
    r.body.forEach((n) => {
      expect(n).not.toHaveProperty('dni');
      expect(n).not.toHaveProperty('celular');
      expect(n).not.toHaveProperty('usuario_id');
    });
  });
  test('muestra la insignia del negocio verificado', async () => {
    const r = await request(app).get('/api/negocios').query({ q: 'Jeans Prueba' });
    expect(r.body[0].verificado).toBe(true);
  });
  test('responde 404 si el negocio no existe', async () => {
    const r = await request(app).get('/api/negocios/9999');
    expect(r.status).toBe(404);
    expect(r.body.error).toBe('Este negocio no está disponible');
  });
  test('el servicio de salud responde', async () => {
    const r = await request(app).get('/api/salud');
    expect(r.body.estado).toBe('ok');
  });
});
