// Ordinaire de la messe — données du missel.
// Latin : uniquement des textes anciens du domaine public (à collationner sur une édition de référence avant publication).
// Français : AUCUNE traduction liturgique n'est intégrée (droits AELF) — voir public/data/content-rights.json.
// Les « explications » sont des textes originaux rédigés pour l'application ; ce ne sont pas des textes liturgiques.
// Lignes : "V:" célébrant · "R:" réponse · "!" rubrique.
export const NOTE_FR = "Traduction liturgique française © AELF — AUTORISATION À DEMANDER AVANT INTÉGRATION.";
export const ORDO = {
  romain: [
 {
  "id": "entree",
  "titre": "Chant d'entrée",
  "section": "Rites initiaux",
  "explication": "L'assemblée se lève : le chant d'entrée ouvre la célébration et accompagne la procession.",
  "propre": true,
  "manque": "Texte propre du jour (variable) — non intégré : aucune source dont les droits sont établis. AUTORISATION À DEMANDER AVANT INTÉGRATION.",
  "droits": "PERMISSION_REQUIRED"
 },
 {
  "id": "signe",
  "titre": "Signe de la croix et salutation",
  "section": "Rites initiaux",
  "explication": "La messe commence au nom de la Trinité ; le prêtre salue l'assemblée, qui répond.",
  "la": [
   "V:In nómine Patris, et Fílii, et Spíritus Sancti.",
   "R:Amen.",
   "V:Dóminus vobíscum.",
   "R:Et cum spíritu tuo."
  ],
  "droits": "PUBLIC_DOMAIN"
 },
 {
  "id": "penitentiel",
  "titre": "Acte pénitentiel",
  "section": "Rites initiaux",
  "explication": "Chacun reconnaît devant Dieu et devant ses frères qu'il a besoin de miséricorde.",
  "manque": "Texte latin de l'édition typique postérieure à 1969 — droits à vérifier (Libreria Editrice Vaticana) : AUTORISATION À DEMANDER AVANT INTÉGRATION.",
  "droits": "PERMISSION_REQUIRED"
 },
 {
  "id": "kyrie",
  "titre": "Kyrie",
  "section": "Rites initiaux",
  "explication": "Très ancienne invocation en grec : « Seigneur, prends pitié ».",
  "la": [
   "V:Kýrie, eléison.",
   "R:Kýrie, eléison.",
   "V:Christe, eléison.",
   "R:Christe, eléison.",
   "V:Kýrie, eléison.",
   "R:Kýrie, eléison."
  ],
  "droits": "PUBLIC_DOMAIN"
 },
 {
  "id": "gloria",
  "titre": "Gloria",
  "section": "Rites initiaux",
  "explication": "Hymne de louange, omise pendant l'Avent et le Carême.",
  "la": [
   "Glória in excélsis Deo et in terra pax homínibus bonæ voluntátis.",
   "Laudámus te, benedícimus te, adorámus te, glorificámus te, grátias ágimus tibi propter magnam glóriam tuam, Dómine Deus, Rex cæléstis, Deus Pater omnípotens.",
   "Dómine Fili unigénite, Iesu Christe, Dómine Deus, Agnus Dei, Fílius Patris,",
   "qui tollis peccáta mundi, miserére nobis; qui tollis peccáta mundi, súscipe deprecatiónem nostram. Qui sedes ad déxteram Patris, miserére nobis.",
   "Quóniam tu solus Sanctus, tu solus Dóminus, tu solus Altíssimus, Iesu Christe, cum Sancto Spíritu: in glória Dei Patris. Amen."
  ],
  "cond": "gloria",
  "droits": "PUBLIC_DOMAIN"
 },
 {
  "id": "collecte",
  "titre": "Prière d'ouverture (collecte)",
  "section": "Rites initiaux",
  "explication": "Après un silence, le prêtre rassemble la prière de tous dans l'oraison du jour.",
  "la": [
   "V:Orémus."
  ],
  "droits": "PUBLIC_DOMAIN"
 },
 {
  "id": "lecture1",
  "titre": "Première lecture",
  "section": "Liturgie de la Parole",
  "explication": "On s'assoit pour écouter la Parole de Dieu.",
  "propre": true,
  "manque": "Texte propre du jour (variable) — non intégré : aucune source dont les droits sont établis. AUTORISATION À DEMANDER AVANT INTÉGRATION.",
  "droits": "PERMISSION_REQUIRED"
 },
 {
  "id": "psaume",
  "titre": "Psaume",
  "section": "Liturgie de la Parole",
  "explication": "Réponse priée à la première lecture.",
  "propre": true,
  "manque": "Texte propre du jour (variable) — non intégré : aucune source dont les droits sont établis. AUTORISATION À DEMANDER AVANT INTÉGRATION.",
  "droits": "PERMISSION_REQUIRED"
 },
 {
  "id": "lecture2",
  "titre": "Deuxième lecture",
  "section": "Liturgie de la Parole",
  "explication": "Les dimanches et solennités, une lecture tirée des lettres des apôtres.",
  "cond": "deuxLectures",
  "propre": true,
  "manque": "Texte propre du jour (variable) — non intégré : aucune source dont les droits sont établis. AUTORISATION À DEMANDER AVANT INTÉGRATION.",
  "droits": "PERMISSION_REQUIRED"
 },
 {
  "id": "evangile",
  "titre": "Évangile",
  "section": "Liturgie de la Parole",
  "explication": "On se lève pour acclamer puis écouter l'Évangile.",
  "la": [
   "V:Dóminus vobíscum.",
   "R:Et cum spíritu tuo.",
   "R:Glória tibi, Dómine.",
   "!Post Evangelium:",
   "R:Laus tibi, Christe."
  ],
  "droits": "PUBLIC_DOMAIN"
 },
 {
  "id": "homelie",
  "titre": "Homélie",
  "section": "Liturgie de la Parole",
  "explication": "Le prêtre ou le diacre commente la Parole. Vous pouvez prendre des notes dans votre journal.",
  "droits": "PERMISSION_REQUIRED"
 },
 {
  "id": "credo",
  "titre": "Profession de foi (Symbole de Nicée-Constantinople)",
  "section": "Liturgie de la Parole",
  "explication": "L'assemblée proclame la foi de l'Église, les dimanches et solennités.",
  "la": [
   "Credo in unum Deum, Patrem omnipoténtem, factórem cæli et terræ, visibílium ómnium et invisibílium.",
   "Et in unum Dóminum Iesum Christum, Fílium Dei unigénitum, et ex Patre natum ante ómnia sǽcula. Deum de Deo, lumen de lúmine, Deum verum de Deo vero, génitum, non factum, consubstantiálem Patri: per quem ómnia facta sunt.",
   "Qui propter nos hómines et propter nostram salútem descéndit de cælis.",
   "!Omnes se inclinant:",
   "Et incarnátus est de Spíritu Sancto ex María Vírgine, et homo factus est.",
   "Crucifíxus étiam pro nobis sub Póntio Piláto; passus et sepúltus est, et resurréxit tértia die, secúndum Scriptúras, et ascéndit in cælum, sedet ad déxteram Patris. Et íterum ventúrus est cum glória, iudicáre vivos et mórtuos, cuius regni non erit finis.",
   "Et in Spíritum Sanctum, Dóminum et vivificántem: qui ex Patre Filióque procédit. Qui cum Patre et Fílio simul adorátur et conglorificátur: qui locútus est per prophétas.",
   "Et unam, sanctam, cathólicam et apostólicam Ecclésiam. Confíteor unum baptísma in remissiónem peccatórum. Et exspécto resurrectiónem mortuórum, et vitam ventúri sǽculi. Amen."
  ],
  "cond": "credo",
  "droits": "PUBLIC_DOMAIN"
 },
 {
  "id": "orate",
  "titre": "Préparation des dons",
  "section": "Liturgie eucharistique",
  "explication": "Le pain et le vin sont apportés à l'autel.",
  "la": [
   "V:Oráte, fratres: ut meum ac vestrum sacrifícium acceptábile fiat apud Deum Patrem omnipoténtem.",
   "R:Suscípiat Dóminus sacrifícium de mánibus tuis ad laudem et glóriam nóminis sui, ad utilitátem quoque nostram totiúsque Ecclésiæ suæ sanctæ."
  ],
  "droits": "PUBLIC_DOMAIN"
 },
 {
  "id": "preface",
  "titre": "Dialogue de la préface",
  "section": "Liturgie eucharistique",
  "explication": "Début de la prière eucharistique : action de grâce.",
  "la": [
   "V:Dóminus vobíscum.",
   "R:Et cum spíritu tuo.",
   "V:Sursum corda.",
   "R:Habémus ad Dóminum.",
   "V:Grátias agámus Dómino Deo nostro.",
   "R:Dignum et iustum est."
  ],
  "droits": "PUBLIC_DOMAIN"
 },
 {
  "id": "sanctus",
  "titre": "Sanctus",
  "section": "Liturgie eucharistique",
  "explication": "L'assemblée s'unit à la louange des anges (Isaïe 6, 3).",
  "la": [
   "Sanctus, Sanctus, Sanctus Dóminus Deus Sábaoth.",
   "Pleni sunt cæli et terra glória tua. Hosánna in excélsis.",
   "Benedíctus qui venit in nómine Dómini. Hosánna in excélsis."
  ],
  "droits": "PUBLIC_DOMAIN"
 },
 {
  "id": "pe",
  "titre": "Prière eucharistique",
  "section": "Liturgie eucharistique",
  "explication": "Cœur de la messe : le prêtre prononce le récit de l'institution ; l'assemblée répond par l'anamnèse.",
  "manque": "Texte latin de l'édition typique postérieure à 1969 — droits à vérifier (Libreria Editrice Vaticana) : AUTORISATION À DEMANDER AVANT INTÉGRATION.",
  "droits": "PERMISSION_REQUIRED"
 },
 {
  "id": "doxo",
  "titre": "Doxologie",
  "section": "Liturgie eucharistique",
  "explication": "La prière eucharistique s'achève par la louange trinitaire et le grand « Amen ».",
  "la": [
   "V:Per ipsum, et cum ipso, et in ipso, est tibi Deo Patri omnipoténti, in unitáte Spíritus Sancti, omnis honor et glória per ómnia sǽcula sæculórum.",
   "R:Amen."
  ],
  "droits": "PUBLIC_DOMAIN"
 },
 {
  "id": "pater",
  "titre": "Pater noster",
  "section": "Liturgie eucharistique",
  "explication": "La prière enseignée par Jésus (Matthieu 6, 9-13).",
  "la": [
   "Pater noster, qui es in cælis, sanctificétur nomen tuum; advéniat regnum tuum; fiat volúntas tua, sicut in cælo et in terra.",
   "Panem nostrum cotidiánum da nobis hódie; et dimítte nobis débita nostra, sicut et nos dimíttimus debitóribus nostris;",
   "et ne nos indúcas in tentatiónem; sed líbera nos a malo."
  ],
  "droits": "PUBLIC_DOMAIN"
 },
 {
  "id": "paix",
  "titre": "Rite de la paix",
  "section": "Liturgie eucharistique",
  "explication": "Le prêtre souhaite la paix du Christ à l'assemblée.",
  "la": [
   "V:Pax Dómini sit semper vobíscum.",
   "R:Et cum spíritu tuo."
  ],
  "droits": "PUBLIC_DOMAIN"
 },
 {
  "id": "agnus",
  "titre": "Agnus Dei",
  "section": "Liturgie eucharistique",
  "explication": "Chant qui accompagne la fraction du pain.",
  "la": [
   "Agnus Dei, qui tollis peccáta mundi: miserére nobis.",
   "Agnus Dei, qui tollis peccáta mundi: miserére nobis.",
   "Agnus Dei, qui tollis peccáta mundi: dona nobis pacem."
  ],
  "droits": "PUBLIC_DOMAIN"
 },
 {
  "id": "communion",
  "titre": "Communion",
  "section": "Liturgie eucharistique",
  "explication": "Paroles inspirées de Jean 1, 29 et du centurion (Matthieu 8, 8).",
  "la": [
   "V:Ecce Agnus Dei, ecce qui tollit peccáta mundi.",
   "R:Dómine, non sum dignus, ut intres sub tectum meum, sed tantum dic verbo, et sanábitur ánima mea."
  ],
  "droits": "PUBLIC_DOMAIN"
 },
 {
  "id": "envoi",
  "titre": "Bénédiction et envoi",
  "section": "Rite de conclusion",
  "explication": "La messe se termine par la bénédiction et l'envoi en mission.",
  "la": [
   "V:Dóminus vobíscum.",
   "R:Et cum spíritu tuo.",
   "V:Benedícat vos omnípotens Deus, Pater, et Fílius, et Spíritus Sanctus.",
   "R:Amen.",
   "V:Ite, missa est.",
   "R:Deo grátias."
  ],
  "droits": "PUBLIC_DOMAIN"
 }
],
  m1962: [
 {
  "id": "pied",
  "titre": "Prières au bas de l'autel",
  "section": "Messe des catéchumènes",
  "explication": "Le prêtre et les servants se préparent au pied de l'autel avec le psaume 42.",
  "la": [
   "V:In nómine Patris, et Fílii, et Spíritus Sancti. Amen.",
   "V:Introíbo ad altáre Dei.",
   "R:Ad Deum qui lætíficat iuventútem meam.",
   "!Psalmus 42 (omis aux messes des défunts et au temps de la Passion)",
   "V:Iúdica me, Deus, et discérne causam meam de gente non sancta: ab hómine iníquo et dolóso érue me.",
   "R:Quia tu es, Deus, fortitúdo mea: quare me repulísti, et quare tristis incédo, dum afflígit me inimícus?",
   "V:Emítte lucem tuam et veritátem tuam: ipsa me deduxérunt, et adduxérunt in montem sanctum tuum et in tabernácula tua.",
   "R:Et introíbo ad altáre Dei: ad Deum qui lætíficat iuventútem meam.",
   "V:Confitébor tibi in cíthara, Deus, Deus meus: quare tristis es, ánima mea, et quare contúrbas me?",
   "R:Spera in Deo, quóniam adhuc confitébor illi: salutáre vultus mei, et Deus meus.",
   "V:Glória Patri, et Fílio, et Spirítui Sancto.",
   "R:Sicut erat in princípio, et nunc, et semper: et in sǽcula sæculórum. Amen.",
   "V:Adiutórium nostrum in nómine Dómini.",
   "R:Qui fecit cælum et terram."
  ],
  "droits": "PUBLIC_DOMAIN"
 },
 {
  "id": "confiteor",
  "titre": "Confiteor",
  "section": "Messe des catéchumènes",
  "explication": "Le prêtre, puis les servants au nom des fidèles, confessent leurs péchés.",
  "la": [
   "Confíteor Deo omnipoténti, beátæ Maríæ semper Vírgini, beáto Michaéli Archángelo, beáto Ioánni Baptístæ, sanctis Apóstolis Petro et Paulo, ómnibus Sanctis, et tibi, pater: quia peccávi nimis cogitatióne, verbo et ópere:",
   "!On se frappe trois fois la poitrine :",
   "mea culpa, mea culpa, mea máxima culpa.",
   "Ídeo precor beátam Maríam semper Vírginem, beátum Michaélem Archángelum, beátum Ioánnem Baptístam, sanctos Apóstolos Petrum et Paulum, omnes Sanctos, et te, pater, oráre pro me ad Dóminum Deum nostrum.",
   "V:Misereátur vestri omnípotens Deus, et, dimíssis peccátis vestris, perdúcat vos ad vitam ætérnam.",
   "R:Amen."
  ],
  "droits": "PUBLIC_DOMAIN"
 },
 {
  "id": "introit",
  "titre": "Introït",
  "section": "Messe des catéchumènes",
  "explication": "Antienne propre du jour, qui donne le ton de la messe.",
  "propre": true,
  "manque": "Texte propre du jour (variable) — non intégré : aucune source dont les droits sont établis. AUTORISATION À DEMANDER AVANT INTÉGRATION.",
  "droits": "PERMISSION_REQUIRED"
 },
 {
  "id": "kyrie",
  "titre": "Kyrie",
  "section": "Messe des catéchumènes",
  "explication": "Neuf invocations alternées entre le prêtre et les servants.",
  "la": [
   "V:Kýrie, eléison.",
   "R:Kýrie, eléison.",
   "V:Kýrie, eléison.",
   "R:Christe, eléison.",
   "V:Christe, eléison.",
   "R:Christe, eléison.",
   "V:Kýrie, eléison.",
   "R:Kýrie, eléison.",
   "V:Kýrie, eléison."
  ],
  "droits": "PUBLIC_DOMAIN"
 },
 {
  "id": "gloria",
  "titre": "Gloria",
  "section": "Messe des catéchumènes",
  "explication": "Omis aux temps de pénitence et aux messes de férie.",
  "la": [
   "Glória in excélsis Deo et in terra pax homínibus bonæ voluntátis.",
   "Laudámus te, benedícimus te, adorámus te, glorificámus te, grátias ágimus tibi propter magnam glóriam tuam, Dómine Deus, Rex cæléstis, Deus Pater omnípotens.",
   "Dómine Fili unigénite, Iesu Christe, Dómine Deus, Agnus Dei, Fílius Patris,",
   "qui tollis peccáta mundi, miserére nobis; qui tollis peccáta mundi, súscipe deprecatiónem nostram. Qui sedes ad déxteram Patris, miserére nobis.",
   "Quóniam tu solus Sanctus, tu solus Dóminus, tu solus Altíssimus, Iesu Christe, cum Sancto Spíritu: in glória Dei Patris. Amen."
  ],
  "cond": "gloria",
  "droits": "PUBLIC_DOMAIN"
 },
 {
  "id": "collecte",
  "titre": "Collecte",
  "section": "Messe des catéchumènes",
  "explication": "Oraison propre du jour.",
  "la": [
   "V:Dóminus vobíscum.",
   "R:Et cum spíritu tuo.",
   "V:Orémus."
  ],
  "droits": "PUBLIC_DOMAIN"
 },
 {
  "id": "epitre",
  "titre": "Épître",
  "section": "Messe des catéchumènes",
  "explication": "Lecture propre du jour, suivie de « Deo grátias ».",
  "propre": true,
  "manque": "Texte propre du jour (variable) — non intégré : aucune source dont les droits sont établis. AUTORISATION À DEMANDER AVANT INTÉGRATION.",
  "droits": "PERMISSION_REQUIRED"
 },
 {
  "id": "graduel",
  "titre": "Graduel, Alléluia ou Trait",
  "section": "Messe des catéchumènes",
  "explication": "Chants entre les lectures ; le Trait remplace l'Alléluia de la Septuagésime à Pâques.",
  "propre": true,
  "manque": "Texte propre du jour (variable) — non intégré : aucune source dont les droits sont établis. AUTORISATION À DEMANDER AVANT INTÉGRATION.",
  "droits": "PERMISSION_REQUIRED"
 },
 {
  "id": "evangile",
  "titre": "Évangile",
  "section": "Messe des catéchumènes",
  "explication": "On se lève pour l'Évangile.",
  "la": [
   "V:Dóminus vobíscum.",
   "R:Et cum spíritu tuo.",
   "V:Sequéntia sancti Evangélii secúndum N.",
   "R:Glória tibi, Dómine.",
   "!Post Evangelium:",
   "R:Laus tibi, Christe."
  ],
  "droits": "PUBLIC_DOMAIN"
 },
 {
  "id": "homelie",
  "titre": "Sermon",
  "section": "Messe des catéchumènes",
  "explication": "Le sermon n'appartient pas au texte du missel. Vous pouvez prendre des notes dans votre journal.",
  "droits": "PERMISSION_REQUIRED"
 },
 {
  "id": "credo",
  "titre": "Credo",
  "section": "Messe des catéchumènes",
  "explication": "On s'agenouille à « Et incarnátus est ».",
  "la": [
   "Credo in unum Deum, Patrem omnipoténtem, factórem cæli et terræ, visibílium ómnium et invisibílium.",
   "Et in unum Dóminum Iesum Christum, Fílium Dei unigénitum, et ex Patre natum ante ómnia sǽcula. Deum de Deo, lumen de lúmine, Deum verum de Deo vero, génitum, non factum, consubstantiálem Patri: per quem ómnia facta sunt.",
   "Qui propter nos hómines et propter nostram salútem descéndit de cælis.",
   "!Omnes se inclinant:",
   "Et incarnátus est de Spíritu Sancto ex María Vírgine, et homo factus est.",
   "Crucifíxus étiam pro nobis sub Póntio Piláto; passus et sepúltus est, et resurréxit tértia die, secúndum Scriptúras, et ascéndit in cælum, sedet ad déxteram Patris. Et íterum ventúrus est cum glória, iudicáre vivos et mórtuos, cuius regni non erit finis.",
   "Et in Spíritum Sanctum, Dóminum et vivificántem: qui ex Patre Filióque procédit. Qui cum Patre et Fílio simul adorátur et conglorificátur: qui locútus est per prophétas.",
   "Et unam, sanctam, cathólicam et apostólicam Ecclésiam. Confíteor unum baptísma in remissiónem peccatórum. Et exspécto resurrectiónem mortuórum, et vitam ventúri sǽculi. Amen."
  ],
  "cond": "credo",
  "droits": "PUBLIC_DOMAIN"
 },
 {
  "id": "offertoire",
  "titre": "Offertoire",
  "section": "Messe des fidèles",
  "explication": "Prières d'offrande du pain et du vin, puis « Oráte, fratres ».",
  "la": [
   "V:Oráte, fratres: ut meum ac vestrum sacrifícium acceptábile fiat apud Deum Patrem omnipoténtem.",
   "R:Suscípiat Dóminus sacrifícium de mánibus tuis ad laudem et glóriam nóminis sui, ad utilitátem quoque nostram totiúsque Ecclésiæ suæ sanctæ."
  ],
  "manque": "Texte latin ancien (domaine public) — à intégrer à partir d'une édition de référence vérifiée ; non saisi de mémoire pour éviter toute erreur.",
  "droits": "PUBLIC_DOMAIN"
 },
 {
  "id": "preface",
  "titre": "Préface",
  "section": "Messe des fidèles",
  "explication": "Dialogue puis préface propre au temps ou à la fête.",
  "la": [
   "V:Dóminus vobíscum.",
   "R:Et cum spíritu tuo.",
   "V:Sursum corda.",
   "R:Habémus ad Dóminum.",
   "V:Grátias agámus Dómino Deo nostro.",
   "R:Dignum et iustum est."
  ],
  "droits": "PUBLIC_DOMAIN"
 },
 {
  "id": "sanctus",
  "titre": "Sanctus",
  "section": "Messe des fidèles",
  "explication": "La cloche sonne trois fois.",
  "la": [
   "Sanctus, Sanctus, Sanctus Dóminus Deus Sábaoth.",
   "Pleni sunt cæli et terra glória tua. Hosánna in excélsis.",
   "Benedíctus qui venit in nómine Dómini. Hosánna in excélsis."
  ],
  "droits": "PUBLIC_DOMAIN"
 },
 {
  "id": "canon",
  "titre": "Canon de la messe",
  "section": "Messe des fidèles",
  "explication": "Le Canon romain est dit à voix basse ; la consécration en est le sommet.",
  "manque": "Texte latin ancien (domaine public) — à intégrer à partir d'une édition de référence vérifiée ; non saisi de mémoire pour éviter toute erreur.",
  "droits": "PERMISSION_REQUIRED"
 },
 {
  "id": "pater",
  "titre": "Pater noster",
  "section": "Messe des fidèles",
  "explication": "Le prêtre chante ou dit le Pater ; les fidèles répondent la dernière demande.",
  "la": [
   "Pater noster, qui es in cælis, sanctificétur nomen tuum; advéniat regnum tuum; fiat volúntas tua, sicut in cælo et in terra.",
   "Panem nostrum cotidiánum da nobis hódie; et dimítte nobis débita nostra, sicut et nos dimíttimus debitóribus nostris;",
   "V:Et ne nos indúcas in tentatiónem.",
   "R:Sed líbera nos a malo."
  ],
  "droits": "PUBLIC_DOMAIN"
 },
 {
  "id": "agnus",
  "titre": "Agnus Dei",
  "section": "Messe des fidèles",
  "explication": "Aux messes des défunts, les réponses sont « dona eis réquiem ».",
  "la": [
   "Agnus Dei, qui tollis peccáta mundi: miserére nobis.",
   "Agnus Dei, qui tollis peccáta mundi: miserére nobis.",
   "Agnus Dei, qui tollis peccáta mundi: dona nobis pacem."
  ],
  "droits": "PUBLIC_DOMAIN"
 },
 {
  "id": "communion",
  "titre": "Communion",
  "section": "Messe des fidèles",
  "explication": "Les fidèles communient à genoux, sur la langue.",
  "la": [
   "V:Ecce Agnus Dei, ecce qui tollit peccáta mundi.",
   "!Trois fois :",
   "R:Dómine, non sum dignus, ut intres sub tectum meum: sed tantum dic verbo, et sanábitur ánima mea."
  ],
  "droits": "PUBLIC_DOMAIN"
 },
 {
  "id": "postcommunion",
  "titre": "Antienne de communion et postcommunion",
  "section": "Messe des fidèles",
  "explication": "Textes propres du jour.",
  "propre": true,
  "manque": "Texte propre du jour (variable) — non intégré : aucune source dont les droits sont établis. AUTORISATION À DEMANDER AVANT INTÉGRATION.",
  "droits": "PERMISSION_REQUIRED"
 },
 {
  "id": "envoi",
  "titre": "Renvoi et bénédiction",
  "section": "Messe des fidèles",
  "explication": "La bénédiction suit le renvoi.",
  "la": [
   "V:Dóminus vobíscum.",
   "R:Et cum spíritu tuo.",
   "V:Ite, missa est.",
   "R:Deo grátias.",
   "V:Benedícat vos omnípotens Deus, Pater, et Fílius, et Spíritus Sanctus.",
   "R:Amen."
  ],
  "droits": "PUBLIC_DOMAIN"
 },
 {
  "id": "dernier",
  "titre": "Dernier Évangile (Jean 1, 1-14)",
  "section": "Messe des fidèles",
  "explication": "Le prologue de saint Jean conclut la messe.",
  "la": [
   "V:Dóminus vobíscum.",
   "R:Et cum spíritu tuo.",
   "V:Inítium sancti Evangélii secúndum Ioánnem.",
   "R:Glória tibi, Dómine.",
   "In princípio erat Verbum, et Verbum erat apud Deum, et Deus erat Verbum. Hoc erat in princípio apud Deum. Ómnia per ipsum facta sunt: et sine ipso factum est nihil, quod factum est: in ipso vita erat, et vita erat lux hóminum: et lux in ténebris lucet, et ténebræ eam non comprehendérunt.",
   "Fuit homo missus a Deo, cui nomen erat Ioánnes. Hic venit in testimónium, ut testimónium perhibéret de lúmine, ut omnes créderent per illum. Non erat ille lux, sed ut testimónium perhibéret de lúmine.",
   "Erat lux vera, quæ illúminat omnem hóminem veniéntem in hunc mundum. In mundo erat, et mundus per ipsum factus est, et mundus eum non cognóvit. In própria venit, et sui eum non recepérunt.",
   "Quotquot autem recepérunt eum, dedit eis potestátem fílios Dei fíeri, his, qui credunt in nómine eius: qui non ex sanguínibus, neque ex voluntáte carnis, neque ex voluntáte viri, sed ex Deo nati sunt.",
   "!On fléchit le genou :",
   "Et Verbum caro factum est, et habitávit in nobis: et vídimus glóriam eius, glóriam quasi Unigéniti a Patre, plenum grátiæ et veritátis.",
   "R:Deo grátias."
  ],
  "droits": "PUBLIC_DOMAIN"
 }
]
};
