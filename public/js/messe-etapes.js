// Déroulement de la messe : titres des étapes seulement (les textes seront ajoutés plus tard).
// quand : précision sur le moment où l'étape a lieu (n'est pas un texte liturgique).
export const ETAPES = {
  ordinaire: {
    titre: "Forme ordinaire",
    sousTitre: "Missel romain de saint Paul VI (1970)",
    sections: [
      ["Rites initiaux", [
        ["Chant d'entrée", "Introitus"],
        ["Vénération de l'autel et signe de croix", ""],
        ["Salutation", ""],
        ["Acte pénitentiel", "", "ou rite de l'aspersion le dimanche"],
        ["Kyrie", "Kyrie eleison"],
        ["Gloire à Dieu", "Gloria", "dimanches (hors Avent et Carême), solennités et fêtes"],
        ["Prière d'ouverture", "Collecta"]
      ]],
      ["Liturgie de la Parole", [
        ["Première lecture", "Lectio prima"],
        ["Psaume", "Psalmus responsorius"],
        ["Deuxième lecture", "Lectio secunda", "dimanches et solennités"],
        ["Séquence", "Sequentia", "Pâques et Pentecôte (facultative à la Fête-Dieu et le 15 septembre)"],
        ["Acclamation de l'Évangile", "Alleluia", "remplacée pendant le Carême"],
        ["Évangile", "Evangelium"],
        ["Homélie", "Homilia"],
        ["Profession de foi", "Credo", "dimanches et solennités"],
        ["Prière universelle", "Oratio universalis"]
      ]],
      ["Liturgie eucharistique", [
        ["Préparation des dons", "Offertorium"],
        ["Lavement des mains", "Lavabo"],
        ["Invitation à la prière", "Orate, fratres"],
        ["Prière sur les offrandes", "Super oblata"],
        ["Dialogue de la préface et préface", "Praefatio"],
        ["Saint, saint, saint", "Sanctus"],
        ["Prière eucharistique", "Prex eucharistica"],
        ["Consécration", "", "récit de l'institution"],
        ["Anamnèse", "Mysterium fidei"],
        ["Doxologie", "Per ipsum"]
      ]],
      ["Rite de communion", [
        ["Notre Père", "Pater noster"],
        ["Prière pour la paix et geste de paix", "Pax Domini"],
        ["Fraction du pain", "Agnus Dei"],
        ["Communion", "Communio"],
        ["Prière après la communion", "Post communionem"]
      ]],
      ["Rites de conclusion", [
        ["Annonces", "", "s'il y a lieu"],
        ["Bénédiction", "Benedictio"],
        ["Envoi", "Ite, missa est"]
      ]]
    ]
  },
  extraordinaire: {
    titre: "Forme extraordinaire",
    sousTitre: "Missel romain de saint Jean XXIII (1962)",
    sections: [
      ["Avant la messe", [
        ["Aspersion de l'eau bénite", "Asperges me", "le dimanche avant la grand-messe (Vidi aquam au temps pascal)"]
      ]],
      ["Messe des catéchumènes", [
        ["Prières au bas de l'autel", "Judica me", "psaume Judica me omis aux messes des défunts et au temps de la Passion"],
        ["Confession", "Confiteor"],
        ["Montée à l'autel", "Aufer a nobis"],
        ["Introït", "Introitus"],
        ["Kyrie", "Kyrie eleison"],
        ["Gloire à Dieu", "Gloria", "selon le jour"],
        ["Collecte", "Oratio"],
        ["Épître", "Epistola"],
        ["Graduel", "Graduale"],
        ["Alléluia ou Trait", "Alleluia / Tractus", "Trait pendant le temps de la Septuagésime et du Carême"],
        ["Séquence", "Sequentia", "certains jours"],
        ["Évangile", "Evangelium"],
        ["Sermon", "", "s'il y a lieu"],
        ["Credo", "Credo", "dimanches et certaines fêtes"]
      ]],
      ["Messe des fidèles — Offertoire", [
        ["Antienne d'offertoire", "Offertorium"],
        ["Offrande de l'hostie", "Suscipe, sancte Pater"],
        ["Offrande du calice", "Offerimus tibi"],
        ["Encensement", "Incensum istud", "à la messe solennelle"],
        ["Lavement des mains", "Lavabo"],
        ["Prière à la Sainte Trinité", "Suscipe, sancta Trinitas"],
        ["Invitation à la prière", "Orate, fratres"],
        ["Secrète", "Secreta"]
      ]],
      ["Canon de la messe", [
        ["Préface", "Praefatio"],
        ["Sanctus", "Sanctus"],
        ["Pour l'Église", "Te igitur"],
        ["Mémoire des vivants", "Memento, Domine"],
        ["Communion des saints", "Communicantes"],
        ["Hanc igitur", "Hanc igitur"],
        ["Quam oblationem", "Quam oblationem"],
        ["Consécration et élévation", "Qui pridie"],
        ["Anamnèse", "Unde et memores"],
        ["Supra quae", "Supra quae"],
        ["Supplices", "Supplices te rogamus"],
        ["Mémoire des défunts", "Memento etiam"],
        ["Nobis quoque", "Nobis quoque peccatoribus"],
        ["Doxologie et petite élévation", "Per ipsum"]
      ]],
      ["Communion", [
        ["Notre Père", "Pater noster"],
        ["Libera nos", "Libera nos"],
        ["Fraction et paix", "Pax Domini"],
        ["Agneau de Dieu", "Agnus Dei"],
        ["Prières avant la communion", "Domine Jesu Christe"],
        ["Communion du prêtre", "Domine, non sum dignus"],
        ["Communion des fidèles", "Ecce Agnus Dei"],
        ["Ablutions", "Quod ore sumpsimus"],
        ["Antienne de communion", "Communio"],
        ["Postcommunion", "Postcommunio"]
      ]],
      ["Fin de la messe", [
        ["Renvoi", "Ite, missa est", "ou Benedicamus Domino"],
        ["Prière à la Sainte Trinité", "Placeat tibi"],
        ["Bénédiction", "Benedictio"],
        ["Dernier Évangile", "Initium sancti Evangelii secundum Joannem"],
        ["Prières après la messe basse", "", "prières léonines"]
      ]]
    ]
  }
};
