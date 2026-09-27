/*
 * Mentio — widget agence.
 *
 *   <div id="mentio-widget"></div>
 *   <script src="https://www.mentio.fr/widget.js" data-agence="IDENTIFIANT" async></script>
 *
 * Insère une iframe vers /w/IDENTIFIANT, à la hauteur de son contenu.
 * Aucun cookie, aucun traceur : le script ne fait que ça.
 */
(function () {
  var script = document.currentScript;
  if (!script) return;
  var id = script.getAttribute("data-agence");
  if (!id || !/^[a-z0-9]{4,24}$/.test(id)) return;
  var origin = new URL(script.src).origin;
  var host = document.getElementById("mentio-widget");
  if (!host) {
    host = document.createElement("div");
    script.parentNode.insertBefore(host, script);
  }
  var frame = document.createElement("iframe");
  frame.src = origin + "/w/" + id;
  frame.title = "Test de visibilité IA";
  frame.loading = "lazy";
  frame.style.cssText = "width:100%;max-width:640px;height:460px;border:0;display:block;margin:0 auto;";
  host.appendChild(frame);
  window.addEventListener("message", function (event) {
    if (event.origin !== origin || !event.data || event.data.mentio !== "height" || event.data.id !== id) return;
    var h = Number(event.data.h);
    if (h > 200 && h < 2000) frame.style.height = h + "px";
  });
})();
