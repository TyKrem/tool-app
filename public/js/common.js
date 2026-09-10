(function () {
  "use strict";

  function $(id) {
    return document.getElementById(id);
  }

  function toast(msg, ms) {
    var el = $("toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(el._t);
    el._t = setTimeout(function () {
      el.classList.add("hidden");
    }, ms || 2400);
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function copyText(text, okText) {
    function done() {
      toast(okText || "已复制");
    }
    if (!text) {
      toast("没有可复制的内容");
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () {
        fallbackCopy(text);
        done();
      });
    } else {
      fallbackCopy(text);
      done();
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;opacity:0;top:0;left:0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
    } catch (e) {}
    document.body.removeChild(ta);
  }

  /* ---------- 通用代码编辑器（textarea + 行号 + 行高亮层） ---------- */
  function makeEditor(rootId, opts) {
    var root = $(rootId);
    opts = opts || {};
    if (!root) return null;
    root.classList.add("code-editor");
    root.innerHTML =
      '<div class="ce-gutter"><div class="ce-gutter-inner"></div></div>' +
      '<div class="ce-scroll">' +
      '<div class="ce-marks"></div>' +
      '<textarea class="ce-input" spellcheck="false" wrap="off"></textarea>' +
      "</div>";

    var ed = {
      root: root,
      gutter: root.querySelector(".ce-gutter"),
      inner: root.querySelector(".ce-gutter-inner"),
      scroll: root.querySelector(".ce-scroll"),
      marks: root.querySelector(".ce-marks"),
      ta: root.querySelector(".ce-input"),
      markFn: opts.markFn || null,
      readOnly: !!opts.readOnly,
      softWrap: !!opts.softWrap,
    };

    if (ed.readOnly) {
      ed.ta.readOnly = true;
      ed.ta.tabIndex = -1;
    }
    if (opts.placeholder) ed.ta.placeholder = opts.placeholder;
    if (opts.spellcheck) ed.ta.spellcheck = true;
    if (ed.softWrap) {
      ed.ta.wrap = "soft";
      ed.ta.classList.add("soft");
    } else {
      ed.ta.wrap = "off";
    }

    ed.ta.addEventListener("input", function () {
      refreshEditor(ed);
      if (opts.onInput) opts.onInput(ed);
    });

    ed.scroll.addEventListener("scroll", function () {
      ed.inner.style.transform = "translateY(" + -ed.scroll.scrollTop + "px)";
    });

    // 点击编辑器空白区域 / 行号栏时，也聚焦到文本框
    root.addEventListener("click", function (ev) {
      var inTextarea = ev.target && ev.target.closest && ev.target.closest("textarea");
      if (inTextarea || ev.target !== root && !root.contains(ev.target)) return;
      if (ev.target.closest && ev.target.closest("textarea")) return;
      ed.ta.focus();
      try {
        ed.ta.setSelectionRange(ed.ta.value.length, ed.ta.value.length);
      } catch (e) {}
    });

    window.addEventListener("resize", function () {
      refreshEditor(ed);
    });

    refreshEditor(ed);
    return ed;
  }

  function editorMetrics(ed) {
    var cs = getComputedStyle(ed.ta);
    return {
      padTop: parseFloat(cs.paddingTop) || 0,
      padRight: parseFloat(cs.paddingRight) || 0,
      padBottom: parseFloat(cs.paddingBottom) || 0,
      padLeft: parseFloat(cs.paddingLeft) || 0,
      lineH: parseFloat(cs.lineHeight) || 22,
      font: cs.font || "13px monospace",
    };
  }

  var measureCtx = null;
  function measureTextWidth(text, font) {
    var t = String(text).replace(/\t/g, "    ");
    if (!measureCtx) {
      try {
        measureCtx = document.createElement("canvas").getContext("2d");
      } catch (e) {}
    }
    if (!measureCtx) return Math.ceil(t.length * 7.8) || 0;
    measureCtx.font = font;
    return Math.ceil(measureCtx.measureText(t).width) || 0;
  }

  function refreshEditor(ed) {
    if (!ed || !ed.ta) return;
    var m = editorMetrics(ed);
    var value = ed.ta.value;
    var lines = value.split("\n");
    var visibleW = Math.max(10, ed.scroll.clientWidth - m.padLeft - m.padRight);
    var maxW = visibleW;
    if (!ed.softWrap) {
      lines.forEach(function (line) {
        maxW = Math.max(maxW, measureTextWidth(line, m.font) + 4);
      });
    }
    var contentW = maxW;
    var totalW = contentW + m.padLeft + m.padRight;
    var fillH = ed.scroll.clientHeight || 0;
    var numberCount = lines.length;
    var totalH;
    if (ed.softWrap) {
      // 自动换行：宽度固定为可视宽度，高度按 textarea 实际换行后的内容计算
      ed.ta.style.width = (visibleW + m.padLeft + m.padRight) + "px";
      ed.ta.style.height = "1px";
      var measured = ed.ta.scrollHeight || 0;
      var contentH = Math.max(measured - m.padTop - m.padBottom, m.lineH);
      totalH = Math.max(contentH + m.padTop + m.padBottom, fillH);
      numberCount = Math.max(lines.length, Math.round(contentH / m.lineH));
    } else {
      totalH = Math.max(lines.length * m.lineH + m.padTop + m.padBottom, fillH);
    }

    ed.ta.style.width = totalW + "px";
    ed.ta.style.height = totalH + "px";

    ed.inner.style.paddingTop = m.padTop + "px";
    ed.inner.style.paddingBottom = m.padBottom + "px";
    ed.inner.innerHTML = "";
    for (var i = 0; i < numberCount; i++) {
      var d = document.createElement("div");
      d.className = "ce-line-no";
      d.textContent = i + 1;
      ed.inner.appendChild(d);
    }

    ed.marks.style.width = contentW + "px";
    ed.marks.style.height = numberCount * m.lineH + "px";
    ed.marks.innerHTML = "";
    if (ed.markFn) {
      var cls = ed.markFn(lines);
      if (cls && cls.length) {
        for (var k = 0; k < cls.length; k++) {
          if (!cls[k]) continue;
          var mark = document.createElement("div");
          mark.className = "ce-mark " + cls[k];
          mark.style.top = k * m.lineH + "px";
          ed.marks.appendChild(mark);
        }
      }
    }
    ed.inner.style.transform = "translateY(" + -ed.scroll.scrollTop + "px)";
  }

  window.ToolKit = {
    $: $,
    esc: esc,
    toast: toast,
    copyText: copyText,
    makeEditor: makeEditor,
    refreshEditor: refreshEditor,
  };
})();
