(function () {
  "use strict";

  var $ = window.ToolKit.$;
  var toast = window.ToolKit.toast;
  var copyText = window.ToolKit.copyText;
  var Core = window.MathCore;

  var PLACEHOLDER = "等待输入…";

  function setResult(id, text, isError) {
    var box = $(id);
    box.textContent = text;
    box.classList.toggle("error", !!isError);
    box.classList.toggle("muted", false);
  }

  function setEmpty(id, text) {
    var box = $(id);
    box.textContent = text || PLACEHOLDER;
    box.classList.remove("error");
    box.classList.add("muted");
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

  /* ---------- 文本计算 ---------- */
  function calculate() {
    var source = $("calc-expression").value;
    if (!source.trim()) {
      setEmpty("calc-result", "先输入一个算式，例如 (1 + 2.5) * 3");
      $("calc-expression").focus();
      return;
    }
    try {
      setResult("calc-result", String(Core.evaluateExpression(source)));
    } catch (err) {
      setResult("calc-result", "计算错误：" + err.message, true);
    }
  }

  $("calc-run").addEventListener("click", calculate);
  $("calc-expression").addEventListener("keydown", function (ev) {
    if (ev.key === "Enter") {
      ev.preventDefault();
      calculate();
    }
  });

  /* ---------- 进制转换 ---------- */
  function baseHint(text, isError) {
    var hint = $("base-hint");
    hint.textContent = text;
    hint.classList.toggle("error", !!isError);
  }

  // direction 为 'a2b' 时读 A 写 B，'b2a' 时反过来
  function convertBase(direction) {
    var fromValue = direction === "a2b" ? $("base-value-a").value : $("base-value-b").value;
    var toField = direction === "a2b" ? $("base-value-b") : $("base-value-a");
    var fromBase = direction === "a2b" ? $("base-a").value : $("base-b").value;
    var toBase = direction === "a2b" ? $("base-b").value : $("base-a").value;

    if (!fromValue.trim()) {
      toField.value = "";
      baseHint("例：A 填 FF、进制 16，B 就会显示 10 进制的 255。");
      return;
    }
    try {
      var converted = Core.convertBase(fromValue, fromBase, toBase);
      toField.value = converted;
      baseHint(
        Number(fromBase) + " 进制的 " + fromValue.trim() + " = " + Number(toBase) + " 进制的 " + converted
      );
    } catch (err) {
      baseHint(err.message, true);
    }
  }

  $("base-value-a").addEventListener("input", function () {
    convertBase("a2b");
  });
  $("base-a").addEventListener("input", function () {
    convertBase("a2b");
  });
  $("base-value-b").addEventListener("input", function () {
    convertBase("b2a");
  });
  $("base-b").addEventListener("input", function () {
    convertBase("b2a");
  });
  $("base-swap").addEventListener("click", function () {
    var valueA = $("base-value-a").value;
    var baseA = $("base-a").value;
    $("base-value-a").value = $("base-value-b").value;
    $("base-a").value = $("base-b").value;
    $("base-value-b").value = valueA;
    $("base-b").value = baseA;
    convertBase("a2b");
  });

  /* ---------- 随机数 ---------- */
  $("random-run").addEventListener("click", function () {
    try {
      var values = Core.randomInts(
        $("random-min").value,
        $("random-max").value,
        $("random-count").value,
        $("random-unique").checked
      );
      setResult("random-result", values.join("，"));
    } catch (err) {
      setResult("random-result", err.message, true);
    }
  });

  /* ---------- 日期 ---------- */
  function todayText() {
    var now = new Date();
    return (
      now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0")
    );
  }

  function dateDiff() {
    try {
      var start = Core.parseDateInput($("date-start").value);
      var end = Core.parseDateInput($("date-end").value);
      var days = Core.diffDays(start, end);
      var detail = "从 " + Core.formatDate(start) + "（" + Core.weekdayOf(start) + "）到 " +
        Core.formatDate(end) + "（" + Core.weekdayOf(end) + "）";
      var suffix = days < 0 ? "，结束日期比开始日期早" : "";
      setResult("date-diff-result", detail + "，相差 " + Math.abs(days) + " 天" + suffix + "。");
    } catch (err) {
      setResult("date-diff-result", err.message, true);
    }
  }

  function dateAdd() {
    try {
      var base = Core.parseDateInput($("date-base").value);
      var offset = Number($("date-offset").value);
      var result = Core.addDays(base, offset);
      setResult(
        "date-add-result",
        Core.formatDate(base) + " " + (offset >= 0 ? "加" : "减") + " " + Math.abs(offset) + " 天 = " +
          Core.formatDate(result) + "（" + Core.weekdayOf(result) + "）"
      );
    } catch (err) {
      setResult("date-add-result", err.message, true);
    }
  }

  $("date-diff-run").addEventListener("click", dateDiff);
  $("date-add-run").addEventListener("click", dateAdd);
  $("date-end-today").addEventListener("click", function () {
    $("date-end").value = todayText();
    dateDiff();
  });

  /* ---------- 抽取 / 排序 ---------- */
  function toItems(id) {
    return $(id)
      .value.split(/\r?\n/)
      .map(function (line) {
        return line.trim();
      })
      .filter(Boolean);
  }

  $("pick-run").addEventListener("click", function () {
    var items = toItems("pick-items");
    $("pick-hint").textContent = "候选 " + items.length + " 项";
    try {
      var values = Core.sample(items, $("pick-count").value, $("pick-unique").checked);
      setResult("pick-result", values.join("\n"));
    } catch (err) {
      setResult("pick-result", err.message, true);
    }
  });

  $("shuffle-run").addEventListener("click", function () {
    var items = toItems("shuffle-items");
    if (!items.length) {
      setResult("shuffle-result", "请先输入待排序内容，每行一项。", true);
      return;
    }
    setResult("shuffle-result", Core.shuffle(items).join("\n"));
  });

  /* ---------- UUID ---------- */
  $("uuid-run").addEventListener("click", function () {
    var count = Number($("uuid-count").value);
    if (!Number.isInteger(count) || count < 1 || count > 10000) {
      setResult("uuid-result", "生成个数需要在 1 到 10000 之间。", true);
      return;
    }
    var hyphen = $("uuid-hyphen").checked;
    var upper = $("uuid-upper").checked;
    var values = [];
    for (var i = 0; i < count; i++) {
      var uuid = Core.makeUuid();
      if (!hyphen) uuid = uuid.replace(/-/g, "");
      values.push(upper ? uuid.toUpperCase() : uuid);
    }
    setResult("uuid-result", values.join("\n"));
  });

  /* ---------- 初始化 ---------- */
  $("date-end").value = todayText();
  $("date-base").value = todayText();
})();
