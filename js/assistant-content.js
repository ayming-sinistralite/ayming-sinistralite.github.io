// ── Contenu de l'assistant « Virginie » ──
//
// CE FICHIER EST LE DISCOURS. Pour changer une phrase, une question ou une offre,
// c'est ici, jamais dans la logique (js/assistant.js remplit les chiffres, choisit
// quels sujets afficher et quelle formulation servir).
//
// Placeholders remplis par le générateur à partir des données du secteur :
//   {sector}      libellé du secteur            {ifWord}     ex. « près de quatre fois »
//   {gravWord}    ex. « de cinq fois »          {topCause}   ex. « la manutention manuelle »
//   {topCausePct} ex. « la moitié »             {secondCause} deuxième cause
//   {atCount}     nb AT en 1er règlement        {mpCount}    nb MP en 1er règlement
//   {trajetCount} nb accidents de trajet        {journeesWord} ex. « près de 34 000 »
//   {ipCount}     nouvelles IP                  {trendWord}  ex. « d'environ un cinquième »
//   {firstYr}     première année de la série
//
// Chaque champ de texte est un TABLEAU de variantes. Le générateur en choisit une
// de façon déterministe à partir du code NAF : deux secteurs ne lisent donc pas la
// même phrase, mais un même secteur reste stable d'une visite à l'autre.
//
// Un champ peut aussi être un OBJET indexé par bande de sévérité (textByBand :
// { severe, high, moderate }). Le générateur choisit d'abord la bande selon l'écart
// à la moyenne, puis une variante dans cette bande. Un secteur quatre fois plus
// exposé et un secteur proche de la moyenne ne se décrivent pas de la même façon.
//
// TON : professionnel et élégant, mais surtout AGRÉABLE À LIRE. On veut que la personne
// ait envie de lire la bulle suivante. De l'esprit dans la formule, une image juste, un
// rythme. Une pointe de légèreté, jamais comique. Le sujet touche des gens qui se
// blessent, on reste sobre sur l'humain. Pas d'argot ni de familiarité (« bobos »,
// « ficelé », « trinque »), pas de sensationnalisme. L'élégance est dans la clarté.
//
// gate  = condition d'affichage du sujet (interprétée dans js/assistant.js) :
//   'always'      toujours (si la donnée existe)
//   'ifHigh'      indice de fréquence nettement au-dessus de la moyenne
//   'gravHigh'    taux de gravité nettement au-dessus de la moyenne
//   'hasCause'    une cause dominante ressort
//   'hasTrend'    une évolution nette sur la série
//   'hasIp'       des incapacités permanentes existent
//   'severeMp'    part de MP à taux IP élevé
//   'hasTiers'    volume de trajet significatif
//
// illus = graphique inline, dessiné par le générateur depuis les vraies valeurs :
//   'ifBars' | 'gravBars' | 'causeBar' | 'spark' | null
//
// Structure d'un sujet :
//   { key, gate, chip:[...], q:[...],
//     bubbles: [ { text:[...] ou textByBand:{...}, illus, level } ],
//     followups: [ { chip:[...], q:[...], bubbles:[{text:[...]}], help:[...], offer:'clé' }, ... ] }
// Chaque sujet porte AU MOINS deux questions de suivi ; chaque suivi se termine sur une offre.

export var ASSISTANT_BASE_URL = 'https://www.ayming.fr';

// Convention UTM. Le générateur ajoute à chaque lien offre :
//   utm_source=sinistralite-app   l'outil qui envoie le trafic
//   utm_medium=chatbot            la surface (un lien partagé utilisera « share »)
//   utm_campaign=sinistralite     l'app comme campagne, jamais l'offre
//   utm_content=<clé de l'offre>  quelle offre a été cliquée (dat-externalisation, ...)
//   utm_term=<naf>                quel secteur convertit
// La campagne parle de l'app ; l'offre, la surface et le secteur sont des dimensions à part.
export var ASSISTANT_UTM = { source: 'sinistralite-app', medium: 'chatbot', campaign: 'sinistralite' };

