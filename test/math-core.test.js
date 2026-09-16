'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const CORE = require('../public/js/math-core.js');

// 数学工具的核心逻辑：算式解析、进制换算、随机与日期。

test('evaluateExpression：优先级与结合性', function () {
  assert.strictEqual(CORE.evaluateExpression('1 + 2 * 3'), 7);
  assert.strictEqual(CORE.evaluateExpression('(1 + 2) * 3'), 9);
  assert.strictEqual(CORE.evaluateExpression('10 - 2 - 3'), 5);
  assert.strictEqual(CORE.evaluateExpression('2 ^ 3 ^ 2'), 512); // 右结合
  assert.strictEqual(CORE.evaluateExpression('-3 + 5'), 2);
  assert.strictEqual(CORE.evaluateExpression('7 % 3'), 1);
  assert.strictEqual(CORE.evaluateExpression('1.5 * 2'), 3);
  assert.strictEqual(CORE.evaluateExpression('1e3 + 1'), 1001);
  assert.strictEqual(CORE.evaluateExpression('  2*(3+4) '), 14);
});

test('evaluateExpression：错误信息说清楚问题', function () {
  assert.throws(function () { CORE.evaluateExpression('1 + a'); }, /不支持的字符/);
  assert.throws(function () { CORE.evaluateExpression('1 / 0'); }, /不能除以 0/);
  assert.throws(function () { CORE.evaluateExpression('(1 + 2'); }, /括号未正确闭合/);
  assert.throws(function () { CORE.evaluateExpression(''); }, /请输入算式/);
  assert.throws(function () { CORE.evaluateExpression('1 +'); }, /缺少有效数字/);
});

test('convertBase：常见进制互转', function () {
  assert.strictEqual(CORE.convertBase('FF', 16, 10), '255');
  assert.strictEqual(CORE.convertBase('255', 10, 16), 'FF');
  assert.strictEqual(CORE.convertBase('11111111', 2, 16), 'FF');
  assert.strictEqual(CORE.convertBase('-101', 2, 10), '-5');
  assert.strictEqual(CORE.convertBase(' z ', 36, 10), '35');
});

test('convertBase：大整数不丢精度（走 BigInt）', function () {
  assert.strictEqual(CORE.convertBase('FFFFFFFFFFFFFFFFFF', 16, 10), '4722366482869645213695');
  assert.strictEqual(CORE.convertBase('4722366482869645213695', 10, 16), 'FFFFFFFFFFFFFFFFFF');
});

test('convertBase：非法输入报错而不是静默给错值', function () {
  assert.throws(function () { CORE.convertBase('12', 2, 10); }, /不属于 2 进制/);
  assert.throws(function () { CORE.convertBase('1', 1, 10); }, /2 到 36/);
  assert.throws(function () { CORE.convertBase('', 10, 2); }, /请输入要转换的数值/);
});

test('randomInts：范围、个数与唯一性', function () {
  let seed = 123456789;
  function rng() {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  }
  const values = CORE.randomInts(1, 10, 10, true, rng);
  assert.strictEqual(values.length, 10);
  assert.deepStrictEqual(values.slice().sort(function (a, b) { return a - b; }), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  // 不重复时个数超过可选范围要报错，而不是死循环
  assert.throws(function () { CORE.randomInts(1, 5, 6, true, rng); }, /不能超过可选范围/);
  assert.throws(function () { CORE.randomInts(10, 1, 3, false, rng); }, /下限不能大于上限/);
  const repeated = CORE.randomInts(3, 3, 4, false, rng);
  assert.deepStrictEqual(repeated, [3, 3, 3, 3]);
});

test('shuffle：固定随机源下结果可复现，且不丢项', function () {
  const items = ['a', 'b', 'c', 'd'];
  const shuffled = CORE.shuffle(items, function () { return 0; });
  assert.deepStrictEqual(items, ['a', 'b', 'c', 'd']); // 不改动入参
  assert.deepStrictEqual(shuffled.slice().sort(), ['a', 'b', 'c', 'd']);
});

test('sample：抽取数量与不重复校验', function () {
  const items = ['a', 'b', 'c'];
  const picked = CORE.sample(items, 2, true, function () { return 0.5; });
  assert.strictEqual(picked.length, 2);
  assert.strictEqual(new Set(picked).size, 2);
  assert.throws(function () { CORE.sample(items, 4, true); }, /不能超过候选项数量/);
  assert.throws(function () { CORE.sample([], 1, false); }, /请至少输入一项候选内容/);
});

test('makeUuid：形态是标准 v4', function () {
  let seed = 42;
  function rng() {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  }
  const uuid = CORE.makeUuid(rng);
  assert.match(uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test('日期：解析、加减、相差天数与星期', function () {
  const start = CORE.parseDateInput('2026-01-01');
  assert.ok(Number.isFinite(start));
  assert.strictEqual(CORE.formatDate(CORE.addDays(start, 30)), '2026-01-31');
  assert.strictEqual(CORE.formatDate(CORE.addDays(start, -1)), '2025-12-31');
  assert.strictEqual(CORE.diffDays(start, CORE.parseDateInput('2026-03-01')), 59);
  assert.strictEqual(CORE.diffDays(CORE.parseDateInput('2026-03-01'), start), -59);
  assert.strictEqual(CORE.formatDate(CORE.addDays(start, 1)), '2026-01-02');
  assert.strictEqual(CORE.weekdayOf(start), '周四');
  // 闰年：2028 是闰年，2 月有 29 天
  assert.strictEqual(CORE.formatDate(CORE.addDays(CORE.parseDateInput('2028-02-28'), 1)), '2028-02-29');
});

test('日期：非法日期返回 NaN 并让调用方报错', function () {
  assert.ok(Number.isNaN(CORE.parseDateInput('2026-02-30')));
  assert.ok(Number.isNaN(CORE.parseDateInput('2026-13-01')));
  assert.ok(Number.isNaN(CORE.parseDateInput('')));
  assert.throws(function () { CORE.addDays(CORE.parseDateInput('bad'), 1); }, /请选择有效的基准日期/);
  assert.throws(function () { CORE.addDays(CORE.parseDateInput('2026-01-01'), 1.5); }, /必须是整数/);
  assert.throws(function () { CORE.diffDays(NaN, 1); }, /请选择开始日期和结束日期/);
});
