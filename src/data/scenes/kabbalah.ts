import { buildScene, type SceneSeed } from '../sceneBuilder';

const seed = {
  id: 'kabbalah',
  title: 'Kabbalah and the Shattered Vessels of Light',
  shortTitle: 'Kabbalah',
  kicker: 'INFINITY · EXILE · REPAIR',
  description:
    'Step carefully into a many-layered tradition of hidden light, living texts, shattered vessels, wandering sparks, and the patient work of repair.',
  palette: 'violet',
  layout: 'lattice',
  shape: 'tree',
  clusters: [
    {
      name: 'Divine Infinity and the Four Worlds',
      subclusters: [
        {
          id: 'infinite-and-manifest',
          label: 'Infinite and manifest',
          description: 'Approach the horizon where the infinite hides in order that a finite world might appear.',
          concepts: [
            {
              title: 'Ein Sof',
              description: '“Without End”; a designation for the divine as infinite and beyond human comprehension.',
            },
            {
              title: 'Or Ein Sof',
              description: '“Light of Ein Sof”; later kabbalistic language for limitless divine illumination.',
            },
            {
              title: 'Sefirot',
              description: 'Ten interrelated emanations or attributes through which divine life becomes manifest—not separate gods.',
            },
            {
              title: 'Shekhinah',
              description: 'The indwelling divine presence, frequently associated in Kabbalah with Malkhut.',
            },
            {
              title: 'Shefa',
              description: 'The flow of divine vitality or blessing through the sefirot and worlds.',
            },
          ],
        },
        {
          id: 'four-worlds',
          label: 'The four worlds',
          description: 'Climb four interwoven worlds, from nearness and emanation toward the dense wonder of embodied life.',
          concepts: [
            {
              title: 'Atzilut',
              description: '“Emanation”; the highest of the standard four worlds, nearest the divine source.',
            },
            {
              title: 'Beriah',
              description: '“Creation”; a world associated with the first emergence of created being.',
            },
            {
              title: 'Yetzirah',
              description: '“Formation”; a world associated with shaping and differentiation.',
            },
            {
              title: 'Assiyah',
              description: '“Action”; the lowest world, encompassing action and, in many accounts, material existence.',
            },
          ],
        },
      ],
    },
    {
      name: 'The Ten Sefirot',
      subclusters: [
        {
          id: 'crown-intellect-balance',
          label: 'Crown, intellect, and balance',
          description: 'Sefirot associated with divine will, intellect, expansive and restraining powers, and their harmony.',
          concepts: [
            {
              title: 'Keter',
              description: '“Crown”; the highest sefira, associated with divine will and a source beyond articulated thought.',
            },
            {
              title: 'Chokhmah',
              description: '“Wisdom”; intuitive or seminal insight before it becomes fully developed.',
            },
            {
              title: 'Binah',
              description: '“Understanding”; differentiation and development of insight into intelligible form.',
            },
            {
              title: 'Chesed',
              description: '“Lovingkindness”; expansive generosity and giving.',
            },
            {
              title: 'Gevurah',
              description: '“Strength” or “judgment”; boundary, restraint, and disciplined power.',
            },
            {
              title: 'Tiferet',
              description: '“Beauty”; a harmonizing center often balancing Chesed and Gevurah.',
            },
          ],
        },
        {
          id: 'endurance-channel-presence',
          label: 'Endurance, channel, and presence',
          description: 'The lower sefirot as persistence, receptive form, transmission, and manifestation.',
          concepts: [
            {
              title: 'Netzach',
              description: '“Endurance” or “victory”; persistence and active drive.',
            },
            {
              title: 'Hod',
              description: '“Splendor”; receptivity, acknowledgment, and disciplined form.',
            },
            {
              title: 'Yesod',
              description: '“Foundation”; a channel that gathers and transmits the preceding forces.',
            },
            {
              title: 'Malkhut',
              description: '“Kingship”; manifestation and receptivity, commonly linked with the Shekhinah.',
            },
          ],
        },
      ],
    },
    {
      name: 'Foundational Texts and Safed',
      subclusters: [
        {
          id: 'texts-and-commentaries',
          label: 'Texts and commentaries',
          description: 'Influential works through which distinct currents of Jewish mysticism developed and circulated.',
          concepts: [
            {
              title: 'Sefer Yetzirah',
              description: 'An early, cryptic work of creation mysticism centered on ten sefirot and twenty-two Hebrew letters; influential on later Kabbalah but conceptually distinct from it.',
            },
            {
              title: 'Sefer ha-Bahir',
              description: 'An early medieval kabbalistic text that helped develop dynamic sefirotic and feminine divine symbolism.',
            },
            {
              title: 'Zohar',
              description: 'A foundational Aramaic corpus of mystical Torah interpretation that emerged in late-thirteenth-century Spain.',
            },
            {
              title: 'Tikkunei Zohar',
              description: 'A Zoharic work organized around seventy interpretations of the Torah’s opening word, Bereshit.',
            },
            {
              title: 'Pardes Rimonim',
              description: 'Moses Cordovero’s major systematic synthesis of earlier kabbalistic teachings.',
            },
          ],
        },
        {
          id: 'safed-and-transmission',
          label: 'Safed and transmission',
          description: 'The sixteenth-century Galilean center and teachers who transformed the history of Kabbalah.',
          concepts: [
            {
              title: 'Safed',
              description: 'The Galilean city that became a major center of Jewish law, poetry, and mysticism in the sixteenth century.',
            },
            {
              title: 'Moses Cordovero',
              description: 'Safed kabbalist who systematized earlier traditions before the rise of Lurianic Kabbalah.',
            },
            {
              title: 'Isaac Luria (the Ari)',
              description: 'Influential Safed teacher whose creation, rupture, and repair teachings reshaped later Kabbalah.',
            },
            {
              title: 'Hayyim Vital',
              description: 'Luria’s leading disciple and an essential transmitter of his largely oral teachings.',
            },
            {
              title: 'Etz Hayyim',
              description: '“Tree of Life”; a principal written presentation of Lurianic teaching transmitted through Vital’s writings.',
            },
          ],
        },
      ],
    },
    {
      name: 'The Lurianic Drama',
      subclusters: [
        {
          id: 'concealment-and-rupture',
          label: 'Concealment and rupture',
          description: 'Enter the great drama: concealment, a measured ray, vessels filled beyond bearing, and the soundless moment they break.',
          concepts: [
            {
              title: 'Tzimtzum',
              description: 'Divine “contraction” or concealment that makes conceptual space for finite existence; later schools debate how literally to understand it.',
            },
            {
              title: 'Reshimu',
              description: 'The residual “trace” of light described as remaining after tzimtzum.',
            },
            {
              title: 'Kav',
              description: 'The measured “line” or ray of divine light entering the space of concealment.',
            },
            {
              title: 'Adam Kadmon',
              description: '“Primordial Human”; a cosmic configuration or world, not a literal human being or separate deity.',
            },
            {
              title: 'Shevirat ha-Kelim',
              description: '“Breaking of the vessels”; the rupture of vessels unable to contain the divine light.',
            },
          ],
        },
        {
          id: 'exile-and-repair',
          label: 'Exile and repair',
          description: 'Search among the fragments for hidden sparks, and ask how an ordinary act might help gather a wounded cosmos.',
          concepts: [
            {
              title: 'Nitzotzot',
              description: 'Divine “sparks” described as scattered or trapped after the vessels break.',
            },
            {
              title: 'Kelipot',
              description: '“Shells” or “husks” that conceal holiness and hold sparks in the Lurianic myth.',
            },
            {
              title: 'Tikkun',
              description: 'Cosmic repair or reordering, advanced through human religious action in Lurianic thought.',
            },
            {
              title: 'Gilgul',
              description: 'Transmigration or reincarnation of souls, elaborated extensively in Safed Kabbalah.',
            },
            {
              title: 'Yichudim',
              description: 'Contemplative “unifications,” often involving prayer and divine names, intended to restore harmony.',
            },
          ],
        },
      ],
    },
    {
      name: 'Historical Roots and Religious Life',
      subclusters: [
        {
          id: 'precursors-and-later-movements',
          label: 'Precursors and later movements',
          description: 'Earlier Jewish mystical currents and later religious movements connected to—but not identical with—Kabbalah.',
          concepts: [
            {
              title: 'Ezekiel’s Chariot Vision',
              description: 'Ezekiel 1’s vision of the divine throne-chariot, a foundational scriptural focus of early Jewish mystical interpretation.',
            },
            {
              title: 'Ma’aseh Bereshit',
              description: '“Work of Creation”; rabbinic and mystical speculation on the mysteries of Genesis.',
            },
            {
              title: 'Hekhalot and Merkavah',
              description: 'Late antique and early medieval heavenly-palace and throne traditions related to, but historically distinct from, medieval Kabbalah.',
            },
            {
              title: 'Hasidei Ashkenaz',
              description: 'Medieval German Jewish pietists whose theology, ethics, and esoteric practices form part of Kabbalah’s wider historical background.',
            },
            {
              title: 'Hasidism',
              description: 'The eighteenth-century movement that reworked kabbalistic ideas around devotion, leadership, prayer, and divine presence in daily life.',
            },
          ],
        },
        {
          id: 'study-prayer-and-action',
          label: 'Study, prayer, and action',
          description: 'Ways kabbalistic ideas enter Jewish interpretation, commandments, intention, devotion, and liturgy.',
          concepts: [
            {
              title: 'Mystical Torah Interpretation',
              description: 'Reading scripture’s language, stories, and commandments as revealing hidden divine processes.',
            },
            {
              title: 'Mitzvot',
              description: 'Commandments that many kabbalists understand as actions affecting harmony in the divine and created worlds.',
            },
            {
              title: 'Kavanah',
              description: 'Focused intention in prayer or ritual; particular schools developed elaborate mystical intentions.',
            },
            {
              title: 'Devekut',
              description: '“Cleaving” to God; sustained devotional attachment, interpreted differently across kabbalistic and Hasidic traditions.',
            },
            {
              title: 'Kabbalat Shabbat',
              description: 'The liturgical welcoming of Shabbat, shaped substantially by the poetic and mystical culture of sixteenth-century Safed.',
            },
          ],
        },
      ],
    },
  ],
  crossLinks: [
    ['Ein Sof', 'Or Ein Sof'],
    ['Or Ein Sof', 'Tzimtzum'],
    ['Tzimtzum', 'Kav'],
    ['Kav', 'Adam Kadmon'],
    ['Or Ein Sof', 'Sefirot'],
    ['Sefirot', 'Atzilut'],
    ['Sefirot', 'Keter'],
    ['Sefirot', 'Malkhut'],
    ['Malkhut', 'Shekhinah'],
    ['Yesod', 'Malkhut'],
    ['Tiferet', 'Malkhut'],
    ['Atzilut', 'Beriah'],
    ['Beriah', 'Yetzirah'],
    ['Yetzirah', 'Assiyah'],
    ['Sefer Yetzirah', 'Sefirot'],
    ['Sefer Yetzirah', 'Ma’aseh Bereshit'],
    ['Sefer ha-Bahir', 'Shekhinah'],
    ['Sefer ha-Bahir', 'Zohar'],
    ['Zohar', 'Moses Cordovero'],
    ['Moses Cordovero', 'Pardes Rimonim'],
    ['Zohar', 'Isaac Luria (the Ari)'],
    ['Isaac Luria (the Ari)', 'Hayyim Vital'],
    ['Hayyim Vital', 'Etz Hayyim'],
    ['Hekhalot and Merkavah', 'Ezekiel’s Chariot Vision'],
    ['Shevirat ha-Kelim', 'Nitzotzot'],
    ['Nitzotzot', 'Kelipot'],
    ['Kelipot', 'Tikkun'],
    ['Tikkun', 'Mitzvot'],
    ['Yichudim', 'Kavanah'],
    ['Safed', 'Kabbalat Shabbat'],
    ['Hasidism', 'Devekut'],
    ['Shefa', 'Yesod'],
    ['Malkhut', 'Assiyah'],
  ],
  sources: [
    'https://www.myjewishlearning.com/article/kabbalah-mysticism-101/',
    'https://www.myjewishlearning.com/article/sefirot/',
    'https://www.myjewishlearning.com/article/the-zohar/',
    'https://www.myjewishlearning.com/article/tikkun-in-lurianic-kabbalah/',
    'https://www.sefaria.org/texts/Kabbalah?set-language-cookie=',
  ],
} satisfies SceneSeed;

export const kabbalahScene = buildScene(seed);