// Offres reprises de ayming-sitemap.yaml. La CLÉ de chaque offre EST le utm_content
// (slugs des slides). Repo -> libellé officiel, url, description.
export var ASSISTANT_OFFERS = {
  'dat-externalisation': {
    title: 'Déclarer un accident du travail',
    url: '/ressources-humaines/atmp/declarer-un-accident-du-travail/',
    desc: 'Constituer le dossier complet et déclarer dans les délais.'
  },
  'cotisations-atmp': {
    title: 'Maîtriser les cotisations AT/MP',
    url: '/ressources-humaines/couts-rh/cotisations-at-mp/',
    desc: 'Manager et piloter vos AT/MP.'
  },
  'recuperer-ij': {
    title: 'Récupérer les IJ non perçues',
    url: '/ressources-humaines/arrets-de-travail/recuperer-les-ij/',
    desc: 'Identifier les montants non perçus et faciliter les démarches de récupération.'
  },
  'arrets-longue-duree': {
    title: 'Piloter les arrêts longue durée',
    url: '/ressources-humaines/arrets-de-travail/piloter-les-arrets-longue-duree/',
    desc: 'Détecter les arrêts AT supérieurs à 45 jours et suivre leur évolution pour maîtriser les coûts.'
  },
  'duerp': {
    title: 'Évaluer les risques (DUERP)',
    url: '/ressources-humaines/prevention-et-sante-au-travail/evaluer-les-risques-professionnels-duerp/',
    desc: 'Faciliter la mise à jour du DUERP, piloter la priorisation des actions et suivre leur exécution.'
  },
  'questionnaires-maladie-professionnelle': {
    title: 'Traiter un questionnaire de maladie professionnelle',
    url: '/ressources-humaines/atmp/questionnaires-de-maladie-professionnelle/',
    desc: 'Documenter la réponse et être proactif jusqu\'à la décision finale de la CPAM.'
  },
  'accidents-tiers': {
    title: 'Récupérer les coûts des accidents causés par un tiers',
    url: '/ressources-humaines/atmp/accidents-causes-par-un-tiers/',
    desc: 'Identifier les coûts liés à un tiers responsable et faciliter leur récupération.'
  }
};

// Identité affichée dans l'en-tête du panneau.
export var ASSISTANT_PERSONA = {
  name: 'Virginie Brossier',
  role: 'Chef de projets BPO · Expertise AT/MP',
  avatar: 'assets/consultant-brossier.webp'
};

// Renvoi vers « Mon entreprise » (le benchmark, où se trouve le formulaire).
// C'est la conversion principale : l'UI garde cette puce visible en permanence
// (style primaire) et Virginie glisse le nudge une fois, après le premier sujet vu.
export var ASSISTANT_COMPARE = {
  chip: 'Comparer mon entreprise',
  // Phrase de clôture d'un sujet : Virginie invite à comparer avant les deux options.
  invite: ['Voilà pour ce sujet. Le plus parlant maintenant, c\'est d\'y confronter une entreprise réelle. On compare la vôtre à ce secteur ?',
           'C\'est l\'essentiel sur ce point. Pour rendre ces chiffres concrets, comparez une entreprise à ce secteur, je m\'occupe des repères.'],
  // Texte de la carte de renvoi (le générateur remplit le secteur et le libellé).
  handoff: ['Pour situer une entreprise précise face à cette moyenne, direction Mon entreprise, avec ce secteur déjà chargé comme référence.',
            'Une moyenne sectorielle ne dit rien d\'une entreprise donnée. Passons à Mon entreprise, je garde ce secteur en repère et vous placez vos chiffres en face.']
};

