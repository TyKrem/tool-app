(function () {
  "use strict";

  var $ = window.ToolKit.$;
  var makeEditor = window.ToolKit.makeEditor;
  var refreshEditor = window.ToolKit.refreshEditor;
  var toast = window.ToolKit.toast;
  var copyText = window.ToolKit.copyText;
  var esc = window.ToolKit.esc;

  var edText = makeEditor("regex-text", {
    placeholder: "在这里输入需要匹配的文本…",
    softWrap: true,
    onInput: function () {
      $("regex-text-hint").textContent = (edText.ta.value || "").split("\n").length + " 行 · " + edText.ta.value.length + " 字符";
      if (!$("regex-list").classList.contains("hidden")) {
        $("regex-result-hint").textContent = "文本已变化，请重新匹配";
      }
      if (!$("regex-preview").querySelector(".regex-empty")) {
        $("regex-preview-hint").textContent = "文本已变化，请重新匹配";
      }
    },
  });

  // 匹配数量与预览高亮的条数上限：正则写歪时（例如 .* 之类）不至于把页面卡死
  var MATCH_LIMIT = 5000;
  var PREVIEW_LIMIT = 2000;

  function renderPreview(text, matches) {
    var preview = $("regex-preview");
    if (!text) {
      preview.innerHTML = '<span class="regex-empty">先在 A 里输入要匹配的文本</span>';
      $("regex-preview-hint").textContent = "没有文本";
      return;
    }
    if (!matches.length) {
      preview.innerHTML = '<span class="regex-empty">没有匹配到内容</span>';
      $("regex-preview-hint").textContent = "未命中";
      return;
    }
    var shown = Math.min(matches.length, PREVIEW_LIMIT);
    var html = "";
    var cursor = 0;
    for (var i = 0; i < shown; i++) {
      var match = matches[i];
      if (match.index < cursor) continue;
      html += esc(text.slice(cursor, match.index));
      // 空匹配用零宽空格占位，否则 mark 什么都看不见
      html += "<mark>" + (match.text ? esc(match.text) : "&#8203;") + "</mark>";
      cursor = match.index + match.text.length;
    }
    html += esc(text.slice(cursor));
    preview.innerHTML = html;
    $("regex-preview-hint").textContent =
      shown < matches.length ? "已高亮前 " + shown + " 处，共 " + matches.length + " 处" : "共高亮 " + shown + " 处";
  }

  function currentFlags() {
    return Array.prototype.map.call(document.querySelectorAll(".regex-flags input:checked"), function (c) {
      return c.value;
    }).join("");
  }

  function lineCol(text, index) {
    var before = text.slice(0, index);
    var line = (before.match(/\n/g) || []).length + 1;
    var lastNl = before.lastIndexOf("\n");
    var col = lastNl < 0 ? index + 1 : index - lastNl;
    return { line: line, col: col };
  }

  function runMatch() {
    var patternText = $("regex-pattern").value.trim();
    var flags = currentFlags();
    var text = edText.ta.value || "";
    $("regex-error").classList.add("hidden");
    $("regex-list").classList.add("hidden");
    $("regex-list").innerHTML = "";
    $("regex-copy").disabled = true;

    if (!patternText) {
      $("regex-empty").classList.remove("hidden");
      $("regex-empty").textContent = "请先输入正则表达式";
      $("regex-result-hint").textContent = "缺少表达式";
      renderPreview(text, []);
      return;
    }
    var re;
    try {
      re = new RegExp(patternText, flags.indexOf("g") >= 0 ? flags : flags + "g");
    } catch (err) {
      $("regex-empty").classList.add("hidden");
      $("regex-error").classList.remove("hidden");
      $("regex-error").textContent = "正则表达式错误：" + err.message;
      $("regex-result-hint").textContent = "表达式无效";
      renderPreview(text, []);
      return;
    }

    var listEl = $("regex-list");
    var emptyEl = $("regex-empty");
    var matches = [];
    var m;
    while ((m = re.exec(text)) !== null) {
      matches.push({
        text: m[0],
        index: m.index,
        groups: m.slice(1).filter(function (x) { return x !== undefined; }),
      });
      if (m[0] === "") re.lastIndex++;
      if (re.lastIndex > text.length) break;
      if (matches.length >= MATCH_LIMIT) break;
    }

    emptyEl.classList.add("hidden");
    renderPreview(text, matches);
    if (!matches.length) {
      $("regex-result-hint").textContent = "未找到匹配";
      listEl.innerHTML = '<div class="regex-empty">未找到匹配结果</div>';
      return;
    }

    listEl.classList.remove("hidden");
    listEl.innerHTML = "";
    matches.forEach(function (mt, i) {
      var pos = lineCol(text, mt.index);
      var row = document.createElement("div");
      row.className = "regex-match";
      var groupsHtml = "";
      if (mt.groups.length) {
        groupsHtml = '<div class="regex-groups">' +
          mt.groups.map(function (g, gi) {
            return "<span>组" + (gi + 1) + ": " + esc(g == null ? "" : g) + "</span>";
          }).join("") +
          "</div>";
      }
      row.innerHTML =
        '<div class="regex-match-head"><span class="regex-index">#' + (i + 1) +
        '</span><span class="regex-pos">第 ' + pos.line + ' 行 第 ' + pos.col + ' 列</span></div>' +
        '<pre class="regex-match-text">' + esc(mt.text) + "</pre>" +
        groupsHtml;
      listEl.appendChild(row);
    });
    $("regex-result-hint").textContent =
      matches.length >= MATCH_LIMIT
        ? "匹配较多，只列出前 " + MATCH_LIMIT + " 处"
        : "共 " + matches.length + " 处匹配";
    $("regex-copy").disabled = false;
    toast("匹配完成，共 " + matches.length + " 处");
  }

  $("regex-execute").addEventListener("click", runMatch);
  $("regex-pattern").addEventListener("keydown", function (ev) {
    if (ev.key === "Enter") {
      ev.preventDefault();
      runMatch();
    }
  });
  $("regex-copy").addEventListener("click", function () {
    var rows = document.querySelectorAll("#regex-list .regex-match-text");
    var text = Array.prototype.map.call(rows, function (r) { return r.textContent; }).join("\n");
    copyText(text, "已复制全部匹配内容");
  });
  function clearAll() {
    $("regex-pattern").value = "";
    document.querySelectorAll(".regex-flags input").forEach(function (c) { c.checked = false; });
    edText.ta.value = "";
    refreshEditor(edText);
    $("regex-text-hint").textContent = "输入要匹配的文本";
    $("regex-result-hint").textContent = "等待执行";
    $("regex-list").classList.add("hidden");
    $("regex-list").innerHTML = "";
    $("regex-error").classList.add("hidden");
    $("regex-empty").classList.remove("hidden");
    $("regex-empty").textContent = "点击“匹配”查看全部结果";
    $("regex-copy").disabled = true;
    $("regex-preview").innerHTML = '<span class="regex-empty">匹配后这里会按原文高亮显示命中的内容</span>';
    $("regex-preview-hint").textContent = "匹配处会用底色标出";
    $("regex-pattern").focus();
  }
  $("regex-clear").addEventListener("click", clearAll);
  $("regex-text-clear").addEventListener("click", function () {
    edText.ta.value = "";
    refreshEditor(edText);
    $("regex-text-hint").textContent = "输入要匹配的文本";
    renderPreview("", []);
  });
})();
