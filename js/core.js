/*
 * 花语花园核心逻辑（纯函数，浏览器与 Node 测试共用）
 * 以全局 FlowerCore 暴露，便于 file:// 直开时无模块依赖。
 */
(function (root) {
  'use strict';

  const core = {};

  core.slugify = function (latin) {
    return String(latin || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  core.hashDate = function (dateStr) {
    let h = 0;
    const s = String(dateStr || '');
    for (let i = 0; i < s.length; i++) {
      h = (h * 31 + s.charCodeAt(i)) >>> 0;
    }
    return h;
  };

  core.dailyIndex = function (flowers, dateStr) {
    if (!flowers || flowers.length === 0) return -1;
    const date = dateStr || new Date().toISOString().slice(0, 10);
    return core.hashDate(date) % flowers.length;
  };

  core.randomIndex = function (flowers, current) {
    const n = flowers.length;
    if (n === 0) return -1;
    if (n === 1) return 0;
    let next = Math.floor(Math.random() * n);
    while (next === current) next = Math.floor(Math.random() * n);
    return next;
  };

  core.normalize = function (s) {
    return String(s || '').toLowerCase().trim();
  };

  core.searchFlowers = function (flowers, query) {
    const q = core.normalize(query);
    if (!q) return flowers.slice();
    return flowers.filter(function (f) {
      const haystack = [
        f.name,
        f.en,
        f.latin,
        f.family,
        f.meaning,
        f.blurb,
        f.morph,
        f.culture,
        f.care,
        f.story,
        (f.aliases || []).join(' '),
        (f.colors || []).join(' ')
      ].join(' ');
      return core.normalize(haystack).includes(q);
    });
  };

  core.seasonForDate = function (dateStr, latitude) {
    const d = dateStr ? new Date(String(dateStr) + 'T12:00:00') : new Date();
    const m = d.getMonth() + 1;
    const south = typeof latitude === 'number' && latitude < 0;
    const table = [
      { key: 'spring', name: '春', line: '春风拂面，花开正好', particle: 'petal' },
      { key: 'summer', name: '夏', line: '夏日限定，绿意盎然', particle: 'sun' },
      { key: 'autumn', name: '秋', line: '秋高气爽，一叶知秋', particle: 'leaf' },
      { key: 'winter', name: '冬', line: '岁寒知松，静待花开', particle: 'snow' }
    ];
    let idx;
    if (m >= 3 && m <= 5) idx = 0;
    else if (m >= 6 && m <= 8) idx = 1;
    else if (m >= 9 && m <= 11) idx = 2;
    else idx = 3;
    if (south) idx = (idx + 2) % 4;
    const s = table[idx];
    return { key: s.key, name: s.name, line: s.line, particle: s.particle };
  };

  core.weatherText = function (code, isDay) {
    const c = Number(code);
    const day = isDay !== 0;
    let label = '天气未知';
    let icon = '🌿';
    let effect = 'none';
    let heavy = false;
    if (c === 0) { label = '晴'; icon = day ? '☀️' : '🌙'; effect = 'clear'; }
    else if (c === 1) { label = '大致晴朗'; icon = '🌤️'; effect = 'clear'; }
    else if (c === 2) { label = '多云'; icon = '⛅'; effect = 'clouds'; }
    else if (c === 3) { label = '阴'; icon = '☁️'; effect = 'clouds'; heavy = true; }
    else if (c === 45 || c === 48) { label = '雾'; icon = '🌫️'; effect = 'fog'; }
    else if (c >= 51 && c <= 57) { label = '毛毛雨'; icon = '🌦️'; effect = 'rain'; }
    else if (c >= 61 && c <= 67) { label = '大雨'; icon = '🌧️'; effect = 'rain'; heavy = true; }
    else if (c >= 71 && c <= 77) { label = '雪'; icon = '❄️'; effect = 'snow'; }
    else if (c >= 80 && c <= 82) { label = '阵雨'; icon = '🌦️'; effect = 'rain'; }
    else if (c === 85 || c === 86) { label = '阵雪'; icon = '❄️'; effect = 'snow'; }
    else if (c === 95) { label = '雷暴'; icon = '⛈️'; effect = 'thunder'; heavy = true; }
    else if (c === 96 || c === 99) { label = '雷暴伴冰雹'; icon = '⛈️'; effect = 'thunder'; heavy = true; }
    return { label: label, icon: icon, effect: effect, heavy: heavy };
  };

  core.splitStory = function (story) {
    const s = String(story || '').trim();
    if (!s) return [];
    const parts = s.split('||').map(function (x) { return x.trim(); }).filter(Boolean);
    return parts.length ? parts : [s];
  };

  core.seasonTags = function (seasonText) {
    const tags = [];
    const s = String(seasonText || '');
    ['春', '夏', '秋', '冬'].forEach(function (season) {
      if (s.includes(season)) tags.push(season);
    });
    return tags;
  };

  core.applyFilters = function (flowers, opts) {
    const options = opts || {};
    let list = core.searchFlowers(flowers, options.query || '');
    if (options.color) {
      list = list.filter(function (f) {
        return (f.colors || []).includes(options.color);
      });
    }
    if (options.season) {
      list = list.filter(function (f) {
        return core.seasonTags(f.season).includes(options.season);
      });
    }
    if (options.sort === 'name') {
      list = list.slice().sort(function (a, b) {
        return a.name.localeCompare(b.name, 'zh-CN');
      });
    } else if (options.sort === 'season') {
      list = list.slice().sort(function (a, b) {
        return String(a.season).localeCompare(String(b.season), 'zh-CN');
      });
    }
    return list;
  };

  core.parseHash = function (hash) {
    const h = String(hash || '').replace(/^#/, '');
    const path = h.split('?')[0];
    const parts = path.split('/').filter(Boolean);
    if (parts[0] === 'flower' && parts[1]) {
      return { route: 'flower', id: decodeURIComponent(parts[1]) };
    }
    if (parts[0] === 'explore') return { route: 'explore', id: null };
    if (parts[0] === 'today') return { route: 'today', id: null };
    if (parts[0] === 'garden') return { route: 'garden', id: null };
    return { route: 'home', id: null };
  };

  core.relatedFlowers = function (flowers, flower, limit) {
    const max = limit || 3;
    const others = flowers.filter(function (f) {
      return f.id !== flower.id;
    });
    return others
      .map(function (f) {
        let score = 0;
        if (f.family && f.family === flower.family) score += 2;
        if (f.colors && flower.colors) {
          if (f.colors.some(function (c) { return flower.colors.includes(c); })) score += 1;
        }
        return { f: f, s: score };
      })
      .filter(function (x) { return x.s > 0; })
      .sort(function (a, b) { return b.s - a.s; })
      .slice(0, max)
      .map(function (x) { return x.f; });
  };

  root.FlowerCore = core;
  if (typeof module !== 'undefined' && module.exports) module.exports = core;
})(typeof window !== 'undefined' ? window : globalThis);