// ── Vue AT ──
var AT = {
  intro: [
    { text: ['J\'ai regardé le secteur {sector} de près. Voici ma lecture.',
             'Je me suis penchée sur le secteur {sector}, voici ce que j\'en retiens.',
             'Voici ma lecture du secteur {sector}, sans détour.'] },
    { textByBand: {
        severe: ['C\'est l\'un des métiers les plus exposés de France. Un salarié y est accidenté {ifWord} plus souvent que la moyenne nationale. À ce niveau, le risque n\'est plus un aléa, il est inscrit dans l\'activité.',
                 'Le constat est net, un salarié y est accidenté {ifWord} plus souvent qu\'ailleurs en France. Ce n\'est pas de la malchance, c\'est la nature même de l\'activité.',
                 'Peu de secteurs affichent une telle exposition. Un salarié y est accidenté {ifWord} plus souvent que la moyenne, un niveau où le risque fait partie du métier.'],
        high: ['Ce secteur est nettement plus exposé que la moyenne. Un salarié y est accidenté {ifWord} plus souvent qu\'au niveau national, un écart assez marqué pour mériter qu\'on s\'y arrête.',
               'La sinistralité y dépasse sensiblement la moyenne, un salarié est accidenté {ifWord} plus souvent qu\'ailleurs. L\'écart n\'a rien d\'anecdotique.',
               'On est au-dessus de la moyenne, et pas de peu. Un salarié y est accidenté {ifWord} plus souvent qu\'au niveau national.'],
        elevated: ['Ce secteur est un peu plus exposé que la moyenne. L\'indice de fréquence y dépasse le niveau national de {ifPct}, un écart modéré mais réel.',
                   'L\'exposition y est légèrement au-dessus de la moyenne, de {ifPct}. Rien de spectaculaire, mais assez pour mériter un œil.',
                   'Le secteur dépasse la moyenne nationale de {ifPct} sur la fréquence des accidents. Un écart contenu, qu\'il vaut mieux surveiller que subir.'],
        moderate: ['Sur la fréquence des accidents, ce secteur se tient près de la moyenne nationale. Voici tout de même ce que révèlent ses autres indicateurs.',
                   'Côté fréquence, ce secteur ne se distingue pas particulièrement de la moyenne. Regardons ce que disent ses chiffres de plus près.',
                   'La fréquence des accidents y reste dans les eaux du niveau France. L\'intérêt est ailleurs, dans le détail des chiffres.']
      },
      illus: 'ifBars', level: 'alert' }
  ],
  topics: [
    {
      key: 'gravite', gate: 'gravHigh',
      chip: ['La gravité', 'La gravité des accidents'], q: ['La gravité des accidents'],
      bubbles: [{
        text: ['La fréquence n\'est qu\'une moitié du problème. Quand un accident survient ici, il est lourd, la gravité dépasse {gravWord} la moyenne nationale, et une partie des victimes en garde des séquelles définitives. Ce sont des arrêts longs et de vraies incapacités permanentes, dont les conséquences se comptent en années.',
               'Ici, un accident est rarement bénin. La gravité dépasse {gravWord} la moyenne, et le secteur laisse chaque année des salariés avec une incapacité permanente. Derrière le chiffre, il y a des carrières abîmées.',
               'La gravité, c\'est l\'autre versant du risque. Elle dépasse {gravWord} la moyenne nationale, avec des arrêts qui durent et des séquelles qui restent. Un accident ici se paie longtemps, pour le salarié comme pour l\'entreprise.'],
        illus: 'gravBars', level: 'alert'
      }],
      followups: [
        {
          chip: ['Pourquoi les arrêts longs coûtent-ils si cher ?'],
          q: ['Pourquoi les arrêts longs coûtent-ils si cher ?'],
          bubbles: [{ text: ['Un arrêt long ne se résume pas au salaire maintenu. Il désorganise l\'équipe, mobilise un remplacement, et surtout il alourdit le taux de cotisation pendant trois ans, bien après le retour du salarié.',
                             'Le coût visible, c\'est le salaire versé. Le coût caché, c\'est le taux de cotisation, qu\'un arrêt long tire vers le haut pendant trois années pleines.'] }],
          help: ['C\'est précisément là qu\'on accompagne. Ayming pilote le suivi des arrêts longue durée pour raccourcir leur impact et sécuriser leur imputation.'],
          offer: 'arrets-longue-duree'
        },
        {
          chip: ['Combien ça pèse sur la cotisation ?'],
          q: ['Combien ça pèse sur la cotisation ?'],
          bubbles: [{ text: ['Chaque accident grave gonfle la valeur du risque qui sert de base au taux. Sur un secteur comme celui-ci, quelques dossiers lourds suffisent à faire basculer la cotisation d\'une année sur l\'autre.',
                             'Le taux se nourrit de la gravité. Une poignée d\'accidents sévères pèse plus, dans le calcul, que beaucoup de petits, et se répercute sur la cotisation.'] }],
          help: ['Ayming reconstitue le calcul du taux, traque les erreurs d\'imputation et sécurise chaque poste de coût.'],
          offer: 'cotisations-atmp'
        }
      ]
    },
    {
      key: 'journees', gate: 'always',
      chip: ['Les journées perdues'], q: ['Les journées perdues'],
      bubbles: [{
        text: ['Derrière la fréquence, il y a un coût plus discret, le temps. Le secteur perd chaque année {journeesWord} journées de travail, toutes indemnisées. C\'est de l\'absentéisme subi, qui pèse sur la production autant que sur les comptes.',
               'Chaque accident se paie aussi en jours. Le secteur laisse filer {journeesWord} journées de travail chaque année, toutes indemnisées. La production en pâtit autant que la trésorerie.',
               'Il y a un coût qu\'on oublie souvent, celui du temps. Ce secteur perd {journeesWord} journées de travail par an, toutes indemnisées, autant d\'absentéisme qui grève la production.']
      }],
      followups: [
        {
          chip: ['Toutes les indemnités sont-elles récupérées ?'],
          q: ['Toutes les indemnités sont-elles récupérées ?'],
          bubbles: [{ text: ['Rarement. Entre les erreurs de traitement, les dossiers de prévoyance oubliés et une subrogation mal suivie, une part des indemnités journalières dues n\'arrive jamais dans les comptes de l\'entreprise.',
                             'Presque jamais en totalité. Erreurs de traitement, prévoyance oubliée, subrogation mal suivie, il reste toujours des indemnités dues qui ne reviennent pas.'] }],
          help: ['Ayming cartographie les IJ manquantes, relance la CPAM et les assureurs, et fournit les écritures de régularisation prêtes à charger.'],
          offer: 'recuperer-ij'
        },
        {
          chip: ['Ces arrêts peuvent-ils être raccourcis ?'],
          q: ['Ces arrêts peuvent-ils être raccourcis ?'],
          bubbles: [{ text: ['Souvent, oui. Un arrêt qui s\'éternise faute de suivi coûte plus qu\'un arrêt accompagné, pour l\'entreprise comme pour le salarié. Encore faut-il repérer tôt ceux qui traînent.',
                             'Bien plus qu\'on ne croit. Un arrêt suivi de près se termine plus vite qu\'un arrêt qu\'on laisse filer. Tout se joue sur le repérage précoce.'] }],
          help: ['Ayming détecte les arrêts AT qui dépassent 45 jours et suit leur évolution pour en maîtriser le coût.'],
          offer: 'arrets-longue-duree'
        }
      ]
    },
    {
      key: 'declarations', gate: 'always',
      chip: ['Les déclarations AT'], q: ['Les déclarations AT'],
      bubbles: [{
        text: ['Cette année, {atCount} accidents ont été reconnus en premier règlement dans ce secteur, chacun imputé au compte employeur. Sur ce volume, la qualité de chaque déclaration devient un enjeu financier direct, un dossier mal qualifié se paie pendant trois ans.',
               'Ce sont {atCount} accidents reconnus en premier règlement cette année, autant de dossiers inscrits aux comptes employeurs. À ce volume, une déclaration mal préparée coûte, et pour longtemps.',
               'Le secteur totalise {atCount} accidents reconnus en premier règlement sur l\'année, tous imputés aux employeurs. Chaque déclaration compte, une qualification bâclée pèse trois ans durant.']
      }],
      followups: [
        {
          chip: ['C\'est quoi un premier règlement ?'],
          q: ['C\'est quoi un premier règlement ?'],
          bubbles: [{ text: ['C\'est la première fois que l\'Assurance Maladie indemnise un accident. À cet instant, il entre dans le compte employeur et commence à peser sur le taux, pour trois ans. Un dossier mal qualifié au départ se paie donc longtemps.'] }],
          help: ['C\'est là qu\'Ayming accompagne, en sécurisant la qualification de chaque déclaration et en assurant le suivi du dossier jusqu\'à la décision de prise en charge.'],
          offer: 'dat-externalisation'
        },
        {
          chip: ['Peut-on réduire ce qui est imputé ?'],
          q: ['Peut-on réduire ce qui est imputé ?'],
          bubbles: [{ text: ['En partie, oui. Une déclaration bien préparée, des réserves motivées à temps, une qualification juste, et le dossier pèse souvent moins sur le compte employeur.',
                             'Souvent, oui. Des réserves posées à temps et une qualification exacte maximisent les chances que le dossier pèse moins sur le compte employeur.'] }],
          help: ['C\'est le métier d\'Ayming, sécuriser la déclaration au départ et en assurer le suivi jusqu\'à la décision de prise en charge.'],
          offer: 'dat-externalisation'
        }
      ]
    },
    {
      key: 'cause', gate: 'hasCause',
      chip: ['La cause principale'], q: ['La cause principale'],
      bubbles: [{
        text: ['Le risque n\'est pas diffus, il est concentré. {topCause} est à elle seule la première cause d\'accidents du secteur, {topCausePct} des cas, loin devant {secondCause}. Pour la prévention, c\'est presque une bonne nouvelle, un levier net vaut mieux que dix diffus.',
               'Bonne nouvelle pour qui veut agir, le risque a un visage. {topCause} domine les accidents du secteur avec {topCausePct} des cas, devant {secondCause}. On sait donc par où commencer.',
               'Le risque de ce secteur porte un nom, {topCause}. Elle concentre {topCausePct} des accidents, loin devant {secondCause}. Un risque identifié est un risque sur lequel on peut agir.'],
        illus: 'causeBar'
      }],
      followups: [
        {
          chip: ['Comment agir sur ce risque ?'],
          q: ['Comment agir sur ce risque ?'],
          bubbles: [{ text: ['Les leviers existent, aménagement des postes, aides à la manipulation, formation aux gestes. Encore faut-il les prioriser, et pour cela partir d\'une évaluation des risques à jour.',
                             'Les solutions sont connues, adapter le poste, outiller la manipulation, former aux bons gestes. Le vrai sujet, c\'est de savoir par quoi commencer, et cela vient d\'un diagnostic à jour.'] }],
          help: ['C\'est tout l\'objet du document unique. Ayming construit et maintient le DUERP des entreprises, avec un plan d\'action priorisé par unité de travail.'],
          offer: 'duerp'
        },
        {
          chip: ['Comment prioriser les actions ?'],
          q: ['Comment prioriser les actions ?'],
          bubbles: [{ text: ['Toutes les mesures ne se valent pas. On classe les risques par gravité et par fréquence, et on traite d\'abord ce qui blesse le plus souvent et le plus fort. C\'est une méthode, pas de l\'intuition.',
                             'La priorisation n\'est pas une question de flair. On croise gravité et fréquence, et on commence par ce qui fait le plus de dégâts, le plus souvent.'] }],
          help: ['Ayming structure cette priorisation dans le DUERP, avec un plan d\'action suivi par unité de travail.'],
          offer: 'duerp'
        }
      ]
    },
    {
      key: 'tendance', gate: 'hasTrend',
      chip: ['La tendance', 'La tendance sur 5 ans'], q: ['La tendance sur 5 ans'],
      bubbles: [{
        textByBand: {
          good: ['Le secteur ne subit pas sa sinistralité, il la fait reculer. La fréquence des accidents baisse régulièrement depuis {firstYr}, {trendWord}, signe que la prévention finit par payer. La marge reste réelle, mais la trajectoire est la bonne.',
                 'La dynamique est encourageante. Depuis {firstYr}, la fréquence des accidents a reculé {trendWord}. Le secteur progresse, même s\'il part de haut.',
                 'Bonne nouvelle sur la durée, la fréquence des accidents recule depuis {firstYr}, {trendWord}. La prévention finit par se voir dans les chiffres.'],
          bad: ['La tendance mérite attention. Depuis {firstYr}, la fréquence des accidents a progressé {trendWord}, à rebours de la moyenne nationale. Un signal à ne pas laisser filer.',
                'Le sens de l\'évolution interpelle. La fréquence des accidents a augmenté {trendWord} depuis {firstYr}. C\'est le moment d\'agir, avant que le taux n\'en porte la trace.'],
          flat: ['La fréquence des accidents évolue peu depuis {firstYr}, le secteur reste sur un plateau. Stable n\'est pas gagné, une baisse se construit, elle ne vient pas seule.']
        },
        illus: 'spark', level: 'good'
      }],
      followups: [
        {
          chip: ['La cotisation suit-elle cette baisse ?'],
          q: ['La cotisation suit-elle cette évolution ?'],
          bubbles: [{ text: ['Pas automatiquement. Le taux se calcule sur trois années de sinistralité passée, une amélioration récente met donc du temps à s\'y refléter, quand elle s\'y reflète vraiment.',
                             'Avec retard, et jamais mécaniquement. Le taux regarde trois ans en arrière, l\'évolution récente n\'y apparaît qu\'ensuite, si elle y apparaît.'] }],
          help: ['Ayming vérifie que le taux colle au risque réel de l\'entreprise et identifie les trop-versés éventuels pour en accompagner la régularisation.'],
          offer: 'cotisations-atmp'
        },
        {
          chip: ['Comment entretenir cette dynamique ?'],
          q: ['Comment entretenir cette dynamique ?'],
          bubbles: [{ text: ['Une évolution n\'est jamais acquise. Elle tient à des actions de prévention entretenues année après année et formalisées, sinon la courbe finit par repartir.',
                             'Rien n\'est jamais gagné sur la durée. La trajectoire tient à une prévention suivie et écrite, faute de quoi elle s\'inverse.'] }],
          help: ['Ayming aide à ancrer la prévention dans la durée, via un DUERP vivant et un plan d\'action suivi.'],
          offer: 'duerp'
        }
      ]
    }
  ]
};

