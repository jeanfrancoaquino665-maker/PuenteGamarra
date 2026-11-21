(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  let token = sessionStorage.getItem('token');

  async function api(ruta, opciones) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    const resp = await fetch('/api' + ruta, Object.assign({}, opciones, { headers }));
    const datos = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(datos.error || 'Ocurrió un error');
    return datos;
  }

  function avisar(texto, tipo) {
    const m = $('#mensaje');
    m.textContent = texto;
    m.className = 'mensaje ' + (tipo || 'ok');
    clearTimeout(avisar.t);
    avisar.t = setTimeout(() => m.classList.add('oculto'), 5000);
  }

  // Todo el contenido dinámico se crea con textContent (evita XSS).
  function el(tag, clase, texto) {
    const e = document.createElement(tag);
    if (clase) e.className = clase;
    if (texto !== undefined) e.textContent = texto;
    return e;
  }

  function mostrar(vista) {
    document.querySelectorAll('.vista').forEach((v) => v.classList.add('oculto'));
    $('#vista-' + vista).classList.remove('oculto');
    document.querySelectorAll('nav button[data-vista]').forEach((b) => b.classList.toggle('activo', b.dataset.vista === vista));
    if (vista === 'mi-negocio') cargarMiNegocio();
  }

  function actualizarSesion() {
    document.querySelectorAll('.solo-sesion').forEach((e) => e.classList.toggle('oculto', !token));
    document.querySelectorAll('.solo-anonimo').forEach((e) => e.classList.toggle('oculto', !!token));
  }

  function datosForm(form) {
    const d = {};
    new FormData(form).forEach((v, k) => { d[k] = v; });
    form.querySelectorAll('input[type=checkbox]').forEach((c) => { d[c.name] = c.checked; });
    return d;
  }

  function tarjetaNegocio(n) {
    const t = el('article', 'tarjeta');
    t.appendChild(el('h3', null, n.nombre));
    if (n.verificado) t.appendChild(el('span', 'insignia', '✔ Negocio verificado'));
    t.appendChild(el('p', null, n.rubro + ' · ' + n.tipo));
    t.appendChild(el('p', 'tenue', n.galeria ? n.galeria + ', puesto ' + n.puesto : n.zona));
    return t;
  }

  async function buscar(q) {
    const cont = $('#resultados');
    cont.textContent = '';
    try {
      const lista = await api('/negocios?q=' + encodeURIComponent(q || ''));
      if (!lista.length) {
        cont.appendChild(el('p', 'tenue', 'No encontramos resultados. Prueba con: jeans, polos, casacas o ropa de bebé.'));
        return;
      }
      lista.forEach((n) => cont.appendChild(tarjetaNegocio(n)));
    } catch (e) {
      avisar(e.message, 'error');
    }
  }

  function pintarRuta(ruta) {
    const cont = $('#ruta');
    cont.textContent = '';
    if (!ruta) return;
    cont.appendChild(el('p', 'nivel', 'Tu nivel de formalidad: ' + ruta.nivel + ' · Avance ' + ruta.avance + ' %'));
    const barra = el('div', 'barra');
    const lleno = el('div', 'lleno');
    lleno.style.width = ruta.avance + '%';
    barra.appendChild(lleno);
    cont.appendChild(barra);
    const ol = el('ol', 'pasos');
    ruta.pasos.forEach((p) => {
      const li = el('li', p.cumplido ? 'cumplido' : (p.id === ruta.siguiente ? 'siguiente' : ''));
      li.appendChild(el('strong', null, (p.cumplido ? '✔ ' : (p.id === ruta.siguiente ? '➜ ' : '')) + p.titulo));
      li.appendChild(el('p', null, p.detalle));
      const a = el('a', null, 'Ir al canal oficial');
      a.href = p.enlace;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      li.appendChild(a);
      ol.appendChild(li);
    });
    cont.appendChild(ol);
  }

  async function cargarMiNegocio() {
    try {
      const n = await api('/negocios/mio');
      $('#sin-negocio').classList.add('oculto');
      $('#con-negocio').classList.remove('oculto');
      const f = $('#ficha');
      f.textContent = '';
      const t = tarjetaNegocio(n);
      t.appendChild(el('p', n.verificado ? 'insignia' : 'tenue', 'Estado: ' + n.estado));
      f.appendChild(t);
      pintarRuta(n.ruta);
    } catch (e) {
      $('#con-negocio').classList.add('oculto');
      $('#sin-negocio').classList.remove('oculto');
    }
  }

  async function enviar(form, ruta, alTerminar) {
    try {
      const d = datosForm(form);
      if ('ventasMensuales' in d) d.ventasMensuales = Number(d.ventasMensuales);
      alTerminar(await api(ruta, { method: 'POST', body: JSON.stringify(d) }));
    } catch (err) {
      avisar(err.message, 'error');
    }
  }

  document.querySelectorAll('nav button[data-vista]').forEach((b) => b.addEventListener('click', () => mostrar(b.dataset.vista)));
  $('#salir').addEventListener('click', () => {
    token = null;
    sessionStorage.removeItem('token');
    actualizarSesion();
    mostrar('buscar');
  });
  $('#ver-privacidad').addEventListener('click', (e) => { e.preventDefault(); $('#privacidad').classList.toggle('oculto'); });
  $('#form-buscar').addEventListener('submit', (e) => { e.preventDefault(); buscar($('#q').value); });
  $('#form-registro').addEventListener('submit', (e) => {
    e.preventDefault();
    enviar(e.target, '/auth/registro', () => { avisar('Cuenta creada. Ahora ingresa con tu DNI.'); e.target.reset(); mostrar('ingresar'); });
  });
  $('#form-ingresar').addEventListener('submit', (e) => {
    e.preventDefault();
    enviar(e.target, '/auth/login', (r) => { token = r.token; sessionStorage.setItem('token', token); actualizarSesion(); mostrar('mi-negocio'); });
  });
  document.querySelectorAll('input[name=tipo]').forEach((r) => r.addEventListener('change', () => {
    const ambulante = document.querySelector('input[name=tipo]:checked').value === 'ambulante';
    $('#campos-ambulante').classList.toggle('oculto', !ambulante);
    $('#campos-galeria').classList.toggle('oculto', ambulante);
  }));
  $('#form-negocio').addEventListener('submit', (e) => {
    e.preventDefault();
    enviar(e.target, '/negocios', () => { avisar('Negocio registrado. Estado: No verificado.'); cargarMiNegocio(); });
  });
  $('#form-diagnostico').addEventListener('submit', (e) => {
    e.preventDefault();
    enviar(e.target, '/negocios/mio/diagnostico', pintarRuta);
  });
  $('#form-ruc').addEventListener('submit', (e) => {
    e.preventDefault();
    enviar(e.target, '/negocios/mio/verificar-ruc', (r) => { avisar('¡Listo! Obtuviste la insignia «' + r.insignia + '».'); cargarMiNegocio(); });
  });

  (async function iniciar() {
    try {
      const rubros = await api('/negocios/rubros');
      rubros.forEach((r) => { const o = el('option', null, r); o.value = r; $('#rubros').appendChild(o); });
    } catch (e) { /* la vitrina funciona aunque no carguen los rubros */ }
    actualizarSesion();
    buscar('');
  })();
})();
