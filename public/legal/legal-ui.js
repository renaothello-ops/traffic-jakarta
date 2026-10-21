(function () {
  var params = new URLSearchParams(window.location.search);
  var lang = (params.get("lang") || "en").trim();
  var notice = document.getElementById("tj-legal-lang-notice");
  if (!notice) return;
  if (lang === "en" || lang === "id") {
    notice.hidden = true;
    return;
  }
  notice.hidden = false;
  var labels = {
    ja: "日本語",
    ko: "한국어",
    "zh-Hans": "简体中文",
    "zh-Hant": "繁體中文",
  };
  var ui = labels[lang] || lang;
  notice.textContent =
    "UI language: " +
    ui +
    ". This legal draft is not yet fully translated. The English text below is for review only and is not a finalized legal agreement.";
})();
