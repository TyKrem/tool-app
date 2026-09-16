/* 文本 Diff 对比的核心逻辑。浏览器里挂到 window.DiffCore，Node 里走 module.exports，
   和 text-core.js 一样，同一份代码既跑页面也能被 node:test 直接测。 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.DiffCore = factory();
  }
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  // 动态规划表的格子数上限。再大就明显卡手，改成逐行对照并按行数顺序提示用户。
  var LCS_LIMIT = 1000000;

  // 行级 diff 的上下文行数：改动前后各留这么多行，更长的相同段落折叠起来
  var CONTEXT = 3;

  function splitLines(value) {
    var text = String(value == null ? '' : value).replace(/\r\n?/g, '\n');
    var lines = text.split('\n');
    if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
    return lines;
  }

  function tableOps(left, right) {
    var rows = left.length;
    var cols = right.length;
    var table = [];
    var row;
    for (row = 0; row <= rows; row++) table.push(new Int32Array(cols + 1));
    for (row = rows - 1; row >= 0; row--) {
      for (var col = cols - 1; col >= 0; col--) {
        table[row][col] =
          left[row] === right[col]
            ? table[row + 1][col + 1] + 1
            : Math.max(table[row + 1][col], table[row][col + 1]);
      }
    }

    var ops = [];
    var i = 0;
    var j = 0;
    while (i < rows && j < cols) {
      if (left[i] === right[j]) {
        ops.push({ type: 'same', text: left[i] });
        i++;
        j++;
      } else if (table[i + 1][j] >= table[i][j + 1]) {
        ops.push({ type: 'del', text: left[i] });
        i++;
      } else {
        ops.push({ type: 'add', text: right[j] });
        j++;
      }
    }
    while (i < rows) ops.push({ type: 'del', text: left[i++] });
    while (j < cols) ops.push({ type: 'add', text: right[j++] });
    return ops;
  }

  // 文本太大时的退路：按下标逐行对照，不说"结果不正确"也不假装是完整 diff
  function pairwiseOps(left, right) {
    var ops = [];
    var total = Math.max(left.length, right.length);
    for (var i = 0; i < total; i++) {
      if (left[i] === right[i]) ops.push({ type: 'same', text: left[i] });
      else {
        if (i < left.length) ops.push({ type: 'del', text: left[i] });
        if (i < right.length) ops.push({ type: 'add', text: right[i] });
      }
    }
    return ops;
  }

  // 返回 { ops, approximate }：ops 里只有 same / del / add 三种
  function lineOps(leftLines, rightLines) {
    var left = leftLines || [];
    var right = rightLines || [];
    if (left.length * right.length > LCS_LIMIT) {
      return { ops: pairwiseOps(left, right), approximate: true };
    }
    return { ops: tableOps(left, right), approximate: false };
  }

  // 把连续的一串增删合并成一组"改动"，方便成对展示
  function groupOps(ops) {
    var groups = [];
    var index = 0;
    while (index < ops.length) {
      if (ops[index].type === 'same') {
        groups.push({ type: 'same', text: ops[index].text });
        index++;
        continue;
      }
      var deletes = [];
      var inserts = [];
      while (index < ops.length && ops[index].type !== 'same') {
        if (ops[index].type === 'del') deletes.push(ops[index].text);
        else inserts.push(ops[index].text);
        index++;
      }
      groups.push({ type: 'change', deletes: deletes, inserts: inserts });
    }
    return groups;
  }

  function summarize(groups) {
    var stat = { added: 0, removed: 0, changed: 0, unchanged: 0, groups: 0 };
    groups.forEach(function (group) {
      if (group.type === 'same') {
        stat.unchanged++;
        return;
      }
      stat.groups++;
      var pairs = Math.min(group.deletes.length, group.inserts.length);
      stat.changed += pairs;
      stat.removed += group.deletes.length - pairs;
      stat.added += group.inserts.length - pairs;
    });
    return stat;
  }

  // 逐字符找出改动：拆成「相同前缀 + 变化中间段 + 相同后缀」。
  // 用码点数组而不是 UTF-16 单元，避免把 emoji 的另一半当成改动。
  function charParts(oldText, newText) {
    var oldChars = Array.from(String(oldText == null ? '' : oldText));
    var nextChars = Array.from(String(newText == null ? '' : newText));
    var start = 0;
    var oldEnd = oldChars.length;
    var nextEnd = nextChars.length;
    while (start < oldEnd && start < nextEnd && oldChars[start] === nextChars[start]) start++;
    while (oldEnd > start && nextEnd > start && oldChars[oldEnd - 1] === nextChars[nextEnd - 1]) {
      oldEnd--;
      nextEnd--;
    }
    return {
      old: [oldChars.slice(0, start).join(''), oldChars.slice(start, oldEnd).join(''), oldChars.slice(oldEnd).join('')],
      next: [nextChars.slice(0, start).join(''), nextChars.slice(start, nextEnd).join(''), nextChars.slice(nextEnd).join('')],
    };
  }

  // 导出成统一 diff 文本（可粘贴给别人看），复制按钮直接用这个
  function toUnifiedText(groups) {
    var lines = [];
    groups.forEach(function (group) {
      if (group.type === 'same') {
        lines.push(' ' + group.text);
        return;
      }
      group.deletes.forEach(function (text) {
        lines.push('- ' + text);
      });
      group.inserts.forEach(function (text) {
        lines.push('+ ' + text);
      });
    });
    return lines.join('\n');
  }

  return {
    LCS_LIMIT: LCS_LIMIT,
    CONTEXT: CONTEXT,
    splitLines: splitLines,
    lineOps: lineOps,
    groupOps: groupOps,
    summarize: summarize,
    charParts: charParts,
    toUnifiedText: toUnifiedText,
  };
});
