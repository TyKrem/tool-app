/* 文本工具的核心逻辑。浏览器里挂到 window.TextCore，Node 里走 module.exports，
   这样同一份代码既能在页面上跑，也能被 node:test 直接测，不用引 jsdom。 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TextCore = factory();
  }
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  // 按行切分：末尾那个换行不算一行空行，但中间的空行要保留
  function splitLines(value) {
    var lines = String(value || '').split('\n');
    if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
    return lines;
  }

  // 下面三个都用 Object.create(null) 当查找表，不用 {}：
  // 普通对象的 __proto__ 是访问器，拿它当键会踩坑——
  // obj['__proto__'] = true 是在改原型（而且对非对象值是静默失败），
  // 于是「一行正好叫 __proto__」时去重不生效、计数变成垃圾、集合里查不到。
  // 粘 JS 代码来对比时会碰到，实测确认过。

  function uniqueInOrder(lines) {
    var seen = Object.create(null);
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
    var map = Object.create(null);
    lines.forEach(function (l) {
      map[l] = (map[l] || 0) + 1;
    });
    return map;
  }

  function setOf(lines) {
    var s = Object.create(null);
    lines.forEach(function (l) {
      s[l] = true;
    });
    return s;
  }

  return {
    splitLines: splitLines,
    uniqueInOrder: uniqueInOrder,
    countsBy: countsBy,
    setOf: setOf,
  };
});
