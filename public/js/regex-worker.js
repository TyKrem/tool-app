'use strict';

// 将可能发生灾难性回溯的表达式隔离；页面可以终止线程，保持交互可用。
self.onmessage = function (event) {
  try {
    var request = event.data;
    var expression = new RegExp(request.pattern, request.flags + 'g');
    var matches = [];
    var match;
    while ((match = expression.exec(request.text)) !== null) {
      matches.push({ text: match[0], index: match.index, groups: match.slice(1) });
      if (matches.length >= request.limit) break;
      if (match[0] === '') {
        var code = request.text.codePointAt(expression.lastIndex);
        expression.lastIndex += expression.unicode && code > 0xffff ? 2 : 1;
      }
      if (expression.lastIndex > request.text.length) break;
    }
    self.postMessage({ matches: matches });
  } catch (error) { self.postMessage({ error: error.message }); }
};
