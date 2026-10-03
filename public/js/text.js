'use strict';
(function () {
  "use strict";

  var $ = window.ToolKit.$;
  var makeEditor = window.ToolKit.makeEditor;
  var refreshEditor = window.ToolKit.refreshEditor;
  var toast = window.ToolKit.toast;
  var copyText = window.ToolKit.copyText;

  var textState = {
    mode: "dedupe",
    stale: false,
  };

  var modeDesc = {
    dedupe: "只使用 A：删除 A 中重复行，保留首次出现的顺序。",
    intersect: "取 A 与 B 都包含的行，按 A 中首次出现顺序去重输出。",
    union: "A 与 B 的所有行合并，按出现顺序去重输出。",
    subtract: "只在 A 中出现、B 中没有的行。",
    reverseSubtract: "只在 B 中出现、A 中没有的行。",
  };

  var edA = makeEditor("editorA", {
    placeholder: "A：每行一条数据",
    onInput: onTextInput,
  });
  var edB = makeEditor("editorB", {
    placeholder: "B：每行一条数据（交集/并集使用）",
    onInput: onTextInput,
  });
  var edC = makeEditor("editorC", {
    readOnly: true,
    placeholder: "C：结果将在这里显示",
  });

  // 这四个在 text-core.js 里（浏览器/Node 都能加载，便于单测）
  var splitLines = window.TextCore.splitLines;
  var uniqueInOrder = window.TextCore.uniqueInOrder;
  var countsBy = window.TextCore.countsBy;
  var setOf = window.TextCore.setOf;

  function updateTextHighlights() {
    var aLines = edA.ta.value ? splitLines(edA.ta.value) : [];
    var bLines = edB.ta.value ? splitLines(edB.ta.value) : [];
    if ($("text-trim").checked) {
      aLines = aLines.map(function (line) { return line.trim(); });
      bLines = bLines.map(function (line) { return line.trim(); });
    }
    var aMark = new Array(aLines.length);
    var bMark = new Array(bLines.length);

    if (textState.mode === "dedupe") {
      var ac = countsBy(aLines);
      aLines.forEach(function (line, i) {
        if (ac[line] > 1 && (!$("text-empty").checked || line.trim())) aMark[i] = "dup";
      });
    } else if (textState.mode === "intersect") {
      var bs = setOf(bLines);
      var as = setOf(aLines);
      aLines.forEach(function (line, i) {
        if (bs[line] && (!$("text-empty").checked || line.trim())) aMark[i] = "hit";
      });
      bLines.forEach(function (line, i) {
        if (as[line] && (!$("text-empty").checked || line.trim())) bMark[i] = "hit";
      });
    }

    edA.markFn = function () {
      return aMark;
    };
    edB.markFn = function () {
      return bMark;
    };
    refreshEditor(edA);
    refreshEditor(edB);
  }

  function onTextInput() {
    var aLines = edA.ta.value ? splitLines(edA.ta.value) : [];
    var bLines = edB.ta.value ? splitLines(edB.ta.value) : [];
    var aDup = 0;
    if (textState.mode === "dedupe") {
      var ac = countsBy(aLines);
      aLines.forEach(function (l) {
        if (ac[l] > 1) aDup++;
      });
    }
    $("hintA").textContent = aLines.length + " 行" + (aDup ? " · 重复 " + aDup + " 行" : "");
    $("hintB").textContent = bLines.length + " 行";
    updateTextHighlights();
    $("text-copy").disabled = true;
    if (edC.ta.value) {
      textState.stale = true;
      $("hintC").textContent = "输入已变化，点击“执行”更新";
    }
  }

  function modeName(m) {
    return { dedupe: "去重", intersect: "交集", union: "并集", subtract: "A − B", reverseSubtract: "B − A" }[m];
  }

  function setMode(mode) {
    textState.mode = mode;
    document.querySelectorAll("#text-mode-seg .seg-btn").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-mode") === mode);
    });
    onTextInput();
    $("hintC").textContent = edC.ta.value
      ? "模式已切换为“" + modeName(mode) + "”，点击“执行”更新"
      : modeDesc[mode];
  }

  function runTextTool() {
    var out = window.TextCore.processLines(textState.mode, edA.ta.value, edB.ta.value, {
      trim: $("text-trim").checked,
      skipEmpty: $("text-empty").checked,
      sort: $("text-sort").checked,
    });

    var outText = out.join("\n");
    edC.ta.value = outText;
    refreshEditor(edC);
    textState.stale = false;
    $("text-copy").disabled = !outText;
    $("hintC").textContent =
      modeName(textState.mode) + "完成：C 共 " + out.length + " 行";
    toast(modeName(textState.mode) + "完成，共 " + out.length + " 行");
  }

  document.querySelectorAll("#text-mode-seg .seg-btn").forEach(function (b) {
    b.addEventListener("click", function () {
      setMode(b.getAttribute("data-mode"));
    });
  });

  $("text-execute").addEventListener("click", runTextTool);
  $("text-copy").addEventListener("click", function () {
    copyText(edC.ta.value, "已复制 C 内容");
  });
  $("text-clear").addEventListener("click", function () {
    edA.ta.value = "";
    edB.ta.value = "";
    edC.ta.value = "";
    refreshEditor(edA);
    refreshEditor(edB);
    refreshEditor(edC);
    textState.stale = false;
    $("text-copy").disabled = true;
    edA.ta.focus();
    $("hintA").textContent = "";
    $("hintB").textContent = "";
    $("hintC").textContent = modeDesc[textState.mode];
    updateTextHighlights();
  });

  $("text-swap").addEventListener("click", function () {
    var previous = edA.ta.value; edA.ta.value = edB.ta.value; edB.ta.value = previous;
    onTextInput();
  });
  ["text-trim", "text-empty", "text-sort"].forEach(function (id) { $(id).addEventListener("change", onTextInput); });
  window.ToolKit.bindRun([edA, edB], runTextTool);
  window.ToolKit.addDownload("text-copy", function () { return edC.ta.value; }, "文本结果.txt");
  setMode("dedupe");
})();
