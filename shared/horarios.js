/* =============================================================
   Peluquería Mayka · Los Alcázares (Murcia)
   Horario de apertura real del negocio (Google Business Profile).

   Indexado por día de la semana: 0 = domingo ... 6 = sábado.
   Cada franja es [hora_inicio, hora_fin] en formato HH:MM.
   ============================================================= */
(function (root, factory) {
  var data = factory();
  if (typeof module === 'object' && module.exports) module.exports = data;
  else root.MAYKA_HORARIOS = data;
})(typeof self !== 'undefined' ? self : this, function () {
  return {
    // Lunes a Jueves: 9:30-13:30 y 16:00-20:00
    1: [['09:30', '13:30'], ['16:00', '20:00']],
    // Martes
    2: [['09:30', '13:30'], ['16:00', '20:00']],
    // Miércoles
    3: [['09:30', '13:30'], ['16:00', '20:00']],
    // Jueves
    4: [['09:30', '13:30'], ['16:00', '20:00']],
    // Viernes: 9:00-13:30 y 16:00-20:00
    5: [['09:00', '13:30'], ['16:00', '20:00']],
    // Sábado: 9:00-15:00
    6: [['09:00', '15:00']],
    // Domingo: cerrado
    0: []
  };
});
