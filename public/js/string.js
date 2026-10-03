'use strict';
(function () {
  "use strict";

  var $ = window.ToolKit.$;
  var toast = window.ToolKit.toast;
  var copyText = window.ToolKit.copyText;
  var makeEditor = window.ToolKit.makeEditor;
  var refreshEditor = window.ToolKit.refreshEditor;
  var Core = window.StringCore;

  var TYPES = {
    escape: {
      label: "转义字符串",
      placeholder: "编码示例：第一行\\n第二行",
      placeholderReverse: "解码示例：hello\\nworld",
      tip: "按 JSON 转义规则处理 \\n \\t \\\" \\\\ \\uXXXX，中文保持可读。",
      tipReverse: "把 \\n \\t \\uXXXX 这类转义符还原成真实字符，认不出的转义原样保留。",
    },
    hex: {
      label: "Hex 字符串",
      placeholder: "编码示例：你好",
      placeholderReverse: "解码示例：E4 BD A0 E5 A5 BD",
      tip: "输出 UTF-8 字节的十六进制，每字节两位、空格分隔。",
      tipReverse: "解码时忽略空格与 0x 前缀，字节数必须是偶数且是合法 UTF-8。",
    },
    entity: {
      label: "HTML 实体",
      placeholder: '编码示例：<a href="#">链接</a>',
      placeholderReverse: "解码示例：&lt;a&gt;链接&lt;/a&gt;",
      tip: '只转义 & < > " \' 这五个特殊字符，勾选“全部转实体”可把每个字符都写成 &#xXXXX;。',
      tipReverse: "支持具名实体与 &#123; / &#x1F600; 这类数字实体。",
    },
    base64: {
      label: "Base64", placeholder: "输入中文、英文或 emoji…", placeholderReverse: "例如：5L2g5aW9",
      tip: "将 UTF-8 文本编码为 Base64，支持中文和 emoji。", tipReverse: "将 Base64 还原为 UTF-8 文本，忽略换行和空白。",
    },
    url: {
      label: "URL 编码",
      placeholder: "编码示例：关键词=网页 工具",
      placeholderReverse: "解码示例：%E7%BD%91%E9%A1%B5",
      tip: "按 encodeURIComponent 编码，适合拼查询参数值。",
      tipReverse: "按 decodeURIComponent 解码，% 后面必须是两位十六进制。",
    },
  };

  var state = { type: "escape", reverse: false };

  var edIn = makeEditor("string-input", {
    placeholder: TYPES.escape.placeholder,
    softWrap: true,
    onInput: function () {
      updateInputHint();
      convert(false);
    },
  });

  var edOut = makeEditor("string-output", {
    readOnly: true,
    softWrap: true,
    placeholder: "转换结果会显示在这里…",
  });

  function updateInputHint() {
    var value = edIn.ta.value;
    $("string-input-hint").textContent = value ? value.length + " 字符 · " + value.split("\n").length + " 行" : "0 字符";
  }

  function setStatus(text, isError) {
    var hint = $("string-output-hint");
    hint.textContent = text;
    hint.classList.toggle("error", !!isError);
  }

  function describe(result) {
    if (state.type === "hex" && !state.reverse) return result.split(" ").length + " 字节（UTF-8）";
    return result.length + " 字符";
  }

  function convert(showToast) {
    var value = edIn.ta.value;
    if (!value) {
      edOut.ta.value = "";
      refreshEditor(edOut);
      setStatus(state.reverse ? TYPES[state.type].tipReverse : TYPES[state.type].tip);
      $("string-copy").disabled = true;
      $("string-swap").disabled = true;
      return true;
    }
    try {
      var result = Core.convert(state.type, value, state.reverse, $("string-all-entity").checked);
      edOut.ta.value = result;
      refreshEditor(edOut);
      setStatus("转换完成 · " + describe(result));
      $("string-copy").disabled = !result;
      $("string-swap").disabled = !result;
      return true;
    } catch (err) {
      edOut.ta.value = "";
      refreshEditor(edOut);
      setStatus(err.message, true);
      $("string-copy").disabled = true;
      $("string-swap").disabled = true;
      if (showToast) toast("转换失败：" + err.message);
      return false;
    }
  }

  function applyTypeUI() {
    var config = TYPES[state.type];
    document.querySelectorAll("#string-type .seg-btn").forEach(function (button) {
      button.classList.toggle("active", button.getAttribute("data-type") === state.type);
    });
    $("string-all-entity-wrap").classList.toggle("hidden", state.type !== "entity" || state.reverse);
    edIn.ta.placeholder = state.reverse ? config.placeholderReverse : config.placeholder;
  }

  function switchType() {
    applyTypeUI();
    setStatus(state.reverse ? TYPES[state.type].tipReverse : TYPES[state.type].tip);
    convert(false);
  }

  document.querySelectorAll("#string-type .seg-btn").forEach(function (button) {
    button.addEventListener("click", function () {
      state.type = button.getAttribute("data-type");
      switchType();
    });
  });

  $("string-reverse").addEventListener("change", function () {
    state.reverse = $("string-reverse").checked;
    switchType();
  });

  $("string-all-entity").addEventListener("change", function () {
    convert(false);
  });

  $("string-run").addEventListener("click", function () {
    if (convert(true) && edIn.ta.value) toast("转换完成");
  });

  $("string-clear").addEventListener("click", function () {
    edIn.ta.value = "";
    edOut.ta.value = "";
    refreshEditor(edIn);
    refreshEditor(edOut);
    updateInputHint();
    setStatus("等待输入");
    $("string-copy").disabled = true;
      $("string-swap").disabled = true;
    edIn.ta.focus();
  });

  $("string-copy").addEventListener("click", function () {
    if (!edOut.ta.value) {
      toast("还没有可复制的输出");
      return;
    }
    copyText(edOut.ta.value, "已复制输出内容");
  });

  $("string-swap").addEventListener("click", function () {
    if (!edOut.ta.value) return;
    edIn.ta.value = edOut.ta.value;
    state.reverse = !state.reverse;
    $("string-reverse").checked = state.reverse;
    refreshEditor(edIn); updateInputHint(); switchType();
  });
  window.ToolKit.bindRun([edIn], function () { convert(true); });
  window.ToolKit.addDownload("string-copy", function () { return edOut.ta.value; }, "转换结果.txt");
  updateInputHint();
  switchType();
})();
