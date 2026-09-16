(function () {
  "use strict";

  var $ = window.ToolKit.$;
  var toast = window.ToolKit.toast;
  var copyText = window.ToolKit.copyText;
  var Core = window.TimestampCore;

  var state = { milliseconds: false, paused: false };

  function setResult(id, text, isError) {
    var box = $(id);
    box.textContent = text;
    box.classList.toggle("error", !!isError);
    box.classList.toggle("muted", false);
  }

  function setEmpty(id, text) {
    var box = $(id);
    box.textContent = text;
    box.classList.remove("error");
    box.classList.add("muted");
  }

  function setMeta(id, text) {
    $(id).textContent = text;
  }

  function clearMeta(ids) {
    ids.forEach(function (id) {
      setMeta(id, "—");
    });
  }

  document.querySelectorAll("[data-copy]").forEach(function (button) {
    button.addEventListener("click", function () {
      var box = $(button.getAttribute("data-copy"));
      if (!box || box.classList.contains("muted") || box.classList.contains("error")) {
        toast("还没有可复制的结果");
        return;
      }
      copyText(box.textContent, "已复制到剪贴板");
    });
  });

  /* ---------- 顶部实时时间 ---------- */
  function refreshLive() {
    if (state.paused) return;
    var now = new Date();
    var millis = now.getTime();
    $("live-time").textContent = Core.formatTime(millis, { withMillis: state.milliseconds });
    $("live-stamp").textContent =
      (state.milliseconds ? "毫秒" : "秒") + "级时间戳：" + (state.milliseconds ? millis : Math.floor(millis / 1000));
  }

  $("live-unit").addEventListener("click", function () {
    state.milliseconds = !state.milliseconds;
    $("live-unit").textContent = state.milliseconds ? "显示秒" : "显示毫秒";
    state.paused = false;
    $("live-pause").textContent = "暂停";
    refreshLive();
  });

  $("live-pause").addEventListener("click", function () {
    state.paused = !state.paused;
    $("live-pause").textContent = state.paused ? "继续" : "暂停";
    if (!state.paused) refreshLive();
  });

  $("live-copy").addEventListener("click", function () {
    var millis = Date.now();
    copyText(String(state.milliseconds ? millis : Math.floor(millis / 1000)), "已复制当前时间戳");
  });

  /* ---------- 时间 → 时间戳 ---------- */
  function convertTime() {
    var millis = Core.parseLocalInput($("time-input").value);
    if (Number.isNaN(millis)) {
      setResult("time-result", "请选择有效的时间（年-月-日 时:分）", true);
      clearMeta(["time-meta-local", "time-meta-relative", "time-meta-unit"]);
      return;
    }
    var unit = $("time-unit").value;
    var stamp = unit === "seconds" ? Math.floor(millis / 1000) : millis;
    setResult("time-result", String(stamp));
    setMeta("time-meta-local", Core.formatTime(millis, { withMillis: true }));
    setMeta("time-meta-relative", Core.relativeText(millis));
    setMeta("time-meta-unit", unit === "seconds" ? "秒级 · 10 位" : "毫秒级 · 13 位");
  }

  function useTime(millis) {
    $("time-input").value = Core.toLocalInput(millis);
    convertTime();
  }

  $("time-run").addEventListener("click", convertTime);
  $("time-unit").addEventListener("change", function () {
    if ($("time-input").value) convertTime();
  });
  $("time-input").addEventListener("change", function () {
    if ($("time-input").value) convertTime();
  });

  // 常用时间一键填入：现在 / 今天 0 点 / 昨天 0 点 / 明天 0 点 / 7 天后
  document.querySelectorAll("[data-quick]").forEach(function (button) {
    button.addEventListener("click", function () {
      var now = new Date();
      var dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      var day = 86400000;
      var map = {
        now: now.getTime(),
        today: dayStart,
        yesterday: dayStart - day,
        tomorrow: dayStart + day,
        plus7: dayStart + 7 * day,
      };
      var target = map[button.getAttribute("data-quick")];
      if (target === undefined) return;
      useTime(target);
    });
  });

  /* ---------- 时间戳 → 时间 ---------- */
  function convertStamp() {
    var raw = $("stamp-input").value;
    if (!raw.trim()) {
      setEmpty("stamp-result", "等待输入…");
      clearMeta(["stamp-meta-utc", "stamp-meta-relative", "stamp-meta-unit"]);
      return;
    }
    try {
      var preferred = $("stamp-unit").value;
      var parsed = Core.parseStamp(raw, preferred || undefined);
      // 手动选了单位但位数明显不符时，把下拉同步成实际用的单位，避免下次又猜错
      if ($("stamp-unit").value && $("stamp-unit").value !== parsed.unit) $("stamp-unit").value = parsed.unit;
      setResult("stamp-result", Core.formatTime(parsed.millis, { withMillis: parsed.unit === "milliseconds" }));
      setMeta("stamp-meta-utc", Core.formatTime(parsed.millis, { withMillis: true, timeZone: "UTC" }));
      setMeta("stamp-meta-relative", Core.relativeText(parsed.millis));
      setMeta("stamp-meta-unit", parsed.unit === "seconds" ? "秒级 · 10 位" : "毫秒级 · 13 位");
    } catch (err) {
      setResult("stamp-result", err.message, true);
      clearMeta(["stamp-meta-utc", "stamp-meta-relative", "stamp-meta-unit"]);
    }
  }

  document.querySelectorAll("[data-stamp]").forEach(function (button) {
    button.addEventListener("click", function () {
      var millis = button.getAttribute("data-stamp") === "zero" ? 0 : Date.now();
      $("stamp-unit").value = "milliseconds";
      $("stamp-input").value = String(millis);
      convertStamp();
    });
  });

  $("stamp-run").addEventListener("click", convertStamp);
  $("stamp-unit").addEventListener("change", convertStamp);
  $("stamp-input").addEventListener("input", convertStamp);
  $("stamp-input").addEventListener("keydown", function (ev) {
    if (ev.key === "Enter") {
      ev.preventDefault();
      convertStamp();
    }
  });

  /* ---------- 初始化 ---------- */
  $("zone-label").textContent = Core.localZoneLabel(Date.now());
  $("time-input").value = Core.toLocalInput(Date.now());
  $("stamp-input").value = String(Math.floor(Date.now() / 1000));
  convertTime();
  convertStamp();
  refreshLive();
  setInterval(refreshLive, 1000);
})();
