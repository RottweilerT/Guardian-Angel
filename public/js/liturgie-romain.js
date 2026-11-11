// Calendrier liturgique romain (France) — calcul pur, sans dépendance.
/* ---------- Dates ---------- */
export const DAY=86400000;
export const dn=(y,m,d)=>Math.floor(Date.UTC(y,m-1,d)/DAY);
export const ymd=n=>{const t=new Date(n*DAY);return [t.getUTCFullYear(),t.getUTCMonth()+1,t.getUTCDate()]};
export const iso=n=>{const [y,m,d]=ymd(n);return y+"-"+String(m).padStart(2,"0")+"-"+String(d).padStart(2,"0")};
export const fromIso=s=>{const [y,m,d]=s.split("-").map(Number);return dn(y,m,d)};
export const dow=n=>(((n+4)%7)+7)%7;
export const sob=n=>n-dow(n);
export const JOURS=["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"];
export const MOIS=["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
export const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);
const ord=k=>k===1?"1er":k+"e";
const ordF=k=>k===1?"1re":k+"e";
export const longDate=n=>{const [y,m,d]=ymd(n);return JOURS[dow(n)]+" "+(d===1?"1er":d)+" "+MOIS[m-1]+" "+y};
export const todayN=()=>{const t=new Date();return dn(t.getFullYear(),t.getMonth()+1,t.getDate())};

export function easter(y){const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),mo=Math.floor((h+l-7*m+114)/31),da=((h+l-7*m+114)%31)+1;return dn(y,mo,da)}
export function advent1(y){const x=dn(y,12,25);return x-(dow(x)||7)-21}
export function epiphany(y){const j2=dn(y,1,2);return j2+((7-dow(j2))%7)} // France : dimanche entre le 2 et le 8 janvier
export function baptism(y){const ep=epiphany(y);return ep>=dn(y,1,7)?ep+1:ep+7}

/* ---------- Couleurs ---------- */
export const COUL={vert:"#3d7a4f",violet:"#6b3f8f",rose:"#d9879a",blanc:"#c9a646",rouge:"#a3271f",noir:"#333"};

/* ---------- Fêtes fixes (France) : [mois,jour,titre,rang,couleur,feteDuSeigneur] ---------- */
export const FIXES=[
 [1,1,"Sainte Marie, Mère de Dieu","solennite","blanc"],
 [1,25,"Conversion de saint Paul","fete","blanc"],
 [2,2,"Présentation du Seigneur au Temple","fete","blanc",1],
 [2,22,"Chaire de saint Pierre","fete","blanc"],
 [3,19,"Saint Joseph, époux de la Vierge Marie","solennite","blanc"],
 [3,25,"Annonciation du Seigneur","solennite","blanc"],
 [4,25,"Saint Marc, évangéliste","fete","rouge"],
 [5,3,"Saints Philippe et Jacques, apôtres","fete","rouge"],
 [5,14,"Saint Matthias, apôtre","fete","rouge"],
 [5,31,"Visitation de la Vierge Marie","fete","blanc"],
 [6,24,"Nativité de saint Jean-Baptiste","solennite","blanc"],
 [6,29,"Saint Pierre et saint Paul, apôtres","solennite","rouge"],
 [7,3,"Saint Thomas, apôtre","fete","rouge"],
 [7,22,"Sainte Marie-Madeleine","fete","blanc"],
 [7,25,"Saint Jacques, apôtre","fete","rouge"],
 [8,6,"Transfiguration du Seigneur","fete","blanc",1],
 [8,10,"Saint Laurent, diacre et martyr","fete","rouge"],
 [8,15,"Assomption de la Vierge Marie","solennite","blanc"],
 [8,24,"Saint Barthélemy, apôtre","fete","rouge"],
 [9,8,"Nativité de la Vierge Marie","fete","blanc"],
 [9,14,"La Croix glorieuse","fete","rouge",1],
 [9,21,"Saint Matthieu, apôtre et évangéliste","fete","rouge"],
 [9,29,"Saints Michel, Gabriel et Raphaël, archanges","fete","blanc"],
 [10,18,"Saint Luc, évangéliste","fete","rouge"],
 [10,28,"Saint Simon et saint Jude, apôtres","fete","rouge"],
 [11,1,"Tous les Saints","solennite","blanc"],
 [11,2,"Commémoration de tous les fidèles défunts","defunts","violet"],
 [11,9,"Dédicace de la basilique du Latran","fete","blanc",1],
 [11,30,"Saint André, apôtre","fete","rouge"],
 [12,8,"Immaculée Conception de la Vierge Marie","solennite","blanc"],
 [12,26,"Saint Étienne, premier martyr","fete","rouge"],
 [12,27,"Saint Jean, apôtre et évangéliste","fete","blanc"],
 [12,28,"Les saints Innocents, martyrs","fete","rouge"]
];

