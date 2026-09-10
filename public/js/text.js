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

  function splitLines(value) {
    var lines = String(value || "").split("\n");
    if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
    return lines;
  }

  function uniqueInOrder(lines) {
    var seen = {};
    var out = [];
    lines.forEach(function (line) {
      if (!Object.prototype.hasOwnProperty.call(seen, line)) {
        seen[line] = 1;
        out.push(line);
      }
    });
    return out;
  }

  function countsBy(lines) {
    var map = {};
    lines.forEach(function (l) {
      map[l] = (map[l] || 0) + 1;
    });
    return map;
  }

  function setOf(lines) {
    var s = {};
    lines.forEach(function (l) {
      s[l] = true;
    });
    return s;
  }

  function updateTextHighlights() {
    var aLines = splitLines(edA.ta.value);
    var bLines = splitLines(edB.ta.value);
    var aMark = new Array(aLines.length);
    var bMark = new Array(bLines.length);

    if (textState.mode === "dedupe") {
      var ac = countsBy(aLines);
      aLines.forEach(function (line, i) {
        if (ac[line] > 1) aMark[i] = "dup";
      });
    } else if (textState.mode === "intersect") {
      var bs = setOf(bLines);
      var as = setOf(aLines);
      aLines.forEach(function (line, i) {
        if (bs[line]) aMark[i] = "hit";
      });
      bLines.forEach(function (line, i) {
        if (as[line]) bMark[i] = "hit";
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
    var aLines = splitLines(edA.ta.value);
    var bLines = splitLines(edB.ta.value);
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
    if (edC.ta.value) {
      textState.stale = true;
      $("hintC").textContent = "输入已变化，点击“执行”更新";
    }
  }

  function modeName(m) {
    return m === "dedupe" ? "去重" : m === "intersect" ? "交集" : "并集";
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
    var aLines = splitLines(edA.ta.value);
    var bLines = splitLines(edB.ta.value);
    var out = [];

    if (textState.mode === "dedupe") {
      out = uniqueInOrder(aLines);
    } else if (textState.mode === "intersect") {
      var seen = {};
      var bs = setOf(bLines);
      aLines.forEach(function (line) {
        if (bs[line] && !Object.prototype.hasOwnProperty.call(seen, line)) {
          seen[line] = 1;
          out.push(line);
        }
      });
    } else {
      out = uniqueInOrder(aLines.concat(bLines));
    }

    var outText = out.join("\n");
    edC.ta.value = outText;
    refreshEditor(edC);
    textState.stale = false;
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
    $("hintA").textContent = "";
    $("hintB").textContent = "";
    $("hintC").textContent = modeDesc[textState.mode];
    updateTextHighlights();
  });

  setMode("dedupe");
})();