// ── Vue MP (maladies professionnelles) ──
var MP = {
  intro: [
    { text: ['J\'ai regardé les maladies professionnelles du secteur {sector}. Voici ma lecture.',
             'Je me suis penchée sur les maladies professionnelles du secteur {sector}.',
             'Les maladies professionnelles du secteur {sector}, voici ce que j\'en retiens.'] },
    { text: ['Les maladies professionnelles se déclarent lentement, mais elles pèsent lourd, surtout par les incapacités qu\'elles laissent. Voici ce qui ressort de ce secteur.',
             'Une maladie professionnelle se voit rarement venir, elle se révèle des années après l\'exposition. Et quand elle est reconnue, elle coûte, surtout par les séquelles.',
             'Le temps long est la marque des maladies professionnelles, une exposition ancienne, une reconnaissance tardive, un coût durable. Voici le portrait de ce secteur.'] }
  ],
  topics: [
    {
      key: 'reconnaissance', gate: 'always',
      chip: ['Les MP reconnues'], q: ['Les maladies professionnelles reconnues'],
      bubbles: [{
        text: ['Ce secteur compte {mpCount} maladies professionnelles reconnues en premier règlement cette année. Chacune s\'impute au compte employeur, souvent des années après l\'exposition qui l\'a causée.',
               '{mpCount} maladies professionnelles y ont été reconnues cette année. Le décalage avec l\'exposition d\'origine rend chaque dossier technique, et coûteux si on le subit.',
               'Sur l\'année, {mpCount} maladies professionnelles ont été reconnues dans ce secteur, toutes imputées aux comptes employeurs, souvent longtemps après le fait générateur.']
      }],
      followups: [
        {
          chip: ['Comment bien traiter un dossier MP ?'],
          q: ['Comment bien traiter un dossier MP ?'],
          bubbles: [{ text: ['Tout se joue sur le questionnaire de la CPAM. Mal renseigné ou renvoyé hors délai, il fait basculer la reconnaissance, et le coût, du côté de l\'employeur, parfois faute des bons éléments au dossier.',
                             'Le point de bascule, c\'est le questionnaire de la CPAM. Une réponse incomplète ou tardive, et la reconnaissance penche vers l\'employeur, y compris lorsque le dossier aurait pu l\'étayer autrement.'] }],
          help: ['Ayming surveille les questionnaires sur Net-Entreprises, documente la réponse et reste proactif jusqu\'à la décision de la CPAM.'],
          offer: 'questionnaires-maladie-professionnelle'
        },
        {
          chip: ['Ces dossiers pèsent-ils longtemps ?'],
          q: ['Ces dossiers pèsent-ils longtemps ?'],
          bubbles: [{ text: ['Oui, bien au-delà de l\'année de reconnaissance. Une maladie professionnelle entre dans le calcul du taux et y reste, surtout lorsqu\'elle ouvre une rente.',
                             'Longtemps, oui. Une fois reconnue, la maladie s\'inscrit dans le taux de cotisation et l\'alimente sur la durée, plus encore quand une rente est versée.'] }],
          help: ['Ayming vérifie l\'imputation de chaque dossier au compte employeur pour aider à maîtriser le taux.'],
          offer: 'cotisations-atmp'
        }
      ]
    },
    {
      key: 'graviteMp', gate: 'severeMp',
      chip: ['La gravité des MP'], q: ['La gravité des maladies professionnelles'],
      bubbles: [{
        text: ['Les maladies professionnelles de ce secteur sont lourdes, une part notable ouvre droit à un taux d\'incapacité élevé. Ce sont des rentes, versées longtemps, qui alimentent durablement le taux de cotisation.',
               'Ici, les maladies professionnelles laissent des traces, une part notable donne lieu à une incapacité élevée. Derrière, des rentes de longue durée, et un taux de cotisation qu\'elles nourrissent année après année.']
      }],
      followups: [
        {
          chip: ['Quel impact sur ma cotisation ?'],
          q: ['Quel impact sur la cotisation ?'],
          bubbles: [{ text: ['Une incapacité permanente élevée est ce qui coûte le plus cher dans le calcul du taux. Elle y reste inscrite longtemps, bien au-delà de l\'année de reconnaissance.',
                             'C\'est le poste le plus lourd du calcul. Une incapacité permanente élevée pèse fort sur le taux, et longtemps, bien après l\'année où elle est reconnue.'] }],
          help: ['Ayming vérifie l\'imputation de chaque dossier au compte employeur pour aider à maîtriser le taux.'],
          offer: 'cotisations-atmp'
        },
        {
          chip: ['Peut-on agir sur la reconnaissance ?'],
          q: ['Peut-on agir sur la reconnaissance ?'],
          bubbles: [{ text: ['Oui, en amont de la décision. Une exposition bien documentée, un questionnaire complet et argumenté, des délais tenus, et la reconnaissance repose sur les bons éléments plutôt que sur l\'à-peu-près.',
                             'La marge est réelle, à condition d\'être présent avant la décision. Documenter l\'exposition et répondre au questionnaire dans les règles maximise les chances que la décision repose sur les bons éléments.'] }],
          help: ['Ayming surveille les questionnaires sur Net-Entreprises, documente la réponse et reste proactif jusqu\'à la décision de la CPAM.'],
          offer: 'questionnaires-maladie-professionnelle'
        }
      ]
    },
    {
      key: 'tendance', gate: 'hasTrend',
      chip: ['La tendance', 'La tendance sur 5 ans'], q: ['La tendance sur 5 ans'],
      bubbles: [{
        text: ['La reconnaissance des maladies professionnelles est {trendDir} depuis {firstYr}, {trendWord}. Une tendance à suivre, car elle dessine le coût des années à venir.',
               'Le nombre de maladies professionnelles reconnues est {trendDir} depuis {firstYr}, {trendWord}. C\'est un indicateur avancé du coût futur, il mérite qu\'on le surveille.'],
        illus: 'spark'
      }],
      followups: [
        {
          chip: ['Cette évolution change-t-elle ma cotisation ?'],
          q: ['Cette évolution change-t-elle la cotisation ?'],
          bubbles: [{ text: ['Avec retard. Le taux regarde trois années de sinistralité passée, une évolution récente n\'y apparaît qu\'ensuite, et jamais mécaniquement.',
                             'Pas dans l\'instant. Le calcul du taux s\'appuie sur trois ans d\'historique, le mouvement récent ne s\'y lit qu\'après coup.'] }],
          help: ['Ayming vérifie que le taux colle au risque réel de l\'entreprise et en accompagne la maîtrise.'],
          offer: 'cotisations-atmp'
        },
        {
          chip: ['Comment anticiper ces dossiers ?'],
          q: ['Comment anticiper ces dossiers ?'],
          bubbles: [{ text: ['En ne les découvrant pas au moment de la décision. Suivre les questionnaires dès leur arrivée, documenter l\'exposition à froid, c\'est ce qui évite de subir une reconnaissance mal étayée.',
                             'En prenant les dossiers en amont plutôt qu\'au dernier moment. Le suivi des questionnaires et la documentation de l\'exposition se préparent avant la décision, pas après.'] }],
          help: ['Ayming surveille les questionnaires sur Net-Entreprises, documente la réponse et reste proactif jusqu\'à la décision de la CPAM.'],
          offer: 'questionnaires-maladie-professionnelle'
        }
      ]
    }
  ]
};