/* ---------- Calcul du jour liturgique ---------- */
export function liturgie(n){
  const [y,m,d]=ymd(n), w=dow(n), J=cap(JOURS[w]);
  const E=easter(y), ash=E-46, pent=E+49, A1=advent1(y), xmas=dn(y,12,25), bapt=baptism(y), ep=epiphany(y);
  const L=n>=A1?y+1:y;
  const annee=["C","A","B"][L%3], cycle=L%2===0?"II":"I";
  let r={titre:"",temps:"",couleur:"vert",rang:w===0?"dimanche":"ferie",privil:false,octave:false};

  if(n>=A1&&n<xmas){
    r.temps="Avent";r.couleur="violet";const k=(sob(n)-A1)/7+1;
    if(w===0){r.titre=ord(k)+" dimanche de l'Avent";if(k===3)r.couleur="rose";r.privil=true}
    else if(d>=17){r.titre=J+" "+d+" décembre";r.privil=true}
    else r.titre=J+" de la "+ordF(k)+" semaine de l'Avent";
  } else if(n>=xmas||n<=bapt){
    r.temps="Temps de Noël";r.couleur="blanc";
    const hol=n>=xmas?(()=>{for(let i=1;i<=6;i++){if(dow(xmas+i)===0)return xmas+i}return dn(y,12,30)})():null;
    if(n===xmas){r.titre="Nativité du Seigneur";r.rang="solennite";r.octave=true}
    else if(hol!==null&&n===hol){r.titre="La Sainte Famille de Jésus, Marie et Joseph";r.rang="fete"}
    else if(n>xmas){r.titre=J+" dans l'octave de la Nativité";r.octave=true;r.privil=true}
    else if(m===1&&d===1){r.titre="Sainte Marie, Mère de Dieu";r.rang="solennite"}
    else if(n===ep){r.titre="Épiphanie du Seigneur";r.rang="solennite"}
    else if(n===bapt){r.titre="Baptême du Seigneur";r.rang="fete"}
    else r.titre=J+" "+(d===1?"1er":d)+" janvier, temps de Noël";
  } else if(n<ash){
    r.temps="Temps ordinaire";const k=(sob(n)-sob(bapt))/7+1;
    r.titre=w===0?ord(k)+" dimanche du temps ordinaire":J+" de la "+ordF(k)+" semaine du temps ordinaire";
  } else if(n<E){
    r.temps="Carême";r.couleur="violet";r.privil=true;
    if(n===ash){r.titre="Mercredi des Cendres";r.rang="ferie-maj"}
    else if(n<E-42){r.titre=J+" après les Cendres"}
    else if(n>=E-7){
      r.temps="Semaine sainte";
      if(n===E-7){r.titre="Dimanche des Rameaux et de la Passion du Seigneur";r.couleur="rouge"}
      else if(n===E-3){r.titre="Jeudi saint — Messe en mémoire de la Cène du Seigneur";r.couleur="blanc";r.rang="triduum";r.gloriaForce=true}
      else if(n===E-2){r.titre="Vendredi saint — Célébration de la Passion du Seigneur";r.couleur="rouge";r.rang="triduum";r.pasDeMesse=true}
      else if(n===E-1){r.titre="Samedi saint — Veillée pascale dans la nuit";r.couleur="blanc";r.rang="triduum"}
      else r.titre=J+" saint";
    } else {
      const k=(sob(n)-(E-42))/7+1;
      if(w===0){r.titre=ord(k)+" dimanche de Carême";if(k===4)r.couleur="rose"}
      else r.titre=J+" de la "+ordF(k)+" semaine de Carême";
    }
  } else if(n<=pent){
    r.temps="Temps pascal";r.couleur="blanc";const k=(sob(n)-E)/7+1;
    if(n===E){r.titre="Dimanche de Pâques — La Résurrection du Seigneur";r.rang="solennite";r.octave=true}
    else if(n<E+7){r.titre=J+" dans l'octave de Pâques";r.rang="solennite";r.octave=true;r.privil=true}
    else if(n===E+39){r.titre="Ascension du Seigneur";r.rang="solennite"}
    else if(n===pent){r.titre="Dimanche de la Pentecôte";r.rang="solennite";r.couleur="rouge"}
    else if(w===0){r.titre=ord(k)+" dimanche de Pâques"+(k===2?" — de la Divine Miséricorde":"");r.privil=true}
    else r.titre=J+" de la "+ordF(k)+" semaine du temps pascal";
  } else {
    r.temps="Temps ordinaire";const k=34-(A1-7-sob(n))/7;
    r.titre=w===0?ord(k)+" dimanche du temps ordinaire":J+" de la "+ordF(k)+" semaine du temps ordinaire";
  }
  r.base=r.titre;

  // célébrations mobiles et fixes
  const cand=[];
  const mob=[[pent+7,"La Sainte Trinité","solennite","blanc"],[pent+14,"Le Saint-Sacrement du Corps et du Sang du Christ","solennite","blanc"],
             [pent+19,"Le Sacré-Cœur de Jésus","solennite","blanc"],[pent+1,"La Vierge Marie, Mère de l'Église","memoire","blanc"],
             [pent+20,"Le Cœur immaculé de Marie","memoire","blanc"],[A1-7,"Notre Seigneur Jésus Christ, Roi de l'univers","solennite","blanc"]];
  mob.forEach(x=>{if(x[0]===n)cand.push({titre:x[1],rang:x[2],couleur:x[3],seigneur:1})});
  FIXES.forEach(f=>{if(f[0]===m&&f[1]===d&&!(m===1&&d===1))cand.push({titre:f[2],rang:f[3],couleur:f[4],seigneur:!!f[5]})});
  const c=cand[0];
  if(c&&r.rang!=="triduum"&&!(r.octave&&r.temps==="Temps pascal")&&r.rang!=="solennite"){
    const sundayPriv=w===0&&(r.temps==="Avent"||r.temps==="Carême"||r.temps==="Semaine sainte"||r.temps==="Temps pascal");
    let win=false;
    if(c.rang==="solennite")win=!sundayPriv;
    else if(c.rang==="defunts")win=!sundayPriv;
    else if(c.rang==="fete")win=w!==0?!(r.temps==="Semaine sainte"||r.rang==="ferie-maj"):(c.seigneur&&(r.temps==="Temps ordinaire"||r.temps==="Temps de Noël"));
    else if(c.rang==="memoire")win=w!==0&&!r.privil&&r.temps!=="Carême";
    if(win){r.titre=c.titre;r.rang=c.rang;r.couleur=c.couleur;r.sousTitre=c.rang==="memoire"?null:r.base}
  }
  r.dimanche=w===0;
  r.gloria=r.gloriaForce||r.rang==="solennite"||r.rang==="fete"||r.octave||(w===0&&!["Avent","Carême","Semaine sainte"].includes(r.temps));
  if(r.rang==="defunts")r.gloria=false;
  r.credo=(w===0||r.rang==="solennite")&&r.rang!=="defunts";
  r.deuxLectures=w===0||r.rang==="solennite";
  r.alleluia=!(r.temps==="Carême"||r.temps==="Semaine sainte");
  r.paschalEnvoi=r.temps==="Temps pascal"&&(r.octave||n===pent);
  r.annee=annee;r.cycle=cycle;
  return r;
}

