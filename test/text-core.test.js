'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const CORE = require('../public/js/text-core.js');

// 文本工具的按行处理。这几个函数同时用于「对比差异」「去重」「统计重复行」，
// 判错了用户看到的整片高亮就是错的。

test('splitLines：末尾换行不算一行，中间空行保留', function () {
  assert.deepStrictEqual(CORE.splitLines('a\nb\n'), ['a', 'b']);
  assert.deepStrictEqual(CORE.splitLines('a\nb'), ['a', 'b']);
  assert.deepStrictEqual(CORE.splitLines('a\n\nb\n'), ['a', '', 'b']);
  // 只有一个换行 = 一行空行（末尾那个换行被当作行尾符）
  assert.deepStrictEqual(CORE.splitLines('\n'), ['']);
  assert.deepStrictEqual(CORE.splitLines(''), ['']);
  assert.deepStrictEqual(CORE.splitLines(null), ['']);
  // CR 不做特殊处理，保持原样（工具面向的是纯文本粘贴）
  assert.deepStrictEqual(CORE.splitLines('a\r'), ['a\r']);
});

test('uniqueInOrder 保序去重', function () {
  assert.deepStrictEqual(CORE.uniqueInOrder(['b', 'a', 'b', 'c', 'a']), ['b', 'a', 'c']);
  assert.deepStrictEqual(CORE.uniqueInOrder([]), []);
  assert.deepStrictEqual(CORE.uniqueInOrder(['', '']), ['']);
  // 大小写与空白敏感
  assert.deepStrictEqual(CORE.uniqueInOrder(['A', 'a', ' A']), ['A', 'a', ' A']);
});

test('countsBy 统计每行出现次数', function () {
  const c = CORE.countsBy(['a', 'b', 'a', 'a']);
  assert.strictEqual(c['a'], 3);
  assert.strictEqual(c['b'], 1);
  assert.strictEqual(c['zzz'], undefined);
  assert.deepStrictEqual(Object.keys(c).sort(), ['a', 'b']);
});

test('setOf 产出可用于查找的集合', function () {
  const s = CORE.setOf(['a', 'b']);
  assert.strictEqual(s['a'], true);
  assert.strictEqual(s['b'], true);
  assert.ok(!s['c']);
});

// 下面这组是这次实测出来的 bug：三个函数原来用 {} 当查找表，
// 而普通对象的 __proto__ 是访问器，赋值等于在改原型。
// 结果是一行正好叫 __proto__ 时：去重不生效、计数变垃圾、集合里查不到。
// 粘 JS 代码来对比就会碰到。
test('键名是 __proto__ 时也要正确（原来会坏）', function () {
  const lines = ['a', '__proto__', 'b', '__proto__'];
  assert.deepStrictEqual(CORE.uniqueInOrder(lines), ['a', '__proto__', 'b']);
  const c = CORE.countsBy(lines);
  assert.strictEqual(c['__proto__'], 2);
  const s = CORE.setOf(['__proto__']);
  assert.strictEqual(s['__proto__'], true);
  assert.ok(!s['a']);
});

test('查找表不带原型，不会被别的键名带出来', function () {
  const s = CORE.setOf(['a']);
  // 普通 {} 上 s['constructor'] 会命中 Object.prototype.constructor，这里不该命中
  assert.ok(!s['constructor']);
  assert.ok(!s['toString']);
  assert.ok(!s['hasOwnProperty']);
  const c = CORE.countsBy(['a']);
  assert.ok(!c['constructor']);
});
