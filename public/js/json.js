(function () {
  "use strict";

  var $ = window.ToolKit.$;
  var makeEditor = window.ToolKit.makeEditor;
  var refreshEditor = window.ToolKit.refreshEditor;
  var copyText = window.ToolKit.copyText;
  var toast = window.ToolKit.toast;

  var jsonState = {
    data: null,
    mode: "pretty", // pretty | compact
    rows: [],
    collapsed: new Set(),
    parseNote: "",
  };

  var edJsonA = makeEditor("editorJsonA", {
    placeholder: 'A：例如 {"name":"Bob","tags":["a","b"],"ok":true}',
    spellcheck: false,
    softWrap: true,
    onInput: scheduleJsonParse,
  });

  var jsonRowsEl = $("json-rows");
  var jsonEmptyEl = $("json-empty");
  var jsonErrorEl = $("json-error");

  var jsonTimer = null;
  function scheduleJsonParse() {
    clearTimeout(jsonTimer);
    jsonTimer = setTimeout(parseJsonInput, 260);
  }

  function parseJsonInput() {
    var raw = edJsonA.ta.value;
    jsonState.parseNote = "";
    if (!raw.trim()) {
      jsonState.data = null;
      jsonState.rows = [];
      jsonState.collapsed.clear();
      jsonEmptyEl.classList.remove("hidden");
      jsonRowsEl.classList.add("hidden");
      jsonErrorEl.classList.add("hidden");
      jsonErrorEl.textContent = "";
      $("json-b-hint").textContent = "等待输入";
      $("json-copy").disabled = true;
      return;
    }

    var data = null;
    var firstErr = null;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      firstErr = e;
    }

    if (data === null) {
      jsonState.data = null;
      jsonState.rows = [];
      jsonState.collapsed.clear();
      jsonEmptyEl.classList.add("hidden");
      jsonRowsEl.classList.add("hidden");
      jsonErrorEl.textContent = "JSON 解析失败：\n" + (firstErr ? firstErr.message : "格式错误");
      jsonErrorEl.classList.remove("hidden");
      $("json-b-hint").textContent = "解析失败";
      $("json-copy").disabled = true;
      return;
    }

    jsonState.data = data;
    jsonState.rows = buildJsonRows(data);
    jsonState.collapsed.clear();
    $("json-copy").disabled = false;
    jsonEmptyEl.classList.add("hidden");
    jsonErrorEl.classList.add("hidden");
    jsonErrorEl.textContent = "";
    renderJsonOutput();
  }

  function decodeEscapedText(raw) {
    return String(raw).replace(
      /\\(u\{[0-9A-Fa-f]+\}|u[0-9A-Fa-f]{4}|[nrtbf"\'\\\/])/g,
      function (whole, code) {
        var c = code.charAt(0);
        if (c === "u") {
          var hex = code.slice(1).replace(/[{}]/g, "");
          var n = parseInt(hex, 16);
          if (!isFinite(n)) return whole;
          try {
            return String.fromCodePoint(n);
          } catch (e) {
            return whole;
          }
        }
        var map = {
          n: "\n",
          r: "\r",
          t: "\t",
          b: "\b",
          f: "\f",
          '"': '"',
          "'": "'",
          "\\": "\\",
          "/": "/",
        };
        return map[c] !== undefined ? map[c] : whole;
      }
    );
  }

  /* ---------- JSON 行模型 ---------- */
  function scalarHtml(value) {
    if (value === null) return '<span class="tk-null">null</span>';
    if (typeof value === "boolean") {
      return '<span class="tk-bool">' + (value ? "true" : "false") + "</span>";
    }
    if (typeof value === "number") {
      if (!isFinite(value)) return '<span class="tk-null">' + String(value) + "</span>";
      return '<span class="tk-num">' + window.ToolKit.esc(String(value)) + "</span>";
    }
    if (typeof value === "string") {
      return '<span class="tk-str">' + window.ToolKit.esc(JSON.stringify(value)) + "</span>";
    }
    return window.ToolKit.esc(JSON.stringify(value));
  }

  function keyPrefixHtml(key) {
    if (key === null || key === undefined) return "";
    return (
      '<span class="tk-key">' + window.ToolKit.esc(JSON.stringify(key)) + "</span>" +
      '<span class="tk-punc">:</span> '
    );
  }

  function pushRow(rows, depth, html) {
    var row = { depth: depth, html: html, comma: false };
    rows.push(row);
    row.index = rows.length - 1;
    return row;
  }

  function isContainer(v) {
    return v !== null && typeof v === "object";
  }

  function buildJsonRows(root) {
    var rows = [];

    function emit(value, key, depth, isLast) {
      var container = isContainer(value);
      var arr = Array.isArray(value);
      var entries = [];
      if (container && !arr) entries = Object.keys(value);
      else if (container && arr) entries = value;

      var prefix = keyPrefixHtml(key);
      if (container && entries.length) {
        var openRow = pushRow(rows, depth, prefix + '<span class="tk-punc">' + (arr ? "[" : "{") + "</span>");
        openRow.container = true;
        openRow.kind = arr ? "array" : "object";

        if (arr) {
          entries.forEach(function (item, idx) {
            emit(item, null, depth + 1, idx === entries.length - 1);
          });
        } else {
          entries.forEach(function (k, idx) {
            emit(value[k], k, depth + 1, idx === entries.length - 1);
          });
        }

        var closeRow = pushRow(rows, depth, '<span class="tk-punc">' + (arr ? "]" : "}") + "</span>");
        closeRow.isClose = true;
        closeRow.openIndex = openRow.index;
        closeRow.closeChar = arr ? "]" : "}";
        openRow.closeIndex = closeRow.index;
        openRow.closeChar = arr ? "]" : "}";
        if (!isLast) closeRow.comma = true;
      } else {
        var head;
        if (!container) {
          head = scalarHtml(value);
        } else {
          head =
            '<span class="tk-punc">' +
            (arr ? "[" : "{") +
            "</span>" +
            '<span class="tk-punc">' +
            (arr ? "]" : "}") +
            "</span>";
        }
        var row = pushRow(rows, depth, prefix + head);
        if (!isLast) row.comma = true;
      }
    }

    emit(root, null, 0, true);
    return rows;
  }

  function rowCommaHtml(row) {
    return row.comma ? '<span class="tk-punc">,</span>' : "";
  }

  function renderJsonOutput() {
    var data = jsonState.data;
    if (!data) return;

    if (jsonState.mode === "compact") {
      var compactText = JSON.stringify(data);
      jsonRowsEl.innerHTML =
        '<div class="jrow compact-row">' +
        '<span class="jln">1</span>' +
        '<span class="jcontent">' +
        colorizeJsonText(compactText) +
        "</span></div>";
      jsonRowsEl.classList.remove("hidden");
      $("json-b-hint").textContent =
        "已压缩为 1 行 · " + compactText.length + " 字符";
      return;
    }

    var rows = jsonState.rows;
    var collapsed = jsonState.collapsed;
    var hiddenUntil = -1;
    var lineNo = 1;
    var parts = [];

    for (var i = 0; i < rows.length; i++) {
      if (i <= hiddenUntil) continue;
      var r = rows[i];
      var content;
      if (r.container && collapsed.has(i)) {
        content =
          r.html +
          '<span class="tk-dots"> … </span>' +
          '<span class="tk-punc">' + r.closeChar + "</span>";
        hiddenUntil = Math.max(hiddenUntil, r.closeIndex);
      } else {
        content = r.html + rowCommaHtml(r);
      }

      var toggle = "";
      if (r.container) {
        toggle =
          '<button class="j-toggle' +
          (collapsed.has(i) ? " collapsed" : "") +
          '" data-row="' +
          i +
          '" type="button" title="' +
          (collapsed.has(i) ? "展开" : "收起") +
          '" aria-label="' +
          (collapsed.has(i) ? "展开" : "收起") +
          '">&#9660;</button>';
      } else {
        toggle = '<span class="j-toggle-placeholder"></span>';
      }

      parts.push(
        '<div class="jrow"><span class="jln">' + lineNo + "</span>" +
        '<span class="jcontent" style="padding-left:' +
        r.depth * 18 +
        'px">' +
        toggle +
        content +
        "</span></div>"
      );
      lineNo++;
    }

    jsonRowsEl.innerHTML = parts.join("");
    jsonRowsEl.classList.remove("hidden");
    var fmt = JSON.stringify(data, null, 2);
    var note = jsonState.parseNote ? " · " + jsonState.parseNote : "";
    $("json-b-hint").textContent =
      "已格式化 " + fmt.split("\n").length + " 行 · " +
      (lineNo - 1) + " 行可见 · 可点击三角折叠" + note;
  }

  function colorizeJsonText(text) {
    var out = "";
    var i = 0;

    function push(cls, token) {
      out += '<span class="' + cls + '">' + window.ToolKit.esc(token) + "</span>";
    }

    while (i < text.length) {
      var ch = text.charAt(i);
      if (ch === '"') {
        var j = i + 1;
        while (j < text.length) {
          if (text.charAt(j) === "\\") {
            j += 2;
            continue;
          }
          if (text.charAt(j) === '"') break;
          j++;
        }
        j = Math.min(j + 1, text.length);
        var strTok = text.slice(i, j);
        var k = j;
        while (k < text.length && /\s/.test(text.charAt(k))) k++;
        var isKey = text.charAt(k) === ":";
        push(isKey ? "tk-key" : "tk-str", strTok);
        i = j;
        if (isKey) {
          while (i < text.length && /\s/.test(text.charAt(i))) {
            out += window.ToolKit.esc(text.charAt(i));
            i++;
          }
          if (text.charAt(i) === ":") {
            push("tk-punc", ":");
            i++;
          }
        }
        continue;
      }
      if (ch === "-" || (ch >= "0" && ch <= "9")) {
        var n0 = i;
        while (i < text.length && /[0-9.eE+\-]/.test(text.charAt(i))) i++;
        push("tk-num", text.slice(n0, i));
        continue;
      }
      if (text.slice(i, i + 5) === "false") {
        push("tk-bool", "false");
        i += 5;
        continue;
      }
      if (text.slice(i, i + 4) === "true") {
        push("tk-bool", "true");
        i += 4;
        continue;
      }
      if (text.slice(i, i + 4) === "null") {
        push("tk-null", "null");
        i += 4;
        continue;
      }
      if ("{}[],:".indexOf(ch) >= 0) {
        push("tk-punc", ch);
        i++;
        continue;
      }
      out += window.ToolKit.esc(ch);
      i++;
    }
    return out;
  }

  jsonRowsEl.addEventListener("click", function (ev) {
    var btn = ev.target.closest ? ev.target.closest(".j-toggle") : null;
    if (!btn || jsonState.mode !== "pretty" || !jsonState.data) return;
    var idx = parseInt(btn.getAttribute("data-row"), 10);
    if (jsonState.collapsed.has(idx)) jsonState.collapsed.delete(idx);
    else jsonState.collapsed.add(idx);
    renderJsonOutput();
  });

  function setJsonButtonState() {
    var pretty = jsonState.mode === "pretty";
    $("json-pretty").classList.toggle("active", pretty);
    $("json-compact").classList.toggle("active", !pretty);
  }

  $("json-pretty").addEventListener("click", function () {
    jsonState.mode = "pretty";
    setJsonButtonState();
    renderJsonOutput();
  });

  $("json-compact").addEventListener("click", function () {
    jsonState.mode = "compact";
    setJsonButtonState();
    renderJsonOutput();
  });

  $("json-expand").addEventListener("click", function () {
    if (!jsonState.data) return;
    jsonState.mode = "pretty";
    jsonState.collapsed.clear();
    setJsonButtonState();
    renderJsonOutput();
  });

  $("json-collapse").addEventListener("click", function () {
    if (!jsonState.data) return;
    jsonState.mode = "pretty";
    jsonState.rows.forEach(function (r) {
      if (r.container) jsonState.collapsed.add(r.index);
    });
    setJsonButtonState();
    renderJsonOutput();
  });

  $("json-copy").addEventListener("click", function () {
    if (!jsonState.data) return;
    var text =
      jsonState.mode === "compact"
        ? JSON.stringify(jsonState.data)
        : JSON.stringify(jsonState.data, null, 2);
    copyText(text, "已复制 JSON（完整内容）");
  });

  $("json-a-clear").addEventListener("click", function () {
    edJsonA.ta.value = "";
    refreshEditor(edJsonA);
    parseJsonInput();
    edJsonA.ta.focus();
  });

  $("json-decode").addEventListener("click", function () {
    var raw = edJsonA.ta.value;
    if (!raw.trim()) {
      toast("A 还没有内容");
      return;
    }
    var decoded = decodeEscapedText(raw);
    if (decoded === raw) {
      toast("未发现可解析的转义字符（如 \\n \\t \\\" \\\\ \\uXXXX）");
      return;
    }
    edJsonA.ta.value = decoded;
    refreshEditor(edJsonA);
    parseJsonInput();
    toast("已解析转义字符");
  });
})();
