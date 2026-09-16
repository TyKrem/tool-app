'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const CORE = require('../public/js/diff-core.js');

// Diff 工具的核心：行级对齐 + 行内字符级改动。判错了整片高亮都是错的。

test('splitLines：统一换行符，末尾换行不算一行', function () {
  assert.deepStrictEqual(CORE.splitLines('a\r\nb\r\n'), ['a', 'b']);
  assert.deepStrictEqual(CORE.splitLines('a\rb'), ['a', 'b']);
  assert.deepStrictEqual(CORE.splitLines('a\n\nb'), ['a', '', 'b']);
  assert.deepStrictEqual(CORE.splitLines(''), ['']);
});

test('lineOps：完全相同的文本全是 same', function () {
  const result = CORE.lineOps(['a', 'b'], ['a', 'b']);
  assert.strictEqual(result.approximate, false);
  assert.deepStrictEqual(
    result.ops.map(function (op) { return op.type; }),
    ['same', 'same']
  );
});

test('lineOps：删一行、加一行、改一行', function () {
  const result = CORE.lineOps(['a', 'b', 'c'], ['a', 'c', 'd']);
  const groups = CORE.groupOps(result.ops);
  const stat = CORE.summarize(groups);
  // b 被删掉、d 是新增，其余不变
  assert.strictEqual(stat.removed, 1);
  assert.strictEqual(stat.added, 1);
  assert.strictEqual(stat.changed, 0);
  assert.strictEqual(stat.unchanged, 2);
});

test('groupOps：连续的增删合成一组，成对算“修改”', function () {
  const result = CORE.lineOps(['x1', 'x2'], ['y1', 'y2']);
  const groups = CORE.groupOps(result.ops);
  assert.strictEqual(groups.length, 1);
  assert.strictEqual(groups[0].type, 'change');
  const stat = CORE.summarize(groups);
  assert.strictEqual(stat.changed, 2);
  assert.strictEqual(stat.added, 0);
  assert.strictEqual(stat.removed, 0);
});

test('charParts：拆出相同前缀 / 变化段 / 相同后缀', function () {
  const parts = CORE.charParts('abcde', 'abXde');
  assert.deepStrictEqual(parts.old, ['ab', 'c', 'de']);
  assert.deepStrictEqual(parts.next, ['ab', 'X', 'de']);
});

test('charParts：emoji 不会被从代理对中间切开', function () {
  const parts = CORE.charParts('Hi 😀', 'Hi 😀!');
  // 如果按 UTF-16 单元切，😀 会被拆成两半，另一半被当成改动
  assert.deepStrictEqual(parts.next, ['Hi 😀', '!', '']);
  assert.deepStrictEqual(parts.old, ['Hi 😀', '', '']);
});

test('charParts：中文逐字比较', function () {
  const parts = CORE.charParts('今天天气不错呢', '今天天气很好呢');
  assert.deepStrictEqual(parts.old, ['今天天气', '不错', '呢']);
  assert.deepStrictEqual(parts.next, ['今天天气', '很好', '呢']);
});

test('charParts：整行替换时变化段就是整行', function () {
  const parts = CORE.charParts('旧内容', '新内容');
  // 相同后缀「内容」会被摘出去，只标出真正变了的那一个字
  assert.deepStrictEqual(parts.old, ['', '旧', '内容']);
  assert.deepStrictEqual(parts.next, ['', '新', '内容']);
});

test('charParts：完全不同的行整行都算改动', function () {
  const parts = CORE.charParts('abc', 'xyz');
  assert.deepStrictEqual(parts.old, ['', 'abc', '']);
  assert.deepStrictEqual(parts.next, ['', 'xyz', '']);
});

test('toUnifiedText：输出带前缀的统一 diff 文本', function () {
  const result = CORE.lineOps(['a', 'b'], ['a', 'c']);
  const text = CORE.toUnifiedText(CORE.groupOps(result.ops));
  assert.strictEqual(text, ' a\n- b\n+ c');
});

test('文本过大时改用逐行对照并标记 approximate', function () {
  const big = [];
  for (let i = 0; i < 1200; i++) big.push('line-' + i);
  const result = CORE.lineOps(big, big.slice());
  assert.strictEqual(result.approximate, true);
  assert.strictEqual(CORE.summarize(CORE.groupOps(result.ops)).unchanged, 1200);
});

test('空输入不会抛错', function () {
  const result = CORE.lineOps([], []);
  assert.deepStrictEqual(result.ops, []);
  assert.deepStrictEqual(CORE.summarize([]), { added: 0, removed: 0, changed: 0, unchanged: 0, groups: 0 });
});
