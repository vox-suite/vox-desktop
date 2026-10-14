(function () {
  var root = document.documentElement;
  var query = matchMedia("(prefers-color-scheme: light)");
  var pref = "auto";
  try {
    pref = localStorage.getItem("vox-theme") || "auto";
  } catch (e) {}
  root.dataset.themePref = pref;
  function apply() {
    var p = root.dataset.themePref;
    root.dataset.theme = p === "light" || p === "dark" ? p : query.matches ? "light" : "dark";
  }
  apply();
  query.addEventListener("change", apply);
})();
