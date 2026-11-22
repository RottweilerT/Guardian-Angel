// Apparence (mode normal / mode nuit / automatique) — script classique chargé dans <head> pour éviter un flash clair au démarrage.
(function () {
  var choix = "jour", sys = window.matchMedia ? matchMedia("(prefers-color-scheme: dark)") : null;
  try { var v = JSON.parse(localStorage.getItem("ga2-pref-apparence")); if (v === "nuit" || v === "auto" || v === "jour") choix = v; } catch (e) { /* stockage indisponible */ }
  function appliquer() {
    var nuit = choix === "nuit" || (choix === "auto" && sys && sys.matches);
    document.documentElement.dataset.mode = nuit ? "nuit" : "jour";
    document.documentElement.style.colorScheme = nuit ? "dark" : "light";
    var t = document.querySelector('meta[name="theme-color"]'); if (t) t.content = nuit ? "#14161B" : "#FFFFFF";
  }
  appliquer();
  if (sys && sys.addEventListener) sys.addEventListener("change", appliquer);
  window.gaApparence = function (v) { choix = v; appliquer(); };
})();
