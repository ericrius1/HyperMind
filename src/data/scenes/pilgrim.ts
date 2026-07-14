import type { GraphScene } from '../../core/types';
import { buildScene, type SceneSeed } from '../sceneBuilder';

const pilgrimSeed: SceneSeed = {
  id: 'pilgrim',
  title: 'The Roads That Remember Our Footsteps',
  shortTitle: 'Sacred Roads',
  kicker: 'ROADS · RITUALS · WELCOME',
  description: 'Take up the shell and follow the yellow arrow west, from mountain gate to shared table, until the road itself begins to speak.',
  palette: 'verdant',
  layout: 'force',
  shape: 'path',
  clusters: [
    {
      name: 'A Way of Many Ways',
      subclusters: [
        {
          id: 'historic-routes',
          label: 'Historic routes',
          description: 'There is no single road: only rivers of footsteps joining, parting, and carrying old hopes toward the western horizon.',
          concepts: [
            {
              title: 'Camino Franc\u00e9s',
              description: 'The best-known Jacobean route across northern Spain; UNESCO describes its roughly 738-kilometre Spanish course as the primary trans-Iberian way by the eleventh century.',
              tags: ['route', 'UNESCO', 'Spain'],
            },
            {
              title: 'Camino Primitivo',
              description: 'The Primitive Way is associated with the earliest devotees who travelled from the Asturian kingdom toward the newly identified shrine in Galicia.',
              tags: ['route', 'Asturias', 'early Camino'],
            },
            {
              title: 'Northern Routes',
              description: 'Coastal, Basque Country\u2013La Rioja interior, Li\u00e9bana, and related northern itineraries preserve some of the earliest Jacobean paths.',
              tags: ['route network', 'northern Spain', 'UNESCO'],
            },
            {
              title: 'Fisterra and Mux\u00eda Way',
              description: 'Unlike the roads aimed at Compostela, this Galician extension begins in Santiago and continues west to Cape Fisterra and the sanctuary at Mux\u00eda.',
              tags: ['route', 'Atlantic', 'Galicia'],
            },
          ],
        },
        {
          id: 'crossings-confluences',
          label: 'Crossings & confluences',
          description: 'Cross the high passes and old bridges where strangers become companions and every threshold changes the journey.',
          concepts: [
            {
              title: 'Roncesvalles',
              description: 'A major western Pyrenean gateway for the Camino Franc\u00e9s as it enters Spain from France through Navarre.',
              tags: ['Pyrenees', 'gateway', 'Navarre'],
            },
            {
              title: 'O Cebreiro',
              description: 'A high mountain village and symbolic threshold where the Camino Franc\u00e9s enters Galicia.',
              tags: ['mountain', 'threshold', 'Galicia'],
            },
            {
              title: 'Puente la Reina',
              description: 'A celebrated bridge-town near the point west of Pamplona where approaches from the Roncesvalles and Somport crossings converge.',
              tags: ['bridge', 'confluence', 'Navarre'],
            },
            {
              title: 'Somport Pass',
              description: 'The high central Pyrenean crossing used by the Arles route; its Spanish approach joins the Roncesvalles stream shortly before Puente la Reina.',
              tags: ['Pyrenees', 'gateway', 'Arles route'],
            },
          ],
        },
      ],
    },
    {
      name: 'Signs, Steps & Proof',
      subclusters: [
        {
          id: 'wayshowing-symbols',
          label: 'Wayshowing & symbols',
          description: 'Read the road’s secret alphabet—shell, arrow, cairn, and cross—left for travellers not yet arrived.',
          concepts: [
            {
              title: 'Scallop Shell',
              description: 'The historic badge of the Jacobean pilgrim; its radiating grooves became an apt image of many roads converging on one destination.',
              tags: ['symbol', 'pilgrim badge', 'Jacobean'],
            },
            {
              title: 'Yellow Arrow',
              description: 'The Camino\u2019s familiar modern directional mark, repeated along paths, roads, walls, and trail furniture.',
              tags: ['wayfinding', 'modern Camino', 'marker'],
            },
            {
              title: 'Stone Cairn',
              description: 'A vernacular marker and token left by walkers; evocative and communal, though not a substitute for official route signs.',
              tags: ['wayfinding', 'ritual', 'landscape'],
            },
            {
              title: 'Roadside Cross',
              description: 'Crosses punctuate historic routes as places of orientation, memory, prayer, and arrival; UNESCO includes them among characteristic Camino structures.',
              tags: ['devotion', 'landmark', 'heritage'],
            },
          ],
        },
        {
          id: 'credential-completion',
          label: 'Credential & completion',
          description: 'The journey accumulates a documentary trace as the walker moves from welcome to welcome.',
          concepts: [
            {
              title: 'Credencial',
              description: 'The pilgrim passport identifies its bearer, records the journey, supports access to participating pilgrim accommodation, and is presented when requesting the Compostela.',
              tags: ['pilgrim passport', 'document', 'hospitality'],
            },
            {
              title: 'Sellos',
              description: 'Dated stamps gathered in the credencial from churches, albergues, caf\u00e9s, and other waypoints create a portable record of passage.',
              tags: ['stamps', 'ritual', 'record'],
            },
            {
              title: 'Compostela',
              description: 'The Cathedral\u2019s traditional Latin certificate for a qualifying religious or spiritual pilgrimage; current requirements belong to the official Pilgrim Office.',
              tags: ['certificate', 'arrival', 'Cathedral of Santiago'],
            },
            {
              title: 'Pilgrim Reception Office',
              description: 'The Cathedral-run office in Santiago places the final stamp in the credencial and issues the Compostela to qualifying pilgrims.',
              tags: ['welcome', 'Santiago', 'pilgrim services'],
            },
          ],
        },
      ],
    },
    {
      name: 'The Road That Welcomes',
      subclusters: [
        {
          id: 'houses-of-welcome',
          label: 'Houses of welcome',
          description: 'Religious and civic institutions receive the traveller in distinct but overlapping ways.',
          concepts: [
            {
              title: 'Albergue',
              description: 'A communal pilgrim hostel, usually simple and social, organized around the rhythm of one-night walking stages.',
              tags: ['lodging', 'community', 'modern Camino'],
            },
            {
              title: 'Medieval Pilgrim Hospital',
              description: 'A lodging-and-care foundation for travellers; here hospital includes hospitality, protection, and bodily care rather than only modern clinical treatment.',
              tags: ['hospitality', 'care', 'medieval'],
            },
            {
              title: 'Monastic Guesthouse',
              description: 'Hospitality offered by a stable religious community, often combining lodging with silence, prayer, and a shared daily rhythm.',
              tags: ['monastery', 'hospitality', 'contemplation'],
            },
            {
              title: 'Hospital Real',
              description: 'Founded by the Catholic Monarchs to receive and care for pilgrims in Santiago, its historic building on Praza do Obradoiro is now a parador hotel.',
              tags: ['Santiago', 'historic hospital', 'Obradoiro'],
            },
          ],
        },
        {
          id: 'commons-of-the-road',
          label: 'Commons of the road',
          description: 'Seek the small mercies that make a road humane: cold water, a safe crossing, a place at the table, a light still burning.',
          concepts: [
            {
              title: 'Shared Table',
              description: 'A temporary community forms when strangers cook, eat, and exchange stories at the end of a stage.',
              tags: ['food', 'community', 'encounter'],
            },
            {
              title: 'Pilgrim Bridge',
              description: 'A crossing built or maintained to reduce danger and connect the route; UNESCO treats bridges as essential Camino heritage.',
              tags: ['infrastructure', 'crossing', 'heritage'],
            },
            {
              title: 'Roadside Fountain',
              description: 'Water becomes practical mercy on a long stage: a small piece of infrastructure that can determine whether the road is humane.',
              tags: ['water', 'care', 'infrastructure'],
              portal: {
                scene: 'francis',
                focus: 'subcluster:canticle-heavens',
                label: 'Follow Sister Water into the Canticle',
              },
            },
            {
              title: 'Pilgrimage Church',
              description: 'A sanctuary designed to receive moving crowds, offer worship, and connect a local shrine or relic to the wider route network.',
              tags: ['sanctuary', 'architecture', 'worship'],
            },
          ],
        },
      ],
    },
    {
      name: 'Cloister & Street',
      subclusters: [
        {
          id: 'monastic-lineages',
          label: 'Monastic lineages',
          description: 'Stable communities organize life around monastery, common prayer, work, and hospitality.',
          concepts: [
            {
              title: 'Benedictine Monasteries',
              description: 'Communities shaped by the Rule of Saint Benedict and the monastic principle of stability; many houses offered hospitality to travellers.',
              tags: ['monastic', 'Rule of Saint Benedict', 'stability'],
            },
            {
              title: 'Cluniac Network',
              description: 'Cluniac houses formed a reform network within the Benedictine tradition, not a mendicant order, and helped circulate liturgy, art, people, and ideas across medieval Europe.',
              tags: ['monastic', 'Benedictine reform', 'exchange'],
            },
            {
              title: 'Cistercian Houses',
              description: 'A reforming monastic lineage growing from Benedictine observance, associated with stable communities, disciplined common life, and worked rural landscapes.',
              tags: ['monastic', 'reform', 'landscape'],
            },
            {
              title: 'Abbey of Samos',
              description: 'An active Benedictine monastery on the Galician Camino landscape whose position near the road made it a longstanding place of pilgrim rest and hospitality.',
              tags: ['Benedictine', 'Galicia', 'hospitality'],
            },
          ],
        },
        {
          id: 'mendicant-orders',
          label: 'Mendicant orders',
          description: 'Friars oriented toward evangelical poverty, mobility, preaching, and the social worlds of towns rather than classical monastic stability.',
          concepts: [
            {
              title: 'Franciscan Friars',
              description: 'The Order of Friars Minor founded by Francis of Assisi is a mendicant fraternity, not a monastic order; its early charism joins mobility, fraternity, mission, and evangelical poverty.',
              tags: ['mendicant', 'Friars Minor', 'Francis of Assisi'],
              portal: {
                scene: 'francis',
                focus: 'subcluster:franciscan-family',
                label: 'Enter the Franciscan family',
              },
            },
            {
              title: 'Dominican Friars',
              description: 'The Order of Preachers founded by Dominic is likewise mendicant, organizing prayer, study, community, and mobile preaching rather than monastic stability.',
              tags: ['mendicant', 'Order of Preachers', 'Dominic'],
            },
            {
              title: 'Augustinian Friars',
              description: 'The Order of Saint Augustine belongs to the mendicant family; these friars should not be conflated with the distinct Augustinian Canons Regular.',
              tags: ['mendicant', 'Augustinian', 'friars'],
            },
            {
              title: 'Carmelite Friars',
              description: 'Originating in an eremitical community on Mount Carmel, the Carmelites developed in Europe as a mendicant order while retaining a strong contemplative emphasis.',
              tags: ['mendicant', 'Carmelite', 'contemplation'],
            },
          ],
        },
      ],
    },
    {
      name: 'Gateways & Arrival',
      subclusters: [
        {
          id: 'compostela-arrival',
          label: 'Compostela arrival',
          description: 'The distributed road compresses into a tomb, cathedral, sculpted threshold, and city square.',
          concepts: [
            {
              title: 'Santiago Cathedral',
              description: 'The cathedral around which the pilgrimage city formed and the principal architectural focus of arrival in Compostela.',
              tags: ['cathedral', 'Santiago', 'arrival'],
            },
            {
              title: 'Tomb of Saint James',
              description: 'The tomb believed to be that of James the Greater was identified in Galicia in the ninth century and became the route network\u2019s ultimate destination.',
              tags: ['shrine', 'James the Greater', 'destination'],
            },
            {
              title: 'P\u00f3rtico da Gloria',
              description: 'Master Mateo\u2019s Romanesque sculptural portal presents arrival as passage into a densely populated sacred cosmos.',
              tags: ['Romanesque', 'Master Mateo', 'sculpture'],
            },
            {
              title: 'Praza do Obradoiro',
              description: 'The broad square before the cathedral\u2019s Baroque western fa\u00e7ade acts as the Camino\u2019s civic stage for recognition, reunion, rest, and celebration.',
              tags: ['public space', 'Santiago', 'arrival'],
            },
          ],
        },
        {
          id: 'french-gateways',
          label: 'French gateways',
          description: 'Four symbolic French gathering points feed routes across the Pyrenees into the wider Camino network.',
          concepts: [
            {
              title: 'Le Puy-en-Velay',
              description: 'One of UNESCO\u2019s four symbolic French departures and the center of the route commonly called the Via Podiensis.',
              tags: ['France', 'departure', 'Via Podiensis'],
            },
            {
              title: 'V\u00e9zelay',
              description: 'The abbey hill at V\u00e9zelay is a symbolic departure point for the route commonly called the Via Lemovicensis.',
              tags: ['France', 'departure', 'Via Lemovicensis'],
            },
            {
              title: 'Arles',
              description: 'The southern French departure associated with the Via Tolosana reaches Spain by the Somport crossing before joining other approaches.',
              tags: ['France', 'departure', 'Via Tolosana'],
            },
            {
              title: 'Paris and Tours',
              description: 'Paris is UNESCO\u2019s fourth symbolic French departure; its southbound stream is conventionally associated with Tours and the Via Turonensis.',
              tags: ['France', 'departure', 'Via Turonensis'],
            },
          ],
        },
      ],
    },
  ],
  crossLinks: [
    ['Camino Fran\u00e9s', 'Roncesvalles'],
    ['Camino Fran\u00e9s', 'O Cebreiro'],
    ['Camino Fran\u00e9s', 'Puente la Reina'],
    ['Camino Primitivo', 'Tomb of Saint James'],
    ['Northern Routes', 'Abbey of Samos'],
    ['Fisterra and Mux\u00eda Way', 'Praza do Obradoiro'],
    ['Arles', 'Somport Pass'],
    ['Somport Pass', 'Puente la Reina'],
    ['Scallop Shell', 'Credencial'],
    ['Sellos', 'Credencial'],
    ['Compostela', 'Tomb of Saint James'],
    ['Credencial', 'Albergue'],
    ['Pilgrim Reception Office', 'Praza do Obradoiro'],
    ['Albergue', 'Shared Table'],
    ['Medieval Pilgrim Hospital', 'Pilgrim Bridge'],
    ['Monastic Guesthouse', 'Benedictine Monasteries'],
    ['Roadside Fountain', 'O Cebreiro'],
    ['Pilgrimage Church', 'Roadside Cross'],
    ['Cluniac Network', 'Camino Fran\u00e9s'],
    ['Abbey of Samos', 'Benedictine Monasteries'],
    ['Franciscan Friars', 'Shared Table'],
    ['Santiago Cathedral', 'P\u00f3rtico da Gloria'],
    ['Santiago Cathedral', 'Tomb of Saint James'],
    ['Le Puy-en-Velay', 'Camino Franc\u00e9s'],
    ['V\u00e9zelay', 'Camino Franc\u00e9s'],
    ['Paris and Tours', 'Camino Franc\u00e9s'],
  ],
  sources: [
    'https://whc.unesco.org/en/list/669/',
    'https://whc.unesco.org/en/list/868',
    'https://www.caminodesantiago.gal/en/make-plans/the-ways',
    'https://www.caminodesantiago.gal/es/recurso/4491/locale/',
    'https://oficinadelperegrino.com/en/',
    'https://oficinadelperegrino.com/preparacion/planificacion/',
    'https://www.vatican.va/content/benedict-xvi/en/audiences/2010/documents/hf_ben-xvi_aud_20100113.html',
    'https://www.vatican.va/content/leo-xiv/en/apost_exhortations/documents/20251004-dilexi-te.html',
  ],
};

export const pilgrimScene: GraphScene = buildScene(pilgrimSeed);
