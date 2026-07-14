import { buildScene, type SceneSeed } from '../sceneBuilder';

const seed: SceneSeed = {
  id: 'francis',
  title: 'Francis of Assisi and the Wild Kinship of Things',
  shortTitle: 'Francis of Assisi',
  kicker: 'BROTHER SUN · SISTER WATER',
  description: 'Walk out from Assisi with empty hands: meet sun, water, wolf, leper, sultan, and a family still gathering across the centuries.',
  palette: 'ember',
  layout: 'radial',
  shape: 'radial',
  clusters: [
    {
      name: 'Conversion and Life',
      subclusters: [
        {
          id: 'conversion',
          label: 'From Assisi to Conversion',
          description: 'Begin where the bright dream of knighthood breaks—and a stranger, poorer road opens among the forgotten.',
          concepts: [
            {
              title: 'Merchant\'s Son in Assisi',
              description: 'Born around 1181–82 into the prosperous cloth-merchant family of Pietro Bernardone, Francis grew up amid urban commerce and dreams of chivalry.',
              tags: ['history', 'Assisi', 'youth'],
            },
            {
              title: 'War, Captivity, and Illness',
              description: 'Military defeat against Perugia, imprisonment, and illness unsettled Francis\'s knightly ambitions and began a slow reorientation of his life.',
              tags: ['history', 'Perugia', 'conversion'],
            },
            {
              title: 'The Encounter with the Leper',
              description: 'Francis later remembered that serving people with leprosy transformed what had seemed bitter into sweetness, making mercy central to his conversion.',
              tags: ['early tradition', 'mercy', 'leprosy'],
            },
            {
              title: '“Repair My Church”',
              description: 'Early Franciscan biography places a decisive prayer before the San Damiano crucifix, whose call Francis first answered by repairing ruined chapels.',
              tags: ['early tradition', 'San Damiano', 'vocation'],
            },
            {
              title: 'Renunciation Before the Bishop',
              description: 'Francis publicly surrendered his inheritance and even his clothing, dramatizing a radical break with wealth, status, and paternal control.',
              tags: ['history', 'early tradition', 'poverty'],
            },
          ],
        },
        {
          id: 'gospel-path',
          label: 'The Gospel Path',
          description: 'Follow the barefoot experiment: no throne, no hoard, only companions and a Gospel carried into the street.',
          concepts: [
            {
              title: 'The Gospel at the Portiuncula',
              description: 'Hearing Christ send the disciples without possessions clarified Francis\'s vocation: poverty, itinerant preaching, work, and peace.',
              tags: ['history', 'early tradition', 'Portiuncula'],
            },
            {
              title: 'Lady Poverty and Minority',
              description: 'Poverty meant freedom from possession, while “minority” meant choosing the lesser place and living fraternally among ordinary people.',
              tags: ['spiritual theme', 'poverty', 'minority'],
            },
            {
              title: 'First Brothers and Rome',
              description: 'Companions gathered around Francis, and their simple form of Gospel life received oral papal approval from Innocent III around 1209–10.',
              tags: ['history', 'Friars Minor', 'Innocent III'],
            },
            {
              title: 'La Verna to the Transitus',
              description: 'Franciscan sources report the stigmata at La Verna in 1224; gravely ill, Francis died at the Portiuncula on 3 October 1226.',
              tags: ['history', 'devotional claim', 'La Verna', 'transitus'],
            },
          ],
        },
      ],
    },
    {
      name: 'Canticle of the Creatures',
      subclusters: [
        {
          id: 'canticle-heavens',
          label: 'A Kinship of the Heavens',
          description: 'Look up. Sun, moon, wind, and water return as kin, and the world becomes a chorus before it becomes a possession.',
          concepts: [
            {
              title: 'A Song Born at San Damiano',
              description: 'Nearly blind and seriously ill, Francis composed most of the vernacular Canticle at San Damiano in 1225, turning suffering toward praise.',
              tags: ['history', 'Canticle', 'San Damiano'],
            },
            {
              title: 'Brother Sun',
              description: 'Radiant, beautiful, and suggestive of the Most High, the sun becomes a brother rather than an object owned by humanity.',
              tags: ['primary text', 'sun', 'kinship'],
            },
            {
              title: 'Sister Moon and the Stars',
              description: 'Moon and stars are praised as clear, precious, and beautiful, filling the night with ordered wonder.',
              tags: ['primary text', 'moon', 'stars'],
            },
            {
              title: 'Brother Wind and Weather',
              description: 'Air, cloud, calm, and every weather condition sustain creaturely life, widening the Canticle beyond pleasant or controllable nature.',
              tags: ['primary text', 'air', 'weather'],
            },
            {
              title: 'Sister Water',
              description: 'Water is praised as useful, humble, precious, and pure—a compact union of ecological necessity and spiritual symbolism.',
              tags: ['primary text', 'water', 'ecology'],
            },
          ],
        },
        {
          id: 'canticle-earth',
          label: 'Earth, Reconciliation, and Mortality',
          description: 'Fire and earth join forgiveness and death in a song broad enough to hold beauty, conflict, frailty, and loss.',
          concepts: [
            {
              title: 'Brother Fire',
              description: 'Beautiful, playful, robust, and strong, fire illuminates the night while retaining an elemental power humans do not own.',
              tags: ['primary text', 'fire', 'night'],
            },
            {
              title: 'Sister Mother Earth',
              description: 'Earth sustains and governs life, producing fruits, flowers, and herbs; kinship and dependence coexist in one image.',
              tags: ['primary text', 'earth', 'ecology'],
            },
            {
              title: 'The Verse of Pardon',
              description: 'A later stanza blesses those who forgive and endure in peace, traditionally associated with reconciliation between Assisi\'s bishop and civic leader.',
              tags: ['primary text', 'historical context', 'forgiveness'],
            },
            {
              title: 'Sister Bodily Death',
              description: 'Near death, Francis added mortality to creation\'s family, confronting finitude without pretending it is painless or avoidable.',
              tags: ['primary text', 'death', 'transitus'],
            },
          ],
        },
      ],
    },
    {
      name: 'Brother Wolf and Animal Traditions',
      subclusters: [
        {
          id: 'wolf-gubbio',
          label: 'The Wolf of Gubbio',
          description: 'Enter Gubbio, where a feared wolf waits beyond the walls and peace must answer hunger as well as fear.',
          concepts: [
            {
              title: 'The Little Flowers',
              description: 'The wolf story appears in The Little Flowers of Saint Francis, a fourteenth-century collection written well after Francis\'s lifetime—not a contemporary chronicle.',
              tags: ['legend', 'late source', 'Little Flowers'],
            },
            {
              title: 'A Town Held by Fear',
              description: 'In the legend, a ravenous wolf terrorizes Gubbio while fearful residents answer the threat with weapons and isolation.',
              tags: ['legend', 'Gubbio', 'fear'],
            },
            {
              title: 'Francis Crosses the Boundary',
              description: 'Francis walks outside the city and addresses the attacker as “Brother Wolf,” recognizing kinship without denying the creature\'s violence.',
              tags: ['legend', 'Brother Wolf', 'courage'],
            },
            {
              title: 'Hunger, Harm, and a Peace Pact',
              description: 'Francis brokers reciprocal duties: the wolf will cease attacking, while the townspeople will provide food and end their pursuit.',
              tags: ['legend', 'reconciliation', 'covenant'],
            },
            {
              title: 'The Paw-Shake Covenant',
              description: 'The wolf places a paw in Francis\'s hand before the town; the legend says it then lived peacefully in Gubbio for two years.',
              tags: ['legend', 'Gubbio', 'peace'],
            },
          ],
        },
        {
          id: 'animal-family',
          label: 'A Wider Family of Creatures',
          description: 'Early and late animal tales visualize a theological kinship while inviting careful separation of history from hagiography.',
          concepts: [
            {
              title: 'Sermon to the Birds',
              description: 'An early hagiographic tradition portrays Francis preaching to attentive birds, a vivid emblem of a Gospel addressed to all creation.',
              tags: ['hagiographic tradition', 'birds', 'creation'],
            },
            {
              title: 'Greccio\'s Living Nativity',
              description: 'At Greccio in 1223, Francis staged a tangible Christmas commemoration with manger, hay, ox, and donkey, helping popularize the Nativity scene.',
              tags: ['history', 'early tradition', 'Greccio', 'Nativity'],
            },
            {
              title: 'Hares, Fish, Lambs, and Cicadas',
              description: 'Franciscan biographies accumulated stories of animals responding to Francis; they express spiritual meaning more reliably than zoological history.',
              tags: ['hagiographic tradition', 'animals', 'symbolism'],
            },
            {
              title: 'More Than an “Animal Saint”',
              description: 'Francis\'s creaturely kinship grows from praise of the Creator, humility, and care for the vulnerable—not merely affection for picturesque nature.',
              tags: ['interpretation', 'kinship', 'ecology'],
            },
          ],
        },
      ],
    },
    {
      name: 'Encounters, Peace, and Pilgrimage',
      subclusters: [
        {
          id: 'damietta',
          label: 'Across the Lines at Damietta',
          description: 'Francis enters the conflict of the Fifth Crusade without a weapon and meets the Ayyubid sultan al-Kamil.',
          concepts: [
            {
              title: 'The Fifth Crusade',
              description: 'Francis reached Egypt in 1219 amid the Christian siege of Damietta, where war, preaching, diplomacy, and religious rivalry converged.',
              tags: ['history', 'Damietta', 'Fifth Crusade'],
            },
            {
              title: 'Crossing the Battle Lines',
              description: 'Francis entered the Muslim camp without military power, a risky encounter contrasting personal witness with crusading violence.',
              tags: ['history', 'peacemaking', 'encounter'],
            },
            {
              title: 'Sultan al-Kamil',
              description: 'The Ayyubid ruler al-Malik al-Kamil received Francis. The meeting is historically attested, though their precise conversations remain uncertain.',
              tags: ['history', 'al-Kamil', 'Ayyubids'],
            },
            {
              title: 'Witness and Dialogue',
              description: 'Later memory sometimes oversimplifies the encounter; its durable value lies in courageous contact across demonized boundaries and reciprocal human recognition.',
              tags: ['history', 'interpretation', 'interreligious dialogue'],
            },
            {
              title: 'Among Muslims: Two Ways',
              description: 'Francis\'s Earlier Rule lets friars live peacefully and humbly among Muslims or proclaim explicitly when appropriate—an unusually nuanced missionary framework for its age.',
              tags: ['primary text', 'Earlier Rule', 'Muslim-Christian relations'],
            },
          ],
        },
        {
          id: 'pilgrimage-places',
          label: 'A Geography of Pilgrimage',
          description: 'Assisi, La Verna, and the Holy Land form a sacred geography, with a portal into a wider atlas of pilgrimage routes.',
          concepts: [
            {
              title: 'The Assisi Constellation',
              description: 'San Damiano, the Portiuncula, Rivo Torto, the bishop\'s palace, and Francis\'s tomb turn one Umbrian landscape into a walkable biography.',
              tags: ['place', 'Assisi', 'pilgrimage'],
            },
            {
              title: 'La Verna',
              description: 'The mountain hermitage joins solitude, prayer, bodily suffering, and the 1224 stigmata tradition in a dramatic Tuscan setting.',
              tags: ['place', 'La Verna', 'hermitage'],
            },
            {
              title: 'Toward the Holy Land',
              description: 'Francis appears to have traveled onward toward the Holy Land; later friars developed the enduring Franciscan Custody of Christian holy places.',
              tags: ['history', 'legacy', 'Holy Land'],
            },
            {
              title: 'Camino de Santiago Portal',
              description: 'Explore routes, hospitality, symbols, and transformation. Later tradition links Francis to Santiago, but firm historical evidence for that journey is lacking.',
              tags: ['portal', 'pilgrimage', 'historical caution', 'Camino de Santiago'],
              portal: { scene: 'pilgrim', focus: 'subcluster:historic-routes', label: 'Walk the Camino routes' },
            },
          ],
        },
      ],
    },
    {
      name: 'Franciscan Movement and Legacy',
      subclusters: [
        {
          id: 'franciscan-family',
          label: 'A Family of Gospel Life',
          description: 'Friars, contemplative sisters, and lay penitents give distinct forms to one Franciscan intuition.',
          concepts: [
            {
              title: 'Order of Friars Minor',
              description: 'The brothers became mendicant friars—mobile preachers and servants rather than cloistered monks—organized around poverty, fraternity, work, and mission.',
              tags: ['history', 'mendicant friars', 'OFM'],
            },
            {
              title: 'Clare and the Poor Clares',
              description: 'Clare of Assisi shaped a contemplative Franciscan expression at San Damiano, insisting with remarkable determination on corporate poverty.',
              tags: ['history', 'Clare of Assisi', 'Poor Clares'],
            },
            {
              title: 'The Secular Franciscan Family',
              description: 'Penitential communities associated with Francis enabled laypeople to pursue Franciscan spirituality within household, civic, and working life.',
              tags: ['history', 'development', 'lay movement'],
            },
            {
              title: 'The Approved Rule of 1223',
              description: 'Honorius III confirmed the Later Rule, giving durable institutional form to a movement that had begun as an improvised Gospel brotherhood.',
              tags: ['history', 'primary text', 'Honorius III'],
            },
            {
              title: 'Charism Meets Institution',
              description: 'Rapid expansion required ministers, chapters, rules, missions, and negotiation over poverty—creative tensions that continued after Francis relinquished daily leadership.',
              tags: ['history', 'governance', 'Franciscan movement'],
            },
          ],
        },
        {
          id: 'living-legacy',
          label: 'A Living and Contested Legacy',
          description: 'Pilgrimage, ecology, interfaith encounter, and the wider map of religious orders keep Francis\'s legacy active and debated.',
          concepts: [
            {
              title: 'Canonization and the Basilica',
              description: 'Gregory IX canonized Francis in 1228; the great Assisi basilica and its art became an international pilgrimage center.',
              tags: ['history', 'Basilica of Saint Francis', 'pilgrimage'],
            },
            {
              title: 'Laudato Si’ and Integral Ecology',
              description: 'Pope Francis\'s 2015 encyclical takes its title from the Canticle and connects ecological damage with poverty, justice, relationship, and responsibility.',
              tags: ['modern legacy', 'Laudato Si', 'integral ecology'],
            },
            {
              title: 'A Modern Icon of Peace',
              description: 'Assisi and the encounter with al-Kamil continue to inspire interreligious dialogue, peacemaking, and resistance to treating another faith as a faceless enemy.',
              tags: ['modern legacy', 'peace', 'interfaith'],
            },
            {
              title: 'Religious Orders Atlas',
              description: 'Compare Franciscans with Dominicans and older monastic families such as Benedictines, Cistercians, and Camaldolese while distinguishing friars from monks.',
              tags: ['portal', 'religious orders', 'mendicant', 'monastic'],
              portal: { scene: 'pilgrim', focus: 'subcluster:mendicant-orders', label: 'Explore religious families' },
            },
          ],
        },
      ],
    },
  ],
  crossLinks: [
    ['War, Captivity, and Illness', 'The Fifth Crusade'],
    ['The Encounter with the Leper', 'More Than an “Animal Saint”'],
    ['“Repair My Church”', 'A Song Born at San Damiano'],
    ['Renunciation Before the Bishop', 'Lady Poverty and Minority'],
    ['The Gospel at the Portiuncula', 'Order of Friars Minor'],
    ['First Brothers and Rome', 'The Approved Rule of 1223'],
    ['La Verna to the Transitus', 'La Verna'],
    ['La Verna to the Transitus', 'Sister Bodily Death'],
    ['Brother Sun', 'Laudato Si’ and Integral Ecology'],
    ['Sister Water', 'Laudato Si’ and Integral Ecology'],
    ['Sister Mother Earth', 'Laudato Si’ and Integral Ecology'],
    ['The Verse of Pardon', 'Hunger, Harm, and a Peace Pact'],
    ['The Verse of Pardon', 'A Modern Icon of Peace'],
    ['Francis Crosses the Boundary', 'Crossing the Battle Lines'],
    ['Hunger, Harm, and a Peace Pact', 'Witness and Dialogue'],
    ['Sermon to the Birds', 'Brother Sun'],
    ['Greccio\'s Living Nativity', 'The Assisi Constellation'],
    ['Sultan al-Kamil', 'A Modern Icon of Peace'],
    ['Among Muslims: Two Ways', 'Order of Friars Minor'],
    ['The Assisi Constellation', 'Camino de Santiago Portal'],
    ['Toward the Holy Land', 'Camino de Santiago Portal'],
    ['Toward the Holy Land', 'Religious Orders Atlas'],
    ['Clare and the Poor Clares', 'A Song Born at San Damiano'],
    ['The Secular Franciscan Family', 'Laudato Si’ and Integral Ecology'],
    ['Order of Friars Minor', 'Religious Orders Atlas'],
  ],
  sources: [
    'https://www.vatican.va/content/benedict-xvi/en/audiences/2010/documents/hf_ben-xvi_aud_20100127.html',
    'https://ofm.org/en/opening-of-the-centenary-of-the-canticle-of-the-creatures.html',
    'https://ofm.org/uploads/Lettera_Famiglia_Francescana_Centenario_Cantico_EN.pdf',
    'https://www.capdox.capuchin.org.au/legislation/the-unconfirmed-first-rule-of-st-francis/',
    'https://www.franciscanmedia.org/st-anthony-messenger/st-francis-and-the-taming-of-the-wolf/',
    'https://www.britannica.com/biography/Saint-Francis-of-Assisi',
  ],
};

export const francisScene = buildScene(seed);
