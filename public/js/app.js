/* =============================================================
   Peluquería Mayka · Los Alcázares (Murcia)
   Lógica del sitio y del sistema de citas.
   ============================================================= */
(function () {
  'use strict';

  var SERVICIOS = window.MAYKA_SERVICIOS || [];
  var HORARIOS = window.MAYKA_HORARIOS || {};

  var DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  var DIAS_CORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  var EMAIL_SALON = 'miguelmelladoros6@gmail.com';
  var HORIZONTE = 60;

  var estado = {
    servicios: SERVICIOS,
    servicioId: '',
    fecha: '',
    hora: '',
    modoExterno: false,   /* true si no hay servidor propio: se envía por FormSubmit */
    disponible: false
  };

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  /* ---------------- utilidades ---------------- */

  function aIso(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function deIso(iso) {
    var p = iso.split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }

  function sumarDias(iso, dias) {
    var d = deIso(iso);
    d.setDate(d.getDate() + dias);
    return aIso(d);
  }

  function diaSemana(iso) {
    return deIso(iso).getDay();
  }

  function minutos(hhmm) {
    var p = String(hhmm).split(':');
    return Number(p[0]) * 60 + (Number(p[1]) || 0);
  }

  /* Convierte minutos totales (540) en "09:00" */
  function deMinutos(m) {
    var total = Number(m);
    if (!isFinite(total)) return '';
    return String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0');
  }

  function horasDe(iso) {
    return HORARIOS[diaSemana(iso)] || [];
  }

  function textoDia(iso) {
    var d = deIso(iso);
    return DIAS_SEMANA[d.getDay()] + ' ' + d.getDate() + ' de ' + MESES[d.getMonth()];
  }

  function servicioPorId(id) {
    for (var i = 0; i < estado.servicios.length; i++) {
      if (estado.servicios[i].id === id) return estado.servicios[i];
    }
    return null;
  }

  function icono(nombre) {
    return '<svg class="ico"><use href="#i-' + nombre + '"/></svg>';
  }

  function escapar(txt) {
    return String(txt == null ? '' : txt)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ---------------- menú y cabecera ---------------- */

  function initMenu() {
    var btn = $('#hamburguesa');
    var nav = $('#nav');
    if (!btn || !nav) return;
    btn.addEventListener('click', function () {
      var abierto = nav.classList.toggle('abierto');
      btn.setAttribute('aria-expanded', abierto ? 'true' : 'false');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        nav.classList.remove('abierto');
        btn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  function initCabecera() {
    var cabecera = $('#cabecera');
    if (!cabecera) return;
    var alHacerScroll = function () {
      if (window.scrollY > 40) cabecera.classList.add('cabecera--fija');
      else cabecera.classList.remove('cabecera--fija');
    };
    window.addEventListener('scroll', alHacerScroll, { passive: true });
    alHacerScroll();
  }

  /* ---------------- datos del servidor ---------------- */

  function cargarConfig() {
    return fetch('/api/config', { headers: { Accept: 'application/json' } })
      .then(function (r) {
        if (!r.ok) throw new Error('Sin API');
        return r.json();
      })
      .then(function (cfg) {
        if (cfg && cfg.servicios && cfg.servicios.length) estado.servicios = cfg.servicios;
        estado.disponible = true;
        if (cfg && cfg.horizonte) estado.horizonte = cfg.horizonte;
        return cfg;
      })
      .catch(function () {
        estado.disponible = false;
        estado.modoExterno = true;
        return null;
      });
  }

  /* ---------------- servicios ---------------- */

  function pintarServicios() {
    var cont = $('#serviciosGrid');
    if (!cont) return;
    cont.innerHTML = estado.servicios.map(function (s) {
      return '' +
        '<article class="servicio">' +
          '<div class="servicio__icono">' + icono(s.icono || 'tijeras') + '</div>' +
          '<h3 class="servicio__nombre">' + escapar(s.nombre) + '</h3>' +
          '<p class="servicio__desc">' + escapar(s.descripcion) + '</p>' +
          '<div class="servicio__pie">' +
            '<span class="servicio__dur">' + icono('reloj') + s.duracion + ' min</span>' +
            '<button type="button" class="servicio__cta" data-servicio="' + s.id + '">Reservar</button>' +
          '</div>' +
        '</article>';
    }).join('');

    $$('.servicio__cta', cont).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var sel = $('#servicio');
        sel.value = btn.getAttribute('data-servicio');
        sel.dispatchEvent(new Event('change'));
        var destino = document.getElementById('reservar');
        if (destino) destino.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  function pintarSelectServicios() {
    var sel = $('#servicio');
    if (!sel) return;
    sel.innerHTML = '<option value="">Selecciona un servicio…</option>' +
      estado.servicios.map(function (s) {
        return '<option value="' + s.id + '">' + escapar(s.nombre) + ' · ' + s.duracion + ' min</option>';
      }).join('');
    sel.addEventListener('change', function () {
      estado.servicioId = sel.value;
      var s = servicioPorId(sel.value);
      var info = $('#infoServicio');
      if (info) {
        info.textContent = s
          ? 'Duración estimada: ' + s.duracion + ' minutos. ' + s.descripcion
          : '';
      }
      limpiarError('servicio');
      pintarDias();
      pintarHoras();
    });
  }

  /* ---------------- días ---------------- */

  function pintarDias() {
    var cont = $('#dias');
    if (!cont) return;
    var hoy = aIso(new Date());
    var html = '';
    var encontrados = 0;
    var limite = sumarDias(hoy, HORIZONTE);

    for (var i = 0; i <= HORIZONTE; i++) {
      var iso = sumarDias(hoy, i);
      if (iso > limite) break;
      var franjas = horasDe(iso);
      if (!franjas.length) continue;
      encontrados++;
      var d = deIso(iso);
      var sel = (iso === estado.fecha) ? ' is-activo' : '';
      html += '' +
        '<button type="button" class="dia' + sel + '" role="radio" aria-checked="' + (iso === estado.fecha) + '" data-fecha="' + iso + '">' +
          '<span class="dia__sem">' + DIAS_CORTO[d.getDay()] + '</span>' +
          '<span class="dia__num">' + d.getDate() + '</span>' +
          '<span class="dia__mes">' + MESES[d.getMonth()] + '</span>' +
        '</button>';
    }

    if (!encontrados) {
      cont.innerHTML = '<p class="campo__info">No hay días disponibles en los próximos ' + HORIZONTE + ' días.</p>';
      return;
    }

    cont.innerHTML = html;
    $$('.dia', cont).forEach(function (btn) {
      btn.addEventListener('click', function () {
        estado.fecha = btn.getAttribute('data-fecha');
        estado.hora = '';
        $$('.dia', cont).forEach(function (b) {
          b.classList.remove('is-activo');
          b.setAttribute('aria-checked', 'false');
        });
        btn.classList.add('is-activo');
        btn.setAttribute('aria-checked', 'true');
        limpiarError('fecha');
        limpiarError('hora');
        pintarHoras();
      });
    });
  }

  /* ---------------- horas ---------------- */

  function pintarHoras() {
    var cont = $('#horas');
    if (!cont) return;

    if (!estado.servicioId || !estado.fecha) {
      cont.innerHTML = '<p class="campo__info">Selecciona antes el servicio y el día.</p>';
      return;
    }

    cont.innerHTML = '<p class="campo__info">Cargando horas disponibles…</p>';

    var servicio = servicioPorId(estado.servicioId);
    var url = '/api/disponibilidad?fecha=' + encodeURIComponent(estado.fecha) +
              '&servicio=' + encodeURIComponent(estado.servicioId);

    /* Si ya sabemos que no hay servidor (web estática), no hay que insistir */
    if (estado.modoExterno) {
      pintarHorasLocales(servicio);
      return;
    }

    fetch(url, { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data || !data.ok) throw new Error('Sin respuesta');
        if (!data.abierto) {
          cont.innerHTML = '<p class="campo__info">' + escapar(data.mensaje || 'No hay horas disponibles ese día.') + '</p>';
          return;
        }
        var libres = data.slots.filter(function (s) { return s.disponible; });
        if (!libres.length) {
          cont.innerHTML = '<p class="campo__info">Ese día no quedan horas libres para este servicio. Prueba con otra fecha.</p>';
          return;
        }
        cont.innerHTML = libres.map(function (s) {
          return '<button type="button" class="hora" role="radio" aria-checked="false" data-hora="' + s.hora + '">' + s.hora + '</button>';
        }).join('');
        $$('.hora', cont).forEach(function (btn) {
          btn.addEventListener('click', function () {
            estado.hora = btn.getAttribute('data-hora');
            $$('.hora', cont).forEach(function (b) {
              b.classList.remove('is-activo');
              b.setAttribute('aria-checked', 'false');
            });
            btn.classList.add('is-activo');
            btn.setAttribute('aria-checked', 'true');
            limpiarError('hora');
          });
        });
      })
      .catch(function () {
        /* Modo estático: se calculan las horas del horario del salón */
        estado.modoExterno = true;
        pintarHorasLocales(servicio);
      });
  }

  /* Cálculo local de huecos (cuando la web se sirve como archivo estático) */
  function pintarHorasLocales(servicio) {
    var cont = $('#horas');
    var dur = servicio ? servicio.duracion : 30;
    var franjas = horasDe(estado.fecha);
    var html = '';
    franjas.forEach(function (f) {
      var ini = minutos(f[0]);
      var fin = minutos(f[1]);
      for (var m = ini; m + dur <= fin; m += 30) {
        html += '<button type="button" class="hora" role="radio" aria-checked="false" data-hora="' + deMinutos(m) + '">' + deMinutos(m) + '</button>';
      }
    });
    if (!html) {
      cont.innerHTML = '<p class="campo__info">No hay horas disponibles ese día.</p>';
      return;
    }
    cont.innerHTML = html;
    $$('.hora', cont).forEach(function (btn) {
      btn.addEventListener('click', function () {
        estado.hora = btn.getAttribute('data-hora');
        $$('.hora', cont).forEach(function (b) {
          b.classList.remove('is-activo');
          b.setAttribute('aria-checked', 'false');
        });
        btn.classList.add('is-activo');
        btn.setAttribute('aria-checked', 'true');
        limpiarError('hora');
      });
    });
  }

  /* ---------------- horario semanal ---------------- */

  function pintarHorario() {
    var cont = $('#horarioGrid');
    if (!cont) return;
    var orden = [1, 2, 3, 4, 5, 6, 0];
    var nombres = { 1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes', 6: 'Sábado', 0: 'Domingo' };
    cont.innerHTML = orden.map(function (d) {
      var franjas = HORARIOS[d] || [];
      var cuerpo = franjas.length
        ? franjas.map(function (f) { return '<span>' + f[0] + ' – ' + f[1] + '</span>'; }).join('<br>')
        : '<span class="horario__cerrado">Cerrado</span>';
      return '<div class="horario__dia' + (franjas.length ? '' : ' horario__dia--cerrado') + '">' +
        '<h3 class="horario__nombre">' + nombres[d] + '</h3>' +
        '<p class="horario__horas">' + cuerpo + '</p>' +
        '</div>';
    }).join('');
  }

  /* ---------------- errores ---------------- */

  function limpiarError(campo) {
    var el = document.querySelector('[data-error="' + campo + '"]');
    if (el) { el.textContent = ''; el.classList.remove('is-visible'); }
  }

  function mostrarError(campo, mensaje) {
    var el = document.querySelector('[data-error="' + campo + '"]');
    if (el) {
      el.textContent = mensaje;
      el.classList.add('is-visible');
    }
    var input = document.getElementById(campo);
    if (input) input.classList.add('is-error');
  }

  function limpiarErrores() {
    $$('.campo__error').forEach(function (el) { el.textContent = ''; el.classList.remove('is-visible'); });
    $$('.is-error').forEach(function (el) { el.classList.remove('is-error'); });
  }

  /* ---------------- envío ---------------- */

  function validar() {
    limpiarErrores();
    var ok = true;
    var nombre = $('#nombre').value.trim();
    var telefono = $('#telefono').value.trim();
    var email = $('#email').value.trim();
    var notas = $('#notas').value.trim();

    if (!estado.servicioId) { mostrarError('servicio', 'Elige un servicio.'); ok = false; }
    if (!estado.fecha) { mostrarError('fecha', 'Elige un día.'); ok = false; }
    if (!estado.hora) { mostrarError('hora', 'Elige una hora.'); ok = false; }
    if (nombre.length < 2) { mostrarError('nombre', 'Escribe tu nombre.'); ok = false; }
    if (!/^[+]?[\d\s().-]{9,20}$/.test(telefono)) { mostrarError('telefono', 'Introduce un teléfono válido.'); ok = false; }
    if (email && !/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(email)) { mostrarError('email', 'El correo no parece válido.'); ok = false; }
    if (notas.length > 600) { mostrarError('notas', 'Máximo 600 caracteres.'); ok = false; }
    if (!$('#privacidad').checked) { mostrarError('privacidad', 'Debes aceptar las condiciones de privacidad.'); ok = false; }

    return ok;
  }

  function datosFormulario() {
    var s = servicioPorId(estado.servicioId);
    return {
      nombre: $('#nombre').value.trim(),
      telefono: $('#telefono').value.trim(),
      email: $('#email').value.trim(),
      notas: $('#notas').value.trim(),
      servicio: estado.servicioId,
      servicioId: estado.servicioId,
      fecha: estado.fecha,
      hora: estado.hora,
      privacidad: $('#privacidad').checked,
      origen: 'web',
      referencia: 'pendiente',
      nombreServicio: s ? s.nombre : ''
    };
  }

  function textoResumen(datos) {
    return 'Servicio: ' + (datos.nombreServicio || datos.servicio) + '\n' +
      'Día: ' + textoDia(datos.fecha) + '\n' +
      'Hora: ' + datos.hora + '\n' +
      'Cliente: ' + datos.nombre + '\n' +
      'Teléfono: ' + datos.telefono +
      (datos.email ? '\nCorreo: ' + datos.email : '') +
      (datos.notas ? '\nNotas: ' + datos.notas : '');
  }

  function aviso(texto, tipo) {
    var el = $('#formAviso');
    el.textContent = texto;
    el.className = 'formulario__aviso' + (tipo ? ' formulario__aviso--' + tipo : '');
  }

  function exito(datos, correoEnviado, transporte) {
    var form = $('#formCita');
    var caja = $('#exito');
    form.hidden = true;
    caja.hidden = false;

    $('#exitoTexto').textContent = datos.nombre +
      ', hemos registrado tu solicitud de cita. Te confirmamos por teléfono o correo si hubiera cualquier cambio.';

    var s = servicioPorId(datos.servicioId) || servicioPorId(datos.servicio) || servicioPorId(estado.servicioId);
    var nombreServicio = (s && s.nombre) || datos.nombreServicio || datos.servicio || '';
    var duracion = (s && s.duracion) || datos.duracion || '';
    var fechaTxt = datos.fechaLegible || textoDia(datos.fecha);

    $('#exitoDatos').innerHTML = '' +
      fila('Servicio', nombreServicio) +
      fila('Día', fechaTxt) +
      fila('Hora', datos.hora) +
      fila('Duración', duracion ? duracion + ' min' : '-') +
      fila('Teléfono', datos.telefono) +
      (datos.email ? fila('Correo', datos.email) : '');

    var nota = $('#exitoNota');
    if (correoEnviado) {
      nota.innerHTML = '<svg class="ico"><use href="#i-check"/></svg> Tu cita se ha enviado por correo al salón' +
        (transporte === 'formsubmit' ? ' y te hemos enviado la confirmación.' : ' y te hemos enviado la confirmación.');
    } else {
      nota.innerHTML = '<svg class="ico"><use href="#i-tel"/></svg> Tu cita queda registrada. Si no recibes nada en unos minutos, llámanos al ' +
        '<a href="tel:+34868700105">+34 868 70 01 05</a>.';
    }

    caja.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function fila(etiqueta, valor) {
    return '<div class="exito__fila"><dt>' + escapar(etiqueta) + '</dt><dd>' + escapar(valor) + '</dd></div>';
  }

  function enviar(datos) {
    var btn = $('#btnEnviar');
    btn.classList.add('is-loading');
    btn.disabled = true;
    aviso('Enviando tu cita…');

    var promesa = estado.disponible
      ? fetch('/api/citas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(datos)
        }).then(function (r) {
          return r.json().then(function (json) { return { status: r.status, json: json }; });
        })
      : enviarExterno(datos);

    return promesa
      .then(function (res) {
        btn.classList.remove('is-loading');
        btn.disabled = false;
        if (res.json && res.json.ok) {
          aviso('');
          exito(res.json.cita || datos, res.json.correoEnviado !== false, res.json.correoTransporte);
        } else {
          var errores = (res.json && res.json.errores) || {};
          Object.keys(errores).forEach(function (campo) { mostrarError(campo, errores[campo]); });
          aviso((res.json && res.json.error) || 'No hemos podido registrar la cita. Inténtalo de nuevo.', 'error');
        }
      })
      .catch(function () {
        btn.classList.remove('is-loading');
        btn.disabled = false;
        aviso('Ha ocurrido un error de conexión. Inténtalo de nuevo o llámanos al +34 868 70 01 05.', 'error');
      });
  }

  /* Modo estático: envío directo por FormSubmit.co al correo del salón */
  function enviarExterno(datos) {
    var s = servicioPorId(datos.servicioId) || servicioPorId(datos.servicio);
    var cuerpo = new URLSearchParams();
    cuerpo.set('_subject', 'Nueva cita · ' + (s ? s.nombre : datos.servicio) + ' · ' + datos.fecha + ' ' + datos.hora);
    cuerpo.set('_template', 'table');
    cuerpo.set('_captcha', 'false');
    cuerpo.set('Cliente', datos.nombre);
    cuerpo.set('Teléfono', datos.telefono);
    cuerpo.set('Correo', datos.email || '—');
    cuerpo.set('Servicio', s ? s.nombre : datos.servicio);
    cuerpo.set('Día', textoDia(datos.fecha));
    cuerpo.set('Hora', datos.hora);
    cuerpo.set('Duración', (s ? s.duracion : '') + ' min');
    cuerpo.set('Notas', datos.notas || '—');
    cuerpo.set('Referencia', datos.referencia || '—');
    cuerpo.set('Teléfono del salón', '+34 868 70 01 05');
    cuerpo.set('Dirección', 'Avenida Europa nº 5, 30710 Los Alcázares (Murcia)');

    return fetch('https://formsubmit.co/ajax/' + encodeURIComponent(EMAIL_SALON), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: cuerpo.toString()
    })
      .then(function (r) { return r.json(); })
      .then(function (json) {
        if (json && json.success === 'false') throw new Error(json.message || 'Error');
        return { status: 200, json: { ok: true, cita: datos, correoEnviado: true, correoTransporte: 'formsubmit' } };
      });
  }

  /* ---------------- init ---------------- */

  function initFormulario() {
    var form = $('#formCita');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validar()) {
        aviso('Revisa los campos marcados.', 'error');
        return;
      }
      enviar(datosFormulario());
    });

    var btnOtra = $('#btnOtra');
    if (btnOtra) {
      btnOtra.addEventListener('click', function () {
        $('#exito').hidden = true;
        $('#formCita').hidden = false;
        estado.hora = '';
        $('#servicio').value = '';
        estado.servicioId = '';
        $('#privacidad').checked = false;
        limpiarErrores();
        pintarDias();
        pintarHoras();
        document.getElementById('reservar').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }

    ['nombre', 'telefono', 'email', 'notas'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('input', function () { limpiarError(id); });
    });
    var priv = $('#privacidad');
    if (priv) priv.addEventListener('change', function () { limpiarError('privacidad'); });
  }

  function init() {
    initMenu();
    initCabecera();
    cargarConfig().then(function () {
      pintarServicios();
      pintarSelectServicios();
      pintarDias();
      pintarHoras();
    });
    pintarHorario();
    initFormulario();

    var anio = $('#anio');
    if (anio) anio.textContent = new Date().getFullYear();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
