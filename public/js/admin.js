/* =============================================================
   Panel de gestión de citas · Peluquería Mayka
   ============================================================= */
(function () {
  'use strict';

  var CLAVE_TOKEN = 'mayka_admin_token';
  var filtro = 'todas';
  var citas = [];

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  var DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
    'septiembre', 'octubre', 'noviembre', 'diciembre'];

  /* Normaliza el token: ignora mayúsculas, espacios y separadores
     (-, _, .), y extrae el token si se ha pegado la URL completa. */
  function limpiarToken(valor) {
    var texto = String(valor == null ? '' : valor).trim();
    var deUrl = texto.match(/[?&]token=([^&#\s]+)/i);
    if (deUrl) {
      try { texto = decodeURIComponent(deUrl[1]); } catch (e) { texto = deUrl[1]; }
    }
    return texto
      .replace(/[`'"]/g, '')
      .replace(/[\s\-_.]+/g, '')
      .toLowerCase();
  }

  function token() {
    var url = new URL(window.location.href);
    var t = url.searchParams.get('token');
    if (t) {
      localStorage.setItem(CLAVE_TOKEN, limpiarToken(t));
      url.searchParams.delete('token');
      window.history.replaceState({}, '', url.pathname + (url.search || '') + url.hash);
      return localStorage.getItem(CLAVE_TOKEN);
    }
    return localStorage.getItem(CLAVE_TOKEN) || '';
  }

  function fechaLegible(iso) {
    var p = iso.split('-');
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    return DIAS[d.getDay()] + ' ' + d.getDate() + ' de ' + MESES[d.getMonth()];
  }

  function escapar(txt) {
    return String(txt == null ? '' : txt)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function pintarResumen() {
    var hoy = new Date();
    var isoHoy = hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0') + '-' + String(hoy.getDate()).padStart(2, '0');
    var total = citas.length;
    var proximas = citas.filter(function (c) { return c.fecha >= isoHoy && c.estado !== 'cancelada'; }).length;
    var pendientes = citas.filter(function (c) { return c.estado === 'pendiente'; }).length;
    var hoyCount = citas.filter(function (c) { return c.fecha === isoHoy && c.estado !== 'cancelada'; }).length;

    $('#resumen').innerHTML = [
      { n: total, t: 'Citas registradas' },
      { n: proximas, t: 'Próximas' },
      { n: pendientes, t: 'Pendientes de confirmar' },
      { n: hoyCount, t: 'Citas de hoy' }
    ].map(function (c) {
      return '<div class="resumen__card"><div class="resumen__num">' + c.n + '</div><div class="resumen__txt">' + c.t + '</div></div>';
    }).join('');
  }

  function pintarTabla() {
    var body = $('#citasBody');
    var lista = filtro === 'todas' ? citas : citas.filter(function (c) { return c.estado === filtro; });

    $('#vacio').hidden = lista.length > 0;

    body.innerHTML = lista.map(function (c) {
      return '' +
        '<tr>' +
          '<td class="celda__ref">' + escapar(c.id) +
            (c.correoEnviado === false && c.correoError
              ? '<span class="aviso-correo" title="' + escapar(c.correoError) + '">correo no enviado</span>'
              : '') +
          '</td>' +
          '<td class="celda__fecha">' + escapar(fechaLegible(c.fecha)) +
            '<small>' + escapar(c.fecha) + '</small></td>' +
          '<td><strong>' + escapar(c.hora) + '</strong><small class="celda__contacto">' + escapar(c.duracion) + ' min</small></td>' +
          '<td class="celda__nombre">' + escapar(c.nombre) +
            '<a class="celda__contacto" href="tel:' + escapar(c.telefono) + '">' + escapar(c.telefono) + '</a>' +
            (c.email ? '<a class="celda__contacto" href="mailto:' + escapar(c.email) + '">' + escapar(c.email) + '</a>' : '') +
            (c.notas ? '<span class="notas">“' + escapar(c.notas) + '”</span>' : '') +
          '</td>' +
          '<td>' + escapar(c.servicioNombre || c.servicio) + '</td>' +
          '<td><span class="estado estado--' + escapar(c.estado) + '">' + escapar(c.estado) + '</span></td>' +
          '<td><div class="acciones">' + botones(c) + '</div></td>' +
        '</tr>';
    }).join('');

    $$('.accion', body).forEach(function (btn) {
      btn.addEventListener('click', function () {
        cambiarEstado(btn.getAttribute('data-id'), btn.getAttribute('data-estado'), btn);
      });
    });
  }

  function botones(c) {
    var html = '';
    if (c.estado !== 'confirmada' && c.estado !== 'realizada' && c.estado !== 'cancelada') {
      html += '<button class="accion accion--ok" data-id="' + c.id + '" data-estado="confirmada">Confirmar</button>';
    }
    if (c.estado !== 'realizada' && c.estado !== 'cancelada') {
      html += '<button class="accion" data-id="' + c.id + '" data-estado="realizada">Realizada</button>';
    }
    if (c.estado !== 'cancelada') {
      html += '<button class="accion accion--no" data-id="' + c.id + '" data-estado="cancelada">Cancelar</button>';
    }
    return html;
  }

  function cambiarEstado(id, estado, btn) {
    btn.disabled = true;
    fetch('/api/admin/citas/' + encodeURIComponent(id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token(), estado: estado })
    })
      .then(function (r) { return r.json(); })
      .then(function (json) {
        if (!json.ok) throw new Error(json.error || 'Error');
        cargar();
      })
      .catch(function (err) {
        alert('No se ha podido actualizar: ' + err.message);
        btn.disabled = false;
      });
  }

  function cargar() {
    var t = token();
    if (!t) {
      mostrarAcceso();
      return;
    }
    return fetch('/api/admin/citas?token=' + encodeURIComponent(t))
      .then(function (r) { return r.json(); })
      .then(function (json) {
        if (!json.ok) throw new Error(json.error || 'Sin acceso');
        citas = json.citas || [];
        $('#acceso').hidden = true;
        $('#panel').hidden = false;
        pintarResumen();
        pintarTabla();
        cargarDiagnostico();
      })
      .catch(function (err) {
        localStorage.removeItem(CLAVE_TOKEN);
        mostrarAcceso();
        $('#avisoError').textContent = err.message +
          ' El token se define en el archivo .env del servidor (variable ADMIN_TOKEN).';
        $('#avisoError').hidden = false;
      });
  }

  function mostrarAcceso() {
    $('#panel').hidden = true;
    $('#acceso').hidden = false;
    var campo = $('#token');
    if (campo) campo.focus();
  }

  function cargarDiagnostico() {
    return fetch('/api/admin/diagnostico?token=' + encodeURIComponent(token()))
      .then(function (r) { return r.json(); })
      .then(function (json) {
        if (!json.ok) return;
        var aviso = $('#avisoCorreo');
        if (!aviso) return;
        var c = json.correo;
        var texto = '';
        var clase = 'admin__aviso';

        if (c.modo === 'off') {
          texto = '<strong>El envío de correo está desactivado</strong> (MAIL_MODE=off). Las citas se guardan, ' +
            'pero no llega ningún email a ' + escapar(c.destinatario) + '.';
          clase += ' admin__aviso--alerta';
        } else if (c.transporte === 'smtp') {
          texto = '<strong>Correo por SMTP activo.</strong> Cada cita llega a ' + escapar(c.destinatario) +
            ' y el cliente recibe la confirmación por email.';
        } else {
          texto = '<strong>Correo por FormSubmit.</strong> La primera cita enviada activa el formulario: ' +
            'recibirás un email en ' + escapar(c.destinatario) + ' con un enlace <em>«Activate Form»</em>. ' +
            'Haz clic en él una sola vez y a partir de ese momento todos los correos llegan automáticamente.';
        }

        aviso.innerHTML = texto;
        aviso.className = clase;
        aviso.hidden = false;
      })
      .catch(function () { /* sin diagnóstico: no pasa nada */ });
  }

  function init() {
    var t = token();
    if (t) {
      $('#token').value = t;
      cargar();
    }

    $('#formAcceso').addEventListener('submit', function (e) {
      e.preventDefault();
      var valor = limpiarToken($('#token').value);
      if (!valor) {
        $('#avisoError').hidden = false;
        $('#avisoError').textContent = 'Escribe el token de acceso para entrar.';
        return;
      }
      $('#avisoError').hidden = true;
      localStorage.setItem(CLAVE_TOKEN, valor);
      cargar();
    });

    $('#btnSalir').addEventListener('click', function () {
      localStorage.removeItem(CLAVE_TOKEN);
      mostrarAcceso();
      $('#token').value = '';
    });

    $('#btnIcs').addEventListener('click', function (e) {
      e.preventDefault();
      window.location.href = '/api/admin/citas.ics?token=' + encodeURIComponent(token());
    });

    $$('.filtro').forEach(function (btn) {
      btn.addEventListener('click', function () {
        $$('.filtro').forEach(function (b) { b.classList.remove('is-activo'); });
        btn.classList.add('is-activo');
        filtro = btn.getAttribute('data-filtro');
        pintarTabla();
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
