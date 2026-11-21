const {
  validarRuc, validarDni, validarCelular, validarPassword, calcularNivel, generarRuta, regimenSugerido,
} = require('../src/dominio');

describe('Pruebas unitarias · validarRuc (dígito verificador SUNAT)', () => {
  test('acepta un RUC con dígito verificador correcto', () => {
    expect(validarRuc('10456789019')).toBe(true);
  });
  test('rechaza un RUC con dígito verificador incorrecto', () => {
    expect(validarRuc('10456789018')).toBe(false);
  });
  test('rechaza longitud, prefijo o caracteres inválidos', () => {
    expect(validarRuc('1045678901')).toBe(false);
    expect(validarRuc('30456789019')).toBe(false);
    expect(validarRuc('abc')).toBe(false);
  });
});

describe('Pruebas unitarias · validaciones del registro (HU-01)', () => {
  test('DNI de 8 dígitos', () => {
    expect(validarDni('12345678')).toBe(true);
    expect(validarDni('1234567a')).toBe(false);
  });
  test('celular de 9 dígitos que empieza con 9', () => {
    expect(validarCelular('987654321')).toBe(true);
    expect(validarCelular('887654321')).toBe(false);
  });
  test('contraseña de al menos 8 caracteres con letras y números', () => {
    expect(validarPassword('segura2026')).toBe(true);
    expect(validarPassword('solotexto')).toBe(false);
    expect(validarPassword('corta1')).toBe(false);
  });
});

describe('Pruebas unitarias · diagnóstico y ruta de formalización (HU-09, HU-10)', () => {
  test('sin requisitos cumplidos el nivel es Inicial y el primer paso es Obtener RUC', () => {
    const ruta = generarRuta({ tieneTrabajadores: true });
    expect(ruta.nivel).toBe('Inicial');
    expect(ruta.siguiente).toBe('ruc');
    expect(ruta.pasos[0].titulo).toBe('Obtener RUC');
  });
  test('con RUC y licencia esos pasos quedan cumplidos y se resalta el siguiente', () => {
    const ruta = generarRuta({ tieneRuc: true, tieneLicencia: true, tieneTrabajadores: true });
    expect(ruta.pasos.find((p) => p.id === 'ruc').cumplido).toBe(true);
    expect(ruta.pasos.find((p) => p.id === 'licencia').cumplido).toBe(true);
    expect(ruta.siguiente).toBe('regimen');
    expect(ruta.nivel).toBe('En proceso');
    expect(ruta.avance).toBe(50);
  });
  test('con todos los requisitos el nivel es Formal', () => {
    expect(calcularNivel({ tieneRuc: true, emiteComprobantes: true, tieneLicencia: true, tieneTrabajadores: false })).toBe('Formal');
  });
  test('sugiere Nuevo RUS para ventas bajas y RMT para ventas mayores', () => {
    expect(regimenSugerido(5000)).toMatch(/Nuevo RUS/);
    expect(regimenSugerido(20000)).toMatch(/MYPE/);
  });
});
