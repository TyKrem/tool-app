/* 字符串转换工具的核心逻辑（转义字符串 / UTF-8 Hex / HTML 实体 / URL 编码）。
   浏览器里挂到 window.StringCore，Node 里走 module.exports，便于单测。 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.StringCore = factory();
  }
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var ESCAPE_MAP = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '"': '"', "'": "'", '\\': '\\', '/': '/' };
  // 只收常用的具名实体；冷门的走 &#xXXXX; 数字实体也能还原
  var ENTITY_MAP = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0',
    copy: '\u00a9', reg: '\u00ae', trade: '\u2122', hellip: '\u2026',
    mdash: '\u2014', ndash: '\u2013', lsquo: '\u2018', rsquo: '\u2019',
    ldquo: '\u201c', rdquo: '\u201d', times: '\u00d7', divide: '\u00f7',
    plusmn: '\u00b1', deg: '\u00b0', euro: '\u20ac', pound: '\u00a3',
    yen: '\u00a5', sect: '\u00a7', para: '\u00b6', middot: '\u00b7', bull: '\u2022',
  };

  /* ---------- 转义字符串 ---------- */
  // 用 JSON 的转义规则，但不动非 ASCII（中文保持可读）
  function escapeEncode(value) {
    var json = JSON.stringify(String(value == null ? '' : value));
    return json.slice(1, -1);
  }

  // 手写扫描而不用 JSON.parse：粘贴进来的内容常常带裸换行或裸引号，
  // JSON.parse 会直接抛错，这里按"能还原就还原"处理
  function escapeDecode(value) {
    var text = String(value == null ? '' : value);
    var out = '';
    for (var i = 0; i < text.length; i++) {
      var char = text.charAt(i);
      if (char !== '\\') {
        out += char;
        continue;
      }
      var next = text.charAt(i + 1);
      if (next === 'u') {
        var braced = text.charAt(i + 2) === '{';
        var hex = braced ? text.slice(i + 3).split('}')[0] : text.slice(i + 2, i + 6);
        if (/^[0-9a-fA-F]{1,6}$/.test(hex) && (!braced || text.charAt(i + 3 + hex.length) === '}')) {
          var code = parseInt(hex, 16);
          if (code <= 0x10ffff) {
            out += String.fromCodePoint(code);
            i += braced ? hex.length + 3 : 5;
            continue;
          }
        }
        out += char;
        continue;
      }
      if (Object.prototype.hasOwnProperty.call(ESCAPE_MAP, next)) {
        out += ESCAPE_MAP[next];
        i++;
        continue;
      }
      // 认不出来的转义原样保留，免得越转越乱
      out += char;
    }
    return out;
  }

  /* ---------- UTF-8 Hex ---------- */
  function utf8Bytes(text) {
    return Array.from(new TextEncoder().encode(String(text == null ? '' : text)));
  }

  function hexEncode(value) {
    return utf8Bytes(value)
      .map(function (byte) {
        return byte.toString(16).padStart(2, '0').toUpperCase();
      })
      .join(' ');
  }

  function hexDecode(value) {
    var cleaned = String(value == null ? '' : value).replace(/0x/gi, '').replace(/[^0-9a-fA-F]/g, '');
    if (!cleaned) throw new Error('没有找到十六进制内容');
    if (cleaned.length % 2) throw new Error('十六进制字符个数必须是偶数（每两个字符一个字节）');
    var bytes = new Uint8Array(cleaned.length / 2);
    for (var i = 0; i < bytes.length; i++) bytes[i] = parseInt(cleaned.substr(i * 2, 2), 16);
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch (e) {
      throw new Error('这不是合法的 UTF-8 字节序列');
    }
  }

  /* ---------- HTML 实体 ---------- */
  function entityEncode(value, all) {
    var chars = Array.from(String(value == null ? '' : value));
    return chars
      .map(function (char) {
        var code = char.codePointAt(0);
        if (all) return '&#x' + code.toString(16).toUpperCase() + ';';
        if (char === '&') return '&amp;';
        if (char === '<') return '&lt;';
        if (char === '>') return '&gt;';
        if (char === '"') return '&quot;';
        if (char === "'") return '&#39;';
        return char;
      })
      .join('');
  }

  function entityDecodeText(value) {
    var text = String(value == null ? '' : value);
    return text.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z][a-zA-Z0-9]*);/g, function (whole, body) {
      if (body.charAt(0) === '#') {
        var code = body.charAt(1) === 'x' || body.charAt(1) === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
        if (!code || code > 0x10ffff) return whole;
        try {
          return String.fromCodePoint(code);
        } catch (e) {
          return whole;
        }
      }
      var named = ENTITY_MAP[body.toLowerCase()];
      return named === undefined ? whole : named;
    });
  }

  // 浏览器里有 DOM，用 textarea 解实体能覆盖全部具名实体；Node 里退回上面的常用表
  function entityDecode(value) {
    var text = String(value == null ? '' : value);
    if (typeof document !== 'undefined' && document.createElement) {
      var holder = document.createElement('textarea');
      holder.innerHTML = text;
      return holder.value;
    }
    return entityDecodeText(text);
  }

  /* ---------- URL 编码 ---------- */
  function urlEncode(value) {
    return encodeURIComponent(String(value == null ? '' : value));
  }

  function urlDecode(value) {
    try {
      return decodeURIComponent(String(value == null ? '' : value));
    } catch (e) {
      throw new Error('不是合法的 URL 编码（% 后面需要跟两位十六进制）');
    }
  }

  // type: escape | hex | entity | url；reverse 为 true 时是"还原"
  function convert(type, value, reverse, allEntity) {
    if (type === 'escape') return reverse ? escapeDecode(value) : escapeEncode(value);
    if (type === 'hex') return reverse ? hexDecode(value) : hexEncode(value);
    if (type === 'entity') return reverse ? entityDecode(value) : entityEncode(value, allEntity);
    if (type === 'url') return reverse ? urlDecode(value) : urlEncode(value);
    throw new Error('未知的转换类型');
  }

  return {
    escapeEncode: escapeEncode,
    escapeDecode: escapeDecode,
    hexEncode: hexEncode,
    hexDecode: hexDecode,
    entityEncode: entityEncode,
    entityDecode: entityDecode,
    entityDecodeText: entityDecodeText,
    urlEncode: urlEncode,
    urlDecode: urlDecode,
    convert: convert,
  };
});
