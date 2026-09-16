(function () {
  "use strict";

  var $ = window.ToolKit.$;
  var esc = window.ToolKit.esc;
  var toast = window.ToolKit.toast;
  var copyText = window.ToolKit.copyText;
  var makeEditor = window.ToolKit.makeEditor;
  var Core = window.DiffCore;

  var state = {
    groups: null,
    approximate: false,
    expandAll: false,
    expanded: Object.create(null),
  };

  var edA = makeEditor("diff-a", {
    placeholder: "A：原始文本，每行一条…",
    softWrap: true,
    onInput: function () {
      updateHints();
    },
  });

  var edB = makeEditor("diff-b", {
    placeholder: "B：修改后的文本，每行一条…",
    softWrap: true,
    onInput: function () {
      updateHints();
    },
  });

  function countText(text) {
    if (!text) return "0 行";
    return Core.splitLines(text).length + " 行 · " + text.length + " 字符";
  }

  function updateHints() {
    $("diff-a-hint").textContent = countText(edA.ta.value);
    $("diff-b-hint").textContent = countText(edB.ta.value);
    if (state.groups) $("diff-result-hint").textContent = "内容已变化，点击“开始对比”刷新";
  }

  function resetResult() {
    state.groups = null;
    state.approximate = false;
    state.expanded = Object.create(null);
    $("diff-rows").innerHTML = "";
    $("diff-rows").classList.add("hidden");
    $("diff-empty").classList.remove("hidden");
    $("diff-empty").textContent = "点击“开始对比”，这里会逐行列出两份文本的差异。";
    $("diff-result-hint").textContent = "等待对比";
    $("diff-copy").disabled = true;
  }

  /* ---------- 把分组结果摊平成可渲染的行 ---------- */
  function buildRows(groups) {
    var rows = [];
    var sameRun = [];
    var sameStart = 0;
    var lineIndex = 0;
    var context = Core.CONTEXT;

    function pushSame(text) {
      rows.push({ type: "same", text: text });
    }

    function flushSame() {
      if (!sameRun.length) return;
      if (!state.expandAll && !state.expanded[sameStart] && sameRun.length > context * 2 + 1) {
        sameRun.slice(0, context).forEach(pushSame);
        rows.push({ type: "fold", key: sameStart, count: sameRun.length - context * 2 });
        sameRun.slice(-context).forEach(pushSame);
      } else {
        sameRun.forEach(pushSame);
      }
      sameRun = [];
    }

    groups.forEach(function (group) {
      if (group.type === "same") {
        if (!sameRun.length) sameStart = lineIndex;
        sameRun.push(group.text);
        lineIndex++;
        return;
      }
      flushSame();
      var deletes = group.deletes;
      var inserts = group.inserts;
      var pairs = Math.min(deletes.length, inserts.length);
      for (var pair = 0; pair < pairs; pair++) {
        var parts = Core.charParts(deletes[pair], inserts[pair]);
        rows.push({ type: "del", text: deletes[pair], parts: parts.old });
        rows.push({ type: "add", text: inserts[pair], parts: parts.next });
        lineIndex += 2;
      }
      for (var extra = pairs; extra < deletes.length; extra++) {
        rows.push({ type: "del", text: deletes[extra] });
        lineIndex++;
      }
      for (var insert = pairs; insert < inserts.length; insert++) {
        rows.push({ type: "add", text: inserts[insert] });
        lineIndex++;
      }
    });
    flushSame();
    return rows;
  }

  function partsHtml(parts, markClass) {
    var marked = parts[1] ? '<mark class="' + markClass + '">' + esc(parts[1]) + "</mark>" : "";
    return esc(parts[0]) + marked + esc(parts[2]);
  }

  function rowHtml(row) {
    if (row.type === "fold") {
      return (
        '<div class="diff-row fold" data-key="' + row.key + '">' +
        '<span class="diff-sign">⋯</span>' +
        '<span class="diff-text">未变化的 ' + row.count + " 行已折叠，点击展开</span>" +
        "</div>"
      );
    }
    var sign = row.type === "add" ? "+" : row.type === "del" ? "-" : " ";
    var text = row.parts ? partsHtml(row.parts, row.type === "add" ? "ins" : "del") : esc(row.text);
    return (
      '<div class="diff-row ' + row.type + '">' +
      '<span class="diff-sign">' + sign + "</span>" +
      '<span class="diff-text">' + text + "</span>" +
      "</div>"
    );
  }

  function statText(stat) {
    if (!stat.groups) return "两段文本完全一致，共 " + stat.unchanged + " 行。";
    return (
      "对比完成：新增 " + stat.added + " 行，删除 " + stat.removed + " 行，修改 " +
      stat.changed + " 行，未变化 " + stat.unchanged + " 行。"
    );
  }

  function render() {
    var stat = Core.summarize(state.groups);
    var rows = buildRows(state.groups);
    $("diff-rows").innerHTML = rows.map(rowHtml).join("") || '<div class="diff-empty">没有可显示的差异。</div>';
    $("diff-rows").classList.remove("hidden");
    $("diff-empty").classList.add("hidden");
    $("diff-result-hint").textContent = statText(stat) + (state.approximate ? "（文本较大，已改用逐行对照，仅供参考）" : "");
    $("diff-copy").disabled = false;
    $("diff-toggle").textContent = state.expandAll ? "只看差异" : "展开未变化";
  }

  function compare() {
    if (!edA.ta.value && !edB.ta.value) {
      resetResult();
      toast("请先在 A、B 里输入要对比的文本");
      edA.ta.focus();
      return;
    }
    var result = Core.lineOps(Core.splitLines(edA.ta.value), Core.splitLines(edB.ta.value));
    state.groups = Core.groupOps(result.ops);
    state.approximate = result.approximate;
    state.expandAll = false;
    state.expanded = Object.create(null);
    render();
    var stat = Core.summarize(state.groups);
    if (!stat.groups) toast("两段文本完全一致");
    else toast("对比完成，共 " + stat.groups + " 处差异");
  }

  $("diff-run").addEventListener("click", compare);

  $("diff-swap").addEventListener("click", function () {
    var left = edA.ta.value;
    edA.ta.value = edB.ta.value;
    edB.ta.value = left;
    window.ToolKit.refreshEditor(edA);
    window.ToolKit.refreshEditor(edB);
    updateHints();
    compare();
  });

  $("diff-clear").addEventListener("click", function () {
    edA.ta.value = "";
    edB.ta.value = "";
    window.ToolKit.refreshEditor(edA);
    window.ToolKit.refreshEditor(edB);
    updateHints();
    resetResult();
    edA.ta.focus();
  });

  $("diff-toggle").addEventListener("click", function () {
    if (!state.groups) {
      toast("先执行一次对比");
      return;
    }
    state.expandAll = !state.expandAll;
    render();
  });

  $("diff-rows").addEventListener("click", function (ev) {
    var fold = ev.target.closest ? ev.target.closest(".diff-row.fold") : null;
    if (!fold || state.expandAll) return;
    state.expanded[fold.getAttribute("data-key")] = true;
    render();
  });

  $("diff-copy").addEventListener("click", function () {
    if (!state.groups) return;
    var stat = Core.summarize(state.groups);
    var head = statText(stat) + "\n\n";
    copyText(head + Core.toUnifiedText(state.groups), "已复制对比结果（- 删除 / + 新增）");
  });

  edA.ta.addEventListener("keydown", onEditorKeydown);
  edB.ta.addEventListener("keydown", onEditorKeydown);

  function onEditorKeydown(ev) {
    if ((ev.ctrlKey || ev.metaKey) && ev.key === "Enter") {
      ev.preventDefault();
      compare();
    }
  }

  updateHints();
  resetResult();
})();
