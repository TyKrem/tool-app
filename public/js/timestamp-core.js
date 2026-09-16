/* 时间戳工具的核心逻辑（时间 ↔ 秒/毫秒时间戳、时区格式化、相对时间）。
   浏览器里挂到 window.TimestampCore，Node 里走 module.exports，便于单测。 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TimestampCore = factory();
  }
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var MINUTE = 60000;
  var HOUR = 3600000;
  var DAY = 86400000;

  // 取某个时刻在指定时区（不传就用本机时区）的年月日时分秒
  function zoneParts(millis, timeZone) {
    var date = new Date(millis);
    var formatter = new Intl.DateTimeFormat('zh-CN', {
      timeZone: timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    var parts = {};
    formatter.formatToParts(date).forEach(function (item) {
      parts[item.type] = item.value;
    });
    return {
      year: parts.year,
      month: parts.month,
      day: parts.day,
      hour: parts.hour,
      minute: parts.minute,
      second: parts.second,
      millisecond: String(date.getMilliseconds()).padStart(3, '0'),
    };
  }

  function formatTime(millis, options) {
    var opts = options || {};
    var p = zoneParts(millis, opts.timeZone);
    return (
      p.year + '-' + p.month + '-' + p.day + ' ' + p.hour + ':' + p.minute + ':' + p.second +
      (opts.withMillis ? '.' + p.millisecond : '')
    );
  }

  // datetime-local 控件给出的就是本地时间字符串，这里按本机时区还原成毫秒
  function parseLocalInput(text) {
    var match = String(text == null ? '' : text).match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (!match) return NaN;
    var year = Number(match[1]);
    var month = Number(match[2]);
    var day = Number(match[3]);
    var hour = Number(match[4]);
    var minute = Number(match[5]);
    var second = match[6] === undefined ? 0 : Number(match[6]);
    if (hour > 23 || minute > 59 || second > 59) return NaN;
    var date = new Date(year, month - 1, day, hour, minute, second);
    // 2026-02-30 会被 Date 顺延，回头比一次才知道是不是真日期
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return NaN;
    return date.getTime();
  }

  function toLocalInput(millis) {
    var p = zoneParts(millis);
    return p.year + '-' + p.month + '-' + p.day + 'T' + p.hour + ':' + p.minute + ':' + p.second;
  }

  // 时间戳：10 位以内按秒、更长的按毫秒；返回 { millis, unit }
  function parseStamp(raw, preferredUnit) {
    var text = String(raw == null ? '' : raw).trim();
    if (!/^-?\d+$/.test(text)) throw new Error('时间戳只能是整数');
    var digits = text.replace('-', '').length;
    var unit = preferredUnit;
    if (unit !== 'seconds' && unit !== 'milliseconds') unit = digits > 10 ? 'milliseconds' : 'seconds';
    // 位数和选定单位明显对不上时以位数为准，避免把 13 位毫秒值当成秒
    if (unit === 'seconds' && digits > 10) unit = 'milliseconds';
    if (unit === 'milliseconds' && digits <= 10) unit = 'seconds';
    var value = Number(text);
    if (!Number.isFinite(value)) throw new Error('时间戳超出可转换范围');
    var millis = unit === 'seconds' ? value * 1000 : value;
    var date = new Date(millis);
    if (Number.isNaN(date.getTime())) throw new Error('时间戳超出可转换范围');
    return { millis: millis, unit: unit };
  }

  function zoneOffsetMinutes(millis) {
    return -new Date(millis).getTimezoneOffset();
  }

  function formatOffset(minutes) {
    var sign = minutes < 0 ? '-' : '+';
    var abs = Math.abs(minutes);
    return 'UTC' + sign + String(Math.floor(abs / 60)).padStart(2, '0') + ':' + String(abs % 60).padStart(2, '0');
  }

  function localZoneLabel(millis) {
    var minutes = zoneOffsetMinutes(millis === undefined ? Date.now() : millis);
    var name;
    try {
      name = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    } catch (e) {
      name = '';
    }
    return (name ? name + ' · ' : '') + formatOffset(minutes);
  }

  // 相对时间："3 天前""2 小时后"，让人一眼看懂时间戳离现在多远
  function relativeText(targetMillis, nowMillis) {
    var now = nowMillis === undefined ? Date.now() : nowMillis;
    var delta = targetMillis - now;
    var past = delta < 0;
    var abs = Math.abs(delta);
    var text;
    if (abs < 10000) return '就是现在';
    if (abs < MINUTE) text = Math.round(abs / 1000) + ' 秒';
    else if (abs < HOUR) text = Math.round(abs / MINUTE) + ' 分钟';
    else if (abs < DAY) text = Math.round(abs / HOUR) + ' 小时';
    else if (abs < 30 * DAY) text = Math.round(abs / DAY) + ' 天';
    else if (abs < 365 * DAY) text = Math.round(abs / (30 * DAY)) + ' 个月';
    else text = (abs / (365 * DAY)).toFixed(1) + ' 年';
    return text + (past ? '前' : '后');
  }

  return {
    zoneParts: zoneParts,
    formatTime: formatTime,
    parseLocalInput: parseLocalInput,
    toLocalInput: toLocalInput,
    parseStamp: parseStamp,
    zoneOffsetMinutes: zoneOffsetMinutes,
    formatOffset: formatOffset,
    localZoneLabel: localZoneLabel,
    relativeText: relativeText,
  };
});
