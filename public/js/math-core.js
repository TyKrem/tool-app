/* 数学工具的核心逻辑（算式求值、进制转换、随机数、日期计算、UUID）。
   浏览器里挂到 window.MathCore，Node 里走 module.exports，便于单测。 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MathCore = factory();
  }
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';
  var DAY = 86400000;
  // 唯一随机的池子上限：超过就退回"抽到重复再抽"的拒绝采样
  var POOL_LIMIT = 1000000;

  /* ---------- 文本算式 ---------- */
  // 只认 + - * / % ^ 和括号、小数、科学计数法，不用 eval
  function ExpressionParser(source) {
    this.source = String(source).replace(/\s+/g, '');
    this.tokens = this.source.match(/\d*\.?\d+(?:e[+-]?\d+)?|[()+\-*/%^]/gi) || [];
    this.index = 0;
    if (this.tokens.join('') !== this.source) throw new Error('包含不支持的字符');
  }

  ExpressionParser.prototype.peek = function () {
    return this.tokens[this.index];
  };

  ExpressionParser.prototype.take = function () {
    return this.tokens[this.index++];
  };

  ExpressionParser.prototype.parse = function () {
    var value = this.additive();
    if (this.peek() !== undefined) throw new Error('算式格式不正确');
    return value;
  };

  ExpressionParser.prototype.additive = function () {
    var value = this.multiplicative();
    while (this.peek() === '+' || this.peek() === '-') {
      var op = this.take();
      var next = this.multiplicative();
      value = op === '+' ? value + next : value - next;
    }
    return value;
  };

  ExpressionParser.prototype.multiplicative = function () {
    var value = this.power();
    while (this.peek() === '*' || this.peek() === '/' || this.peek() === '%') {
      var op = this.take();
      var next = this.power();
      if ((op === '/' || op === '%') && next === 0) throw new Error('不能除以 0');
      value = op === '*' ? value * next : op === '/' ? value / next : value % next;
    }
    return value;
  };

  ExpressionParser.prototype.power = function () {
    var value = this.unary();
    if (this.peek() === '^') {
      this.take();
      value = Math.pow(value, this.power());
    }
    return value;
  };

  ExpressionParser.prototype.unary = function () {
    if (this.peek() === '+') {
      this.take();
      return this.unary();
    }
    if (this.peek() === '-') {
      this.take();
      return -this.unary();
    }
    return this.primary();
  };

  ExpressionParser.prototype.primary = function () {
    if (this.peek() === '(') {
      this.take();
      var value = this.additive();
      if (this.take() !== ')') throw new Error('括号未正确闭合');
      return value;
    }
    var token = this.take();
    if (token === undefined || Number.isNaN(Number(token))) throw new Error('缺少有效数字');
    return Number(token);
  };

  function evaluateExpression(source) {
    var text = String(source == null ? '' : source).trim();
    if (!text) throw new Error('请输入算式');
    var value = new ExpressionParser(text).parse();
    if (!Number.isFinite(value)) throw new Error('计算结果超出范围');
    return value;
  }

  /* ---------- 进制转换 ---------- */
  // 用 BigInt 中转，超过 2^53 的大整数也不会丢精度
  function convertBase(value, from, to) {
    var text = String(value == null ? '' : value).trim();
    var fromBase = Number(from);
    var toBase = Number(to);
    if (!Number.isInteger(fromBase) || !Number.isInteger(toBase)) throw new Error('进制必须是整数');
    if (fromBase < 2 || fromBase > 36 || toBase < 2 || toBase > 36) throw new Error('进制需要在 2 到 36 之间');
    if (!text) throw new Error('请输入要转换的数值');

    var negative = text.charAt(0) === '-';
    var digits = (negative ? text.slice(1) : text).toLowerCase().replace(/\s+/g, '');
    if (!digits) throw new Error('请输入要转换的数值');
    var allowed = DIGITS.slice(0, fromBase);
    for (var i = 0; i < digits.length; i++) {
      if (allowed.indexOf(digits.charAt(i)) < 0) {
        throw new Error('“' + digits.charAt(i) + '”不属于 ' + fromBase + ' 进制');
      }
    }
    var parsed = 0n;
    var base = BigInt(fromBase);
    for (var k = 0; k < digits.length; k++) {
      parsed = parsed * base + BigInt(allowed.indexOf(digits.charAt(k)));
    }
    var out = (negative ? -parsed : parsed).toString(toBase).toUpperCase();
    return out;
  }

  /* ---------- 随机 ---------- */
  function defaultRng() {
    return Math.random();
  }

  function randomInts(min, max, count, unique, rng) {
    var random = rng || defaultRng;
    var low = Number(min);
    var high = Number(max);
    var total = Number(count);
    if (!Number.isInteger(low) || !Number.isInteger(high) || !Number.isInteger(total)) {
      throw new Error('下限、上限、个数都必须是整数');
    }
    if (low > high) throw new Error('下限不能大于上限');
    if (total < 1 || total > 10000) throw new Error('生成个数需要在 1 到 10000 之间');
    var range = high - low + 1;
    if (unique && total > range) throw new Error('不重复生成时，个数不能超过可选范围（' + range + ' 个）');

    var values = [];
    if (unique && range <= POOL_LIMIT) {
      var pool = [];
      for (var i = 0; i < range; i++) pool.push(low + i);
      for (var k = 0; k < total; k++) {
        var swap = k + Math.floor(random() * (range - k));
        var keep = pool[k];
        pool[k] = pool[swap];
        pool[swap] = keep;
        values.push(pool[k]);
      }
      return values;
    }

    var used = Object.create(null);
    while (values.length < total) {
      var value = low + Math.floor(random() * range);
      if (unique) {
        if (used[value]) continue;
        used[value] = true;
      }
      values.push(value);
    }
    return values;
  }

  function shuffle(items, rng) {
    var random = rng || defaultRng;
    var values = (items || []).slice();
    for (var i = values.length - 1; i > 0; i--) {
      var j = Math.floor(random() * (i + 1));
      var keep = values[i];
      values[i] = values[j];
      values[j] = keep;
    }
    return values;
  }

  function sample(items, count, unique, rng) {
    var pool = items || [];
    var total = Number(count);
    if (!pool.length) throw new Error('请至少输入一项候选内容');
    if (!Number.isInteger(total) || total < 1 || total > 10000) throw new Error('抽取个数需要在 1 到 10000 之间');
    if (unique) {
      if (total > pool.length) throw new Error('不重复抽取时，个数不能超过候选项数量（' + pool.length + ' 项）');
      return shuffle(pool, rng).slice(0, total);
    }
    var random = rng || defaultRng;
    var values = [];
    for (var i = 0; i < total; i++) values.push(pool[Math.floor(random() * pool.length)]);
    return values;
  }

  /* ---------- UUID v4 ---------- */
  function makeUuid(random) {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    var randomValue = random || defaultRng;
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (char) {
      var value = Math.floor(randomValue() * 16);
      return (char === 'x' ? value : (value & 0x3) | 0x8).toString(16);
    });
  }

  /* ---------- 日期（按"年月日"语义算，不掺时区与夏令时） ---------- */
  function parseDateInput(text) {
    var match = String(text == null ? '' : text).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return NaN;
    var year = Number(match[1]);
    var month = Number(match[2]);
    var day = Number(match[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return NaN;
    var millis = Date.UTC(year, month - 1, day);
    var check = new Date(millis);
    // 2026-02-30 这类会被 Date 顺延到 3 月，回头比一次就知道是不是真日期
    if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return NaN;
    return millis;
  }

  function formatDate(millis) {
    var date = new Date(millis);
    return (
      date.getUTCFullYear() +
      '-' +
      String(date.getUTCMonth() + 1).padStart(2, '0') +
      '-' +
      String(date.getUTCDate()).padStart(2, '0')
    );
  }

  function addDays(millis, offset) {
    if (!Number.isFinite(millis)) throw new Error('请选择有效的基准日期');
    if (!Number.isInteger(Number(offset))) throw new Error('增减天数必须是整数');
    return millis + Number(offset) * DAY;
  }

  function diffDays(startMillis, endMillis) {
    if (!Number.isFinite(startMillis) || !Number.isFinite(endMillis)) throw new Error('请选择开始日期和结束日期');
    return Math.round((endMillis - startMillis) / DAY);
  }

  function weekdayOf(millis) {
    return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][new Date(millis).getUTCDay()];
  }

  return {
    evaluateExpression: evaluateExpression,
    convertBase: convertBase,
    randomInts: randomInts,
    shuffle: shuffle,
    sample: sample,
    makeUuid: makeUuid,
    parseDateInput: parseDateInput,
    formatDate: formatDate,
    addDays: addDays,
    diffDays: diffDays,
    weekdayOf: weekdayOf,
  };
});
