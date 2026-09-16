'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const CORE = require('../public/js/timestamp-core.js');

// 时间戳工具的核心逻辑。格式化统一带 timeZone 参数断言，避免依赖跑测试机器的时区。

test('formatTime：按指定时区格式化（含毫秒）', function () {
  const millis = Date.UTC(2026, 8, 16, 0, 0, 0, 123);
  assert.strictEqual(CORE.formatTime(millis, { timeZone: 'Asia/Shanghai' }), '2026-09-16 08:00:00');
  assert.strictEqual(CORE.formatTime(millis, { timeZone: 'Asia/Shanghai', withMillis: true }), '2026-09-16 08:00:00.123');
  assert.strictEqual(CORE.formatTime(millis, { timeZone: 'UTC' }), '2026-09-16 00:00:00');
});

test('formatTime：凌晨用 0 点而不是 24 点', function () {
  const millis = Date.UTC(2026, 0, 1, 16, 0, 0); // 上海时间次日 0 点
  assert.strictEqual(CORE.formatTime(millis, { timeZone: 'Asia/Shanghai' }), '2026-01-02 00:00:00');
});

test('parseLocalInput：本地时间字符串 ↔ 毫秒', function () {
  const millis = CORE.parseLocalInput('2026-09-16T15:32:11');
  assert.strictEqual(millis, new Date(2026, 8, 16, 15, 32, 11).getTime());
  // 不带秒、用空格分隔也要认
  assert.strictEqual(CORE.parseLocalInput('2026-09-16 15:32'), new Date(2026, 8, 16, 15, 32, 0).getTime());
  // 回到 datetime-local 的格式
  assert.strictEqual(CORE.toLocalInput(millis), '2026-09-16T15:32:11');
});

test('parseLocalInput：非法时间返回 NaN', function () {
  assert.ok(Number.isNaN(CORE.parseLocalInput('2026-02-30T10:00')));
  assert.ok(Number.isNaN(CORE.parseLocalInput('2026-09-16T25:00')));
  assert.ok(Number.isNaN(CORE.parseLocalInput('')));
  assert.ok(Number.isNaN(CORE.parseLocalInput('2026/09/16 10:00')));
});

test('parseStamp：按位数自动判断秒 / 毫秒', function () {
  const seconds = CORE.parseStamp('1758000000');
  assert.strictEqual(seconds.unit, 'seconds');
  assert.strictEqual(seconds.millis, 1758000000000);
  const millis = CORE.parseStamp('1758000000123');
  assert.strictEqual(millis.unit, 'milliseconds');
  assert.strictEqual(millis.millis, 1758000000123);
});

test('parseStamp：手动单位与位数冲突时以位数为准', function () {
  // 选了"秒"却粘了 13 位毫秒值，不能悄悄按秒算出一个 5 万年后的时间
  const result = CORE.parseStamp('1758000000123', 'seconds');
  assert.strictEqual(result.unit, 'milliseconds');
  const other = CORE.parseStamp('1758000000', 'milliseconds');
  assert.strictEqual(other.unit, 'seconds');
});

test('parseStamp：空值与非法值报错', function () {
  assert.throws(function () { CORE.parseStamp(''); }, /时间戳只能是整数/);
  assert.throws(function () { CORE.parseStamp('12.5'); }, /时间戳只能是整数/);
  assert.throws(function () { CORE.parseStamp('abc'); }, /时间戳只能是整数/);
  assert.throws(function () { CORE.parseStamp('99999999999999999999'); }, /超出可转换范围/);
});

test('parseStamp：负数表示 1970 年之前', function () {
  const result = CORE.parseStamp('-86400');
  assert.strictEqual(result.unit, 'seconds');
  assert.strictEqual(CORE.formatTime(result.millis, { timeZone: 'UTC' }), '1969-12-31 00:00:00');
});

test('relativeText：常见跨度的人话描述', function () {
  const now = Date.UTC(2026, 8, 16, 8, 0, 0);
  assert.strictEqual(CORE.relativeText(now, now), '就是现在');
  assert.strictEqual(CORE.relativeText(now - 30000, now), '30 秒前');
  assert.strictEqual(CORE.relativeText(now - 5 * 60000, now), '5 分钟前');
  assert.strictEqual(CORE.relativeText(now + 2 * 3600000, now), '2 小时后');
  assert.strictEqual(CORE.relativeText(now - 3 * 86400000, now), '3 天前');
  assert.strictEqual(CORE.relativeText(now + 60 * 86400000, now), '2 个月后');
  assert.strictEqual(CORE.relativeText(now - 400 * 86400000, now), '1.1 年前');
});

test('formatOffset：时区偏移展示成 UTC±HH:MM', function () {
  assert.strictEqual(CORE.formatOffset(480), 'UTC+08:00');
  assert.strictEqual(CORE.formatOffset(-300), 'UTC-05:00');
  assert.strictEqual(CORE.formatOffset(0), 'UTC+00:00');
});
