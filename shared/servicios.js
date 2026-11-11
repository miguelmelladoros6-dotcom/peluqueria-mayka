/* =============================================================
   Peluquería Mayka · Los Alcázares (Murcia)
   Catálogo de servicios.

   Los servicios incluidos están contrastados con los publicados
   por el propio negocio en Google Business Profile y en Fresha
   (balayage, corte de mujer, corte de niños, tinte de cabello,
   rizado y permanentas, peinado, matiz / tinte de color) y con
   los servicios citados por los clientes en sus reseñas
   (corte, tinte, mechas, balayage, alisado con secador,
   modelación de cejas y citas para bodas).

   No se incluyen precios: el negocio no los publica, por lo que
   el precio se confirma en el salón tras el diagnóstico.
   ============================================================= */
(function (root, factory) {
  var data = factory();
  if (typeof module === 'object' && module.exports) module.exports = data;
  else root.MAYKA_SERVICIOS = data;
})(typeof self !== 'undefined' ? self : this, function () {
  return [
    {
      id: 'corte-mujer',
      nombre: 'Corte de pelo para mujer',
      descripcion:
        'Corte personalizado con lavado y acabado. Asesoramos de largo, capas, flequillo y forma según tu estilo de vida.',
      duracion: 45,
      icono: 'tijeras'
    },
    {
      id: 'corte-ninos',
      nombre: 'Corte de pelo para niños',
      descripcion:
        'Un corte pensado para los más pequeños, con paciencia y mimos. Un local adecuado para niños.',
      duracion: 30,
      icono: 'nino'
    },
    {
      id: 'corte-peinado',
      nombre: 'Corte y peinado con secador',
      descripcion:
        'Corte más acabado con secador (alisado u ondas). Muy demandado: el liso con secador dura mucho más que la plancha.',
      duracion: 60,
      icono: 'secador'
    },
    {
      id: 'peinado-ocasion',
      nombre: 'Peinado de ocasión',
      descripcion:
        'Peinado para ocasiones especiales: bodas, celebraciones y eventos. Reservamos el tiempo que necesites.',
      duracion: 45,
      icono: 'peine'
    },
    {
      id: 'tinte',
      nombre: 'Tinte de cabello',
      descripcion:
        'Coloración completa con diagnóstico previo del tono y cuidado de la fibra capilar. Cubrimiento de canas o cambio de color.',
      duracion: 75,
      icono: 'gotero'
    },
    {
      id: 'mechas',
      nombre: 'Mechas',
      descripcion:
        'Mechas de luz con acabado natural, realizadas con técnica respetuosa para que el cabello no llegue dañado.',
      duracion: 90,
      icono: 'sol'
    },
    {
      id: 'balayage',
      nombre: 'Mechas balayage',
      descripcion:
        'Pintado a mano para lograr un degradado natural, luminoso y de bajo mantenimiento, sin líneas de demarcación.',
      duracion: 120,
      icono: 'pincel'
    },
    {
      id: 'matiz',
      nombre: 'Matiz / tinte de color',
      descripcion:
        'Refresca el color entre sesiones, unifica tonos y aporta luminosidad sin necesidad de un tinte completo.',
      duracion: 45,
      icono: 'espejo'
    },
    {
      id: 'rizado',
      nombre: 'Rizado y permanentas',
      descripcion:
        'Rizado con ondas y permanentas, con el cuidado del cabello en cada paso del proceso.',
      duracion: 90,
      icono: 'rizos'
    },
    {
      id: 'alisado',
      nombre: 'Alisado',
      descripcion:
        'Alisado profesional para cabellos que resultan difíciles de manejar, con acabado natural y cuidado de la fibra.',
      duracion: 60,
      icono: 'plancha'
    },
    {
      id: 'cejas',
      nombre: 'Modelación de cejas',
      descripcion:
        'Diseño y modelación de cejas, uno de los servicios más destacados del salón entre nuestros clientes.',
      duracion: 30,
      icono: 'ceja'
    },
    {
      id: 'eventos',
      nombre: 'Citas para bodas y eventos',
      descripcion:
        'Reservamos la franja completa para novias, acompañantes y grupos. Facilitamos la llegada y la hora.',
      duracion: 120,
      icono: 'corazon'
    }
  ];
});
