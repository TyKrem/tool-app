'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const CORE = require('../public/js/string-core.js');

// 字符串工具的核心逻辑：转义 / Hex / 实体 / URL 四种转换的双向正确性。

test('转义字符串：编码后再解码回到原文', function () {
  const samples = ['第一行\n第二行', '带"引号"和\'单引号\'', 'C:\\path\\to\\file', '制表\t符', '尾反斜杠\\'];
  samples.forEach(function (text) {
    assert.strictEqual(CORE.escapeDecode(CORE.escapeEncode(text)), text);
  });
});

test('转义字符串：中文不转成 \\uXXXX，保持可读', function () {
  assert.strictEqual(CORE.escapeEncode('你好\nworld'), '你好\\nworld');
});

test('转义字符串：粘贴进来的裸引号与裸换行也能还原', function () {
  // JSON.parse 遇到裸引号会直接抛错，这里按"能还原就还原"处理
  assert.strictEqual(CORE.escapeDecode('a"b\nc'), 'a"b\nc');
  assert.strictEqual(CORE.escapeDecode('\\u4e2d\\u6587'), '中文');
  assert.strictEqual(CORE.escapeDecode('\\u{1F600}'), '😀');
  assert.strictEqual(CORE.escapeDecode('\\q 认不出就原样'), '\\q 认不出就原样');
  assert.strictEqual(CORE.escapeDecode('\\t\\r\\b\\f\\/'), '\t\r\b\f/');
});

test('Hex：UTF-8 字节编码与解码', function () {
  assert.strictEqual(CORE.hexEncode('你好'), 'E4 BD A0 E5 A5 BD');
  assert.strictEqual(CORE.hexDecode('E4 BD A0 E5 A5 BD'), '你好');
  assert.strictEqual(CORE.hexDecode('e4bda0e5a5bd'), '你好');
  assert.strictEqual(CORE.hexDecode('0xE4 0xBD 0xA0 0xE5 0xA5 0xBD'), '你好');
  assert.strictEqual(CORE.hexDecode(CORE.hexEncode('emoji 😀 ok')), 'emoji 😀 ok');
});

test('Hex：坏输入给出可读的错误', function () {
  assert.throws(function () { CORE.hexDecode('ABC'); }, /偶数/);
  assert.throws(function () { CORE.hexDecode('zz'); }, /没有找到十六进制内容/);
  assert.throws(function () { CORE.hexDecode('FF'); }, /UTF-8/);
});

test('HTML 实体：默认只转五个特殊字符', function () {
  assert.strictEqual(CORE.entityEncode('<a href="#">中文</a>'), '&lt;a href=&quot;#&quot;&gt;中文&lt;/a&gt;');
  assert.strictEqual(CORE.entityEncode('a & b'), 'a &amp; b');
  assert.strictEqual(CORE.entityEncode("it's"), 'it&#39;s');
});

test('HTML 实体：全部转实体时每个字符都带码点', function () {
  assert.strictEqual(CORE.entityEncode('AB', true), '&#x41;&#x42;');
  assert.strictEqual(CORE.entityEncode('中', true), '&#x4E2D;');
});

test('HTML 实体：数字实体与具名实体都能还原', function () {
  assert.strictEqual(CORE.entityDecodeText('&#x4E2D;&#25991;'), '中文');
  assert.strictEqual(CORE.entityDecodeText('&lt;b&gt;&amp;&quot;&#39;'), '<b>&"\'');
  assert.strictEqual(CORE.entityDecodeText('&copy;&nbsp;&times;'), '\u00a9\u00a0\u00d7');
  // 认不出来的实体原样保留，不要吃掉内容
  assert.strictEqual(CORE.entityDecodeText('&unknown;'), '&unknown;');
  assert.strictEqual(CORE.entityDecodeText(CORE.entityEncode('中文 & <tag>', true)), '中文 & <tag>');
});

test('URL 编码：双向转换与错误提示', function () {
  assert.strictEqual(CORE.urlEncode('关键词=网页 工具'), '%E5%85%B3%E9%94%AE%E8%AF%8D%3D%E7%BD%91%E9%A1%B5%20%E5%B7%A5%E5%85%B7');
  assert.strictEqual(CORE.urlDecode('%E7%BD%91%E9%A1%B5'), '网页');
  assert.strictEqual(CORE.urlDecode(CORE.urlEncode('a/b?c=d&e')), 'a/b?c=d&e');
  assert.throws(function () { CORE.urlDecode('%E7%BD'); }, /不是合法的 URL 编码/);
});

test('convert：统一入口把四种类型都接上', function () {
  assert.strictEqual(CORE.convert('hex', '你好', false, false), 'E4 BD A0 E5 A5 BD');
  assert.strictEqual(CORE.convert('hex', 'E4 BD A0 E5 A5 BD', true, false), '你好');
  assert.strictEqual(CORE.convert('url', 'a b', false, false), 'a%20b');
  assert.strictEqual(CORE.convert('url', 'a%20b', true, false), 'a b');
  assert.strictEqual(CORE.convert('escape', 'a\nb', false, false), 'a\\nb');
  assert.strictEqual(CORE.convert('escape', 'a\\nb', true, false), 'a\nb');
  assert.throws(function () { CORE.convert('nope', 'x', false, false); }, /未知的转换类型/);
});

test('空输入不抛错', function () {
  assert.strictEqual(CORE.escapeEncode(''), '');
  assert.strictEqual(CORE.escapeDecode(''), '');
  assert.strictEqual(CORE.hexEncode(''), '');
  assert.strictEqual(CORE.entityEncode(''), '');
  assert.strictEqual(CORE.urlEncode(''), '');
  assert.throws(function () { CORE.hexDecode(''); }, /没有找到十六进制内容/);
});
