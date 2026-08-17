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
        (f.aliases || []).join(' '),
        (f.colors || []).join(' ')
      ].join(' ');
      return core.normalize(haystack).includes(q);
    });
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