// ── Vue Trajet (accidents de trajet) ──
var TRAJET = {
  intro: [
    { text: ['J\'ai regardé les accidents de trajet du secteur {sector}. Voici ma lecture.',
             'Je me suis penchée sur les accidents de trajet du secteur {sector}.',
             'Les accidents de trajet du secteur {sector}, voici ce qui ressort.'] },
    { text: ['Les accidents de trajet arrivent hors de l\'entreprise, mais leurs conséquences, elles, sont bien à la charge de l\'employeur. Voici ce qui ressort de ce secteur.',
             'Un accident de trajet se produit sur la route, pas dans l\'atelier, et pourtant c\'est l\'entreprise qui en porte le coût. Voici le portrait de ce secteur.',
             'Le trajet domicile-travail échappe à l\'entreprise, son coût non. Voici ce que révèlent les chiffres de ce secteur.'] }
  ],
  topics: [
    {
      key: 'volume', gate: 'always',
      chip: ['Le volume de trajet'], q: ['Le volume d\'accidents de trajet'],
      bubbles: [{
        text: ['Ce secteur enregistre {trajetCount} accidents de trajet cette année. Souvent sous-estimés, ils pèsent pourtant sur l\'absentéisme et sur le compte employeur au même titre que les accidents de travail.',
               'Sur l\'année, {trajetCount} accidents de trajet dans ce secteur. On les regarde peu, à tort, ils grèvent l\'absentéisme et le compte employeur comme les accidents de travail.',
               'Le secteur compte {trajetCount} accidents de trajet cette année. Discrets dans les tableaux de bord, ils n\'en pèsent pas moins sur l\'absentéisme et sur les comptes.']
      }],
      followups: [
        {
          chip: ['Un tiers est-il parfois responsable ?'],
          q: ['Un tiers est-il parfois responsable ?'],
          bubbles: [{ text: ['Très souvent. Un accident de trajet met fréquemment en cause un tiers, un autre conducteur par exemple. Dans ce cas, une partie du coût peut être récupérée, à condition de l\'identifier et de le documenter.',
                             'Plus qu\'on ne le pense. Beaucoup d\'accidents de trajet impliquent un tiers, souvent un autre véhicule. Le coût devient alors récupérable, encore faut-il repérer le dossier.'] }],
          help: ['Ayming identifie les accidents causés par un tiers responsable et facilite la récupération des coûts correspondants.'],
          offer: 'accidents-tiers'
        },
        {
          chip: ['Ces accidents ouvrent-ils des indemnités ?'],
          q: ['Ces accidents ouvrent-ils des indemnités ?'],
          bubbles: [{ text: ['Oui, comme un accident du travail, avec des indemnités journalières à la clé. Et comme ailleurs, une part de ces indemnités dues échappe parfois à l\'entreprise, faute de suivi.',
                             'Bien sûr, ils donnent lieu à des indemnités journalières. Et là encore, entre erreurs et subrogation mal suivie, une partie des sommes dues ne revient pas d\'elle-même.'] }],
          help: ['Ayming cartographie les IJ manquantes, relance la CPAM et les assureurs, et fournit les écritures de régularisation prêtes à charger.'],
          offer: 'recuperer-ij'
        }
      ]
    },
    {
      key: 'tendance', gate: 'hasTrend',
      chip: ['La tendance', 'La tendance sur 5 ans'], q: ['La tendance sur 5 ans'],
      bubbles: [{
        text: ['Le volume d\'accidents de trajet est {trendDir} depuis {firstYr}, {trendWord}. Une trajectoire utile à suivre pour anticiper l\'absentéisme du secteur.',
               'Le nombre d\'accidents de trajet est {trendDir} depuis {firstYr}, {trendWord}. Un repère à garder en tête pour anticiper l\'absentéisme.'],
        illus: 'spark'
      }],
      followups: [
        {
          chip: ['Comment un tiers change-t-il la donne ?'],
          q: ['Comment un tiers change-t-il la donne ?'],
          bubbles: [{ text: ['Il déplace le coût. Quand un tiers est responsable, une partie des sommes engagées peut être récupérée, ce qui allège d\'autant le compte employeur, à condition d\'identifier le dossier à temps.',
                             'Il ouvre une porte de récupération. Un tiers responsable, c\'est une part du coût qui peut revenir à l\'entreprise, si le dossier est repéré et documenté.'] }],
          help: ['Ayming identifie les accidents causés par un tiers responsable et facilite la récupération des coûts correspondants.'],
          offer: 'accidents-tiers'
        },
        {
          chip: ['Peut-on récupérer les indemnités versées ?'],
          q: ['Peut-on récupérer les indemnités versées ?'],
          bubbles: [{ text: ['En partie, oui. Comme pour les accidents de travail, une fraction des indemnités journalières dues n\'arrive jamais dans les comptes, et se récupère avec le bon suivi.',
                             'Souvent, oui. Une part des indemnités journalières échappe à l\'entreprise, sur le trajet comme ailleurs, et se rattrape en reprenant les dossiers un à un.'] }],
          help: ['Ayming cartographie les IJ manquantes, relance la CPAM et les assureurs, et fournit les écritures de régularisation prêtes à charger.'],
          offer: 'recuperer-ij'
        }
      ]
    }
  ]
};

export var ASSISTANT_VIEWS = { at: AT, mp: MP, trajet: TRAJET };
