/*
 * 花语花园前端逻辑（经典脚本，兼容 file:// 直开）
 * 依赖全局：FLOWERS（data/flowers.js）、FlowerCore（js/core.js）
 */
(function () {
  'use strict';

  const core = window.FlowerCore;
  const FLOWERS = window.FLOWERS || [];
  const app = document.getElementById('app');

  const COLOR_ORDER = ['红', '粉', '白', '黄', '橙', '紫', '蓝', '绿', '黑', '多彩'];
  const SEASONS = ['春', '夏', '秋', '冬'];
  const BG_KEY = 'flowergarden.bg';
  const BACKGROUNDS = [
    { name: '奶油原色', css: '' },
    { name: '樱落小径', css: 'url("backgrounds/bg-01.webp")' },
    { name: '紫花春树', css: 'url("backgrounds/bg-02.webp")' },
    { name: '初夏晴空', css: 'url("backgrounds/bg-03.webp")' },
    { name: '花田远山', css: 'url("backgrounds/bg-04.webp")' },
    { name: '秋雪星野', css: 'url("backgrounds/bg-05.webp")' },
    { name: '冬雪暖灯', css: 'url("backgrounds/bg-06.webp")' }
  ];

  const state = {
    routeKey: '',
    explore: { query: '', color: '', season: '', sort: '' },
    heroId: null
  };

  /* ---------- 工具 ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function localDateStr() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  function formatDateCN(dateStr) {
    const parts = String(dateStr).split('-');
    if (parts.length !== 3) return dateStr;
    return Number(parts[0]) + '年' + Number(parts[1]) + '月' + Number(parts[2]) + '日';
  }

  function colorCounts() {
    const map = {};
    FLOWERS.forEach(function (f) {
      (f.colors || []).forEach(function (c) {
        map[c] = (map[c] || 0) + 1;
      });
    });
    return COLOR_ORDER.map(function (c) { return { color: c, count: map[c] || 0 }; })
      .filter(function (x) { return x.count > 0; });
  }

  function seasonCounts() {
    const map = {};
    FLOWERS.forEach(function (f) {
      core.seasonTags(f.season).forEach(function (s) { map[s] = (map[s] || 0) + 1; });
    });
    return SEASONS.filter(function (s) { return map[s]; })
      .map(function (s) { return { season: s, count: map[s] }; });
  }

  function colorHex(color) {
    const map = {
      '红': '#D96C6C', '粉': '#EFB7B1', '白': '#F4F1EA', '黄': '#EACB7E',
      '橙': '#E79A5B', '紫': '#9D86B8', '蓝': '#7FA3C9', '绿': '#8FA98F',
      '黑': '#4A4642', '多彩': '#D9B48F'
    };
    return map[color] || '#D9B48F';
  }

  function randomPicks(count) {
    const idxs = [];
    const n = FLOWERS.length;
    if (n === 0) return [];
    const max = Math.min(count, n);
    while (idxs.length < max) {
      const r = Math.floor(Math.random() * n);
      if (!idxs.includes(r)) idxs.push(r);
    }
    return idxs.map(function (i) { return FLOWERS[i]; });
  }

  function fetchJson(url, timeoutMs) {
    return new Promise(function (resolve, reject) {
      const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = window.setTimeout(function () {
        if (ctrl) ctrl.abort();
        reject(new Error('timeout'));
      }, timeoutMs || 4000);
      fetch(url, ctrl ? { signal: ctrl.signal } : {})
        .then(function (r) {
          if (!r.ok) throw new Error('http ' + r.status);
          return r.json();
        })
        .then(resolve, reject)
        .finally(function () { window.clearTimeout(timer); });
    });
  }

  function cardHtml(f, opts) {
    const o = opts || {};
    const colors = (f.colors || []).slice(0, 4)
      .map(function (c) { return '<span class="dot" style="background:' + colorHex(c) + '" title="' + esc(c) + '"></span>'; })
      .join('');
    return (
      '<a class="flower-card fade-up" href="#/flower/' + encodeURIComponent(f.id) + '">' +
        '<div class="flower-card-media">' +
          '<img data-img alt="' + esc(f.name) + '的图片" src="' + esc(f.image) + '" loading="lazy" decoding="async">' +
          '<span class="shimmer" aria-hidden="true"></span>' +
        '</div>' +
        '<div class="flower-card-body">' +
          '<h3 class="flower-card-name">' + esc(f.name) + '</h3>' +
          '<div class="flower-card-latin">' + esc(f.latin) + '</div>' +
          '<div class="flower-card-bottom">' +
            '<span class="dot-row">' + colors + '</span>' +
            '<span class="flower-card-meaning">' + esc(f.meaning) + '</span>' +
          '</div>' +
        '</div>' +
      '</a>'
    );
  }

  function tagHtml(flower) {
    const colors = (flower.colors || []).slice(0, 3)
      .map(function (c) {
        return '<span class="tag"><span class="tag-dot" style="background:' + colorHex(c) + '"></span>' + esc(c) + '</span>';
      })
      .join('');
    return colors + '<span class="tag">' + esc(flower.family) + '</span><span class="tag">花期 · ' + esc(flower.season) + '</span>';
  }

  function sectionHtml(f, preview) {
    const cls = preview ? 'detail-section is-preview' : 'detail-section';
    return (
      '<div class="detail-sections">' +
        '<section class="' + cls + '"><h3 class="detail-section-title">形态特征</h3><p>' + esc(f.morph) + '</p></section>' +
        '<section class="' + cls + '"><h3 class="detail-section-title">花语与文化</h3><p>' + esc(f.culture) + '</p></section>' +
        '<section class="' + cls + '"><h3 class="detail-section-title">分布与养护</h3><p>' + esc(f.care) + '</p></section>' +
      '</div>'
    );
  }

  function todayCopyHtml(f, dateStr) {
    return (
      '<span class="eyebrow">' + svgIcon('calendar') + '每日一花 · ' + esc(formatDateCN(dateStr)) + '</span>' +
      '<h1 class="today-title">' + esc(f.name) + '</h1>' +
      '<div class="today-latin">' + esc(f.latin) + '</div>' +
      '<div class="today-meaning">花语 · ' + esc(f.meaning) + '</div>' +
      '<p class="today-blurb">' + esc(f.blurb) + '</p>' +
      sectionHtml(f, true) +
      '<div class="today-actions">' +
        '<a class="btn btn-primary" href="#/flower/' + encodeURIComponent(f.id) + '">查看完整详情</a>' +
        '<button class="btn btn-ghost" data-action="shuffle-today">' + svgIcon('shuffle') + '换一朵</button>' +
      '</div>' +
      '<div class="hero-tags">' + tagHtml(f) + '</div>'
    );
  }

  function svgIcon(name) {
    const icons = {
      search: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.8-3.8"/></svg>',
      shuffle: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="m15 15 6 6"/><path d="M4 4l5 5"/></svg>',
      calendar: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>',
      left: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
      right: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>'
    };
    return icons[name] || '';
  }

  /* ---------- 图片加载处理 ---------- */
  function bindImages(root) {
    root.querySelectorAll('img[data-img]').forEach(function (img) {
      if (img.complete && img.naturalWidth > 0) img.classList.add('is-ready');
      img.addEventListener('load', function () { img.classList.add('is-ready'); });
      img.addEventListener('error', function () {
        const box = img.parentElement;
        const fallback = document.createElement('div');
        fallback.className = 'img-failed';
        fallback.textContent = '图片加载失败';
        box.replaceChild(fallback, img);
      });
    });
  }

  /* ---------- 首页 ---------- */
  function renderHome() {
    const todayStr = localDateStr();
    const dailyIndex = core.dailyIndex(FLOWERS, todayStr);
    state.heroId = FLOWERS[dailyIndex] ? FLOWERS[dailyIndex].id : null;
    const hero = FLOWERS[dailyIndex];
    if (!hero) {
      app.innerHTML = '<div class="container not-found"><p>数据尚未生成，请先运行数据流水线。</p></div>';
      return;
    }

    const colors = colorCounts().map(function (x) {
      return (
        '<a class="color-chip" href="#/explore?color=' + encodeURIComponent(x.color) + '">' +
          '<span class="color-swatch" style="background:' + colorHex(x.color) + '"></span>' +
          '<span class="color-name">' + esc(x.color) + ' · ' + x.count + '</span>' +
        '</a>'
      );
    }).join('');

    const picks = randomPicks(6).map(cardHtml).join('');

    app.innerHTML =
      '<div class="container">' +
        '<section class="today-card view-enter">' +
          '<a class="today-card-media" href="#/flower/' + encodeURIComponent(hero.id) + '" aria-label="查看' + esc(hero.name) + '详情" tabindex="-1">' +
            '<img data-img alt="' + esc(hero.name) + '的图片" src="' + esc(hero.image) + '">' +
            '<span class="shimmer" aria-hidden="true"></span>' +
          '</a>' +
          '<div class="today-card-body">' +
            '<span class="eyebrow">' + svgIcon('calendar') + '今日之花 · ' + esc(formatDateCN(todayStr)) + '</span>' +
            '<h1 class="today-card-name">' + esc(hero.name) + '</h1>' +
            '<div class="today-card-latin">' + esc(hero.latin) + '</div>' +
            '<div class="today-card-meaning">花语 · ' + esc(hero.meaning) + '</div>' +
            '<p class="today-card-blurb">' + esc(hero.blurb) + '</p>' +
            '<div class="hero-tags">' + tagHtml(hero) + '</div>' +
            '<div class="today-card-actions">' +
              '<a class="btn btn-primary" href="#/flower/' + encodeURIComponent(hero.id) + '">查看详情</a>' +
              '<a class="btn btn-ghost" href="#/today">' + svgIcon('calendar') + '今日之花页</a>' +
            '</div>' +
          '</div>' +
        '</section>' +
      '</div>' +
      '<div class="container">' +
        '<section class="stats">' +
          '<div class="stat"><div class="stat-num">' + FLOWERS.length + '</div><div class="stat-label">收录花卉</div></div>' +
          '<div class="stat"><div class="stat-num">365</div><div class="stat-label">每日一花</div></div>' +
          '<div class="stat"><div class="stat-num">100%</div><div class="stat-label">真实照片</div></div>' +
        '</section>' +
        '<section class="section">' +
          '<div class="section-head">' +
            '<h2 class="section-title">按颜色寻找</h2>' +
            '<a class="section-link" href="#/explore">查看全部 →</a>' +
          '</div>' +
          '<div class="color-grid">' + colors + '</div>' +
        '</section>' +
        '<section class="section">' +
          '<div class="quote-band fade-up">' +
            '<div class="quote-label">今日花语</div>' +
            '<p class="quote-text">' + esc(hero.meaning) + '</p>' +
          '</div>' +
        '</section>' +
        '<section class="section">' +
          '<div class="section-head">' +
            '<h2 class="section-title">随便逛逛</h2>' +
            '<span class="section-sub">六朵小花，送给此刻的你</span>' +
          '</div>' +
          '<div class="flower-grid">' + picks + '</div>' +
        '</section>' +
      '</div>';

    bindImages(app);
  }

  /* ---------- 今日之花页 ---------- */
  function renderToday() {
    const todayStr = localDateStr();
    const dailyIndex = core.dailyIndex(FLOWERS, todayStr);
    state.todayId = FLOWERS[dailyIndex] ? FLOWERS[dailyIndex].id : null;
    const f = FLOWERS[dailyIndex];
    if (!f) {
      app.innerHTML = '<div class="container not-found"><p>数据尚未生成，请先运行数据流水线。</p></div>';
      return;
    }

    const relatedList = core.relatedFlowers(FLOWERS, f, 3);
    const related = (relatedList.length ? relatedList : randomPicks(3)).map(cardHtml).join('');

    app.innerHTML =
      '<div class="container">' +
        '<section class="today-hero">' +
          '<div class="today-hero-copy view-enter" id="today-copy">' + todayCopyHtml(f, todayStr) + '</div>' +
          '<div class="today-hero-art view-enter" id="today-art">' +
            '<div class="hero-frame">' +
              '<img data-img alt="' + esc(f.name) + '的图片" src="' + esc(f.image) + '">' +
              '<span class="shimmer" aria-hidden="true"></span>' +
              '<span class="hero-badge">' + svgIcon('calendar') + '今日之花</span>' +
            '</div>' +
          '</div>' +
        '</section>' +
        '<section class="section">' +
          '<div class="section-head"><h2 class="section-title">同色推荐</h2></div>' +
          '<div class="flower-grid" id="today-related">' + related + '</div>' +
        '</section>' +
      '</div>';

    bindImages(app);
  }

  function renderTodayOnly(f) {
    const copy = document.getElementById('today-copy');
    const art = document.getElementById('today-art');
    if (!copy || !art) return;
    copy.innerHTML = todayCopyHtml(f, localDateStr());
    art.innerHTML =
      '<div class="hero-frame">' +
        '<img data-img alt="' + esc(f.name) + '的图片" src="' + esc(f.image) + '">' +
        '<span class="shimmer" aria-hidden="true"></span>' +
        '<span class="hero-badge">' + svgIcon('calendar') + '今日之花</span>' +
      '</div>';
    bindImages(art);
    [copy, art].forEach(function (el) {
      el.classList.remove('view-enter');
      void el.offsetWidth;
      el.classList.add('view-enter');
    });
  }

  /* ---------- 探索页 ---------- */
  function hashParams() {
    const hash = String(location.hash || '').replace(/^#/, '');
    const qIndex = hash.indexOf('?');
    if (qIndex < 0) return {};
    const params = {};
    new URLSearchParams(hash.slice(qIndex + 1)).forEach(function (v, k) {
      if (v) params[k] = v;
    });
    return params;
  }

  function renderExplore(applyParams) {
    if (applyParams) {
      const params = hashParams();
      if (params.color) state.explore.color = params.color;
      if (params.season) state.explore.season = params.season;
    }

    const colorChips = colorCounts().map(function (x) {
      return (
        '<button class="chip' + (state.explore.color === x.color ? ' is-active' : '') + '" data-filter="color" data-value="' + esc(x.color) + '">' +
          '<span class="chip-dot" style="background:' + colorHex(x.color) + '"></span>' + esc(x.color) + ' · ' + x.count +
        '</button>'
      );
    }).join('');

    const seasonChips = seasonCounts().map(function (x) {
      return (
        '<button class="chip' + (state.explore.season === x.season ? ' is-active' : '') + '" data-filter="season" data-value="' + esc(x.season) + '">' +
          esc(x.season) + '季 · ' + x.count +
        '</button>'
      );
    }).join('');

    const sortChips = [
      { value: '', label: '默认' },
      { value: 'name', label: '按名称' },
      { value: 'season', label: '按花期' }
    ].map(function (s) {
      return (
        '<button class="chip' + (state.explore.sort === s.value ? ' is-active' : '') + '" data-filter="sort" data-value="' + esc(s.value) + '">' +
          esc(s.label) +
        '</button>'
      );
    }).join('');

    app.innerHTML =
      '<div class="container">' +
        '<div class="explore-head fade-up">' +
          '<h1 class="explore-title">花大全</h1>' +
          '<p class="explore-sub">共收录 ' + FLOWERS.length + ' 种花卉，可搜索中文名、学名、花语或颜色</p>' +
        '</div>' +
        '<div class="explore-controls fade-up">' +
          '<div class="search-box">' +
            svgIcon('search') +
            '<input class="search-input" id="search-input" type="search" placeholder="搜索花名、学名、花语…" value="' + esc(state.explore.query) + '" aria-label="搜索花卉">' +
          '</div>' +
          '<div class="filter-group" aria-label="颜色筛选">' +
            '<span class="filter-label">颜色</span>' + colorChips +
          '</div>' +
          '<div class="filter-group" aria-label="季节筛选">' +
            '<span class="filter-label">季节</span>' + seasonChips +
          '</div>' +
          '<div class="filter-group" aria-label="排序">' +
            '<span class="filter-label">排序</span>' + sortChips +
          '</div>' +
        '</div>' +
        '<div id="result-bar"></div>' +
        '<div id="result-grid" class="flower-grid"></div>' +
      '</div>';

    document.getElementById('search-input').addEventListener('input', function (e) {
      state.explore.query = e.target.value.trim();
      updateResults();
    });
    updateResults();
  }

  function updateResults() {
    const list = core.applyFilters(FLOWERS, state.explore);
    const bar = document.getElementById('result-bar');
    const grid = document.getElementById('result-grid');
    if (!grid) return;

    const hasFilter = state.explore.color || state.explore.season || state.explore.query || state.explore.sort;
    bar.innerHTML =
      '<div class="result-bar">' +
        '<span class="result-count">找到 ' + list.length + ' 种花卉</span>' +
        (hasFilter ? '<button class="clear-btn" data-action="clear-filters">清除筛选</button>' : '') +
      '</div>';

    if (!list.length) {
      grid.innerHTML =
        '<div class="empty-state">' +
          '<div class="empty-petal"></div>' +
          '<div class="empty-title">没有找到这样的花</div>' +
          '<p>换个颜色、季节或关键词试试吧</p>' +
        '</div>';
    } else {
      grid.innerHTML = list.map(cardHtml).join('');
    }
    bindImages(grid);
  }

  /* ---------- 详情页 ---------- */
  function renderDetail(id) {
    const idx = FLOWERS.findIndex(function (f) { return f.id === id; });
    if (idx < 0) {
      app.innerHTML =
        '<div class="container not-found">' +
          '<h1 class="not-found-title">这朵花还没找到</h1>' +
          '<p class="not-found-text">可能迷路了，回花大全看看吧</p>' +
          '<a class="btn btn-primary" href="#/explore">去花大全</a>' +
        '</div>';
      return;
    }

    const f = FLOWERS[idx];
    const prev = FLOWERS[(idx - 1 + FLOWERS.length) % FLOWERS.length];
    const next = FLOWERS[(idx + 1) % FLOWERS.length];
    let related = core.relatedFlowers(FLOWERS, f, 3);
    if (!related.length) {
      related = [FLOWERS[(idx + 1) % FLOWERS.length], FLOWERS[(idx + 2) % FLOWERS.length], FLOWERS[(idx + 3) % FLOWERS.length]]
        .filter(function (x) { return x && x.id !== f.id; });
    }

    const facts = [
      { label: '别名', value: (f.aliases && f.aliases.length ? f.aliases.join('、') : '—') },
      { label: '科属', value: f.family },
      { label: '颜色', value: (f.colors || []).join('、') },
      { label: '花期', value: f.season }
    ].map(function (x) {
      return '<div class="fact"><div class="fact-label">' + esc(x.label) + '</div><div class="fact-value">' + esc(x.value) + '</div></div>';
    }).join('');
    const storyParts = core.splitStory(f.story).map(function (p, i) {
      return '<p' + (i === 0 ? ' class="story-lead"' : '') + '>' + esc(p) + '</p>';
    }).join('');

    app.innerHTML =
      '<div class="container">' +
        '<div class="detail fade-in">' +
          '<a class="detail-back" href="#/explore">' + svgIcon('left') + '返回花大全</a>' +
          '<div class="detail-layout">' +
            '<div class="detail-media media-enter">' +
              '<img data-img alt="' + esc(f.name) + '的图片" src="' + esc(f.image) + '">' +
              '<span class="shimmer" aria-hidden="true"></span>' +
            '</div>' +
            '<div class="detail-copy">' +
              '<h1 class="detail-name item-enter">' + esc(f.name) + '</h1>' +
              '<div class="detail-latin item-enter" style="animation-delay:80ms">' + esc(f.latin) + (f.en ? ' · ' + esc(f.en) : '') + '</div>' +
              '<div class="detail-meaning item-enter" style="animation-delay:160ms">' + esc(f.meaning) + '</div>' +
              '<p class="detail-blurb item-enter" style="animation-delay:240ms">' + esc(f.blurb) + '</p>' +
              '<div class="detail-story item-enter" style="animation-delay:320ms">' +
                '<h3 class="detail-section-title">小故事 · 文艺与流行文化</h3>' +
                storyParts +
              '</div>' +
              '<div class="item-enter" style="animation-delay:420ms">' + sectionHtml(f, false) + '</div>' +
              '<div class="detail-facts item-enter" style="animation-delay:520ms">' + facts + '</div>' +
              '<div class="detail-credit item-enter" style="animation-delay:600ms">' +
                '图片：' + esc(f.credit.author) + '，' + esc(f.credit.license) +
                (f.credit.source ? '，<a href="' + esc(f.credit.source) + '" target="_blank" rel="noopener noreferrer">查看原图</a>' : '') +
                '（来源 Wikimedia Commons）' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<nav class="detail-nav" aria-label="相邻花卉">' +
            '<a class="detail-nav-link" href="#/flower/' + encodeURIComponent(prev.id) + '">' + svgIcon('left') + esc(prev.name) + '</a>' +
            '<a class="detail-nav-link" href="#/flower/' + encodeURIComponent(next.id) + '">' + esc(next.name) + svgIcon('right') + '</a>' +
          '</nav>' +
        '</div>' +
        '<section class="section">' +
          '<div class="section-head"><h2 class="section-title">相关推荐</h2></div>' +
          '<div class="flower-grid">' + related.map(cardHtml).join('') + '</div>' +
        '</section>' +
      '</div>';

    bindImages(app);
  }

  /* ---------- 路由 ---------- */
  function currentRoute() {
    const r = core.parseHash(location.hash);
    const key = r.route + ':' + (r.id || '');
    const params = hashParams();
    if (r.route === 'explore' && (params.color || params.season)) {
      return { r: r, key: key + '?' + new URLSearchParams(params).toString() };
    }
    return { r: r, key: key };
  }

  function setNav(current) {
    document.querySelectorAll('.nav-link').forEach(function (a) {
      if (a.getAttribute('href') === '#/' && current === 'home') a.setAttribute('aria-current', 'page');
      else if (a.getAttribute('href') === '#/today' && current === 'today') a.setAttribute('aria-current', 'page');
      else if (a.getAttribute('href') === '#/explore' && (current === 'explore' || current === 'flower')) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  function render() {
    const { r, key } = currentRoute();
    if (key !== state.routeKey) {
      state.routeKey = key;
      if (r.route === 'flower') renderDetail(r.id);
      else if (r.route === 'explore') renderExplore(true);
      else if (r.route === 'today') renderToday();
      else renderHome();
      window.scrollTo(0, 0);
    }
    setNav(r.route);
  }

  /* ---------- 事件 ---------- */
  document.addEventListener('click', function (e) {
    const shuffleBtn = e.target.closest('[data-action="shuffle-today"]');
    if (shuffleBtn) {
      e.preventDefault();
      const currentIdx = FLOWERS.findIndex(function (f) { return f.id === state.todayId; });
      const nextIdx = core.randomIndex(FLOWERS, currentIdx);
      state.todayId = FLOWERS[nextIdx].id;
      renderTodayOnly(FLOWERS[nextIdx]);
      return;
    }

    const clearBtn = e.target.closest('[data-action="clear-filters"]');
    if (clearBtn) {
      state.explore = { query: '', color: '', season: '', sort: '' };
      renderExplore(false);
      return;
    }

    const chip = e.target.closest('[data-filter]');
    if (chip) {
      const key = chip.getAttribute('data-filter');
      const value = chip.getAttribute('data-value');
      state.explore[key] = state.explore[key] === value ? '' : value;
      renderExplore(false);
    }
  });

  window.addEventListener('hashchange', render);
  render();

  /* ---------- 背景图切换 ---------- */
  function applyBg(idx) {
    const entry = BACKGROUNDS[idx] || BACKGROUNDS[0];
    const el = document.getElementById('site-bg');
    if (el) {
      el.style.backgroundImage = entry.css || 'none';
      el.setAttribute('data-mode', entry.css ? 'image' : 'cream');
    }
    const btn = document.getElementById('bg-toggle');
    if (btn) btn.setAttribute('aria-label', '切换背景图（当前：' + entry.name + '）');
    return entry;
  }

  function switchBg(nextIdx) {
    if (nextIdx < 0 || nextIdx >= BACKGROUNDS.length) return;
    if (nextIdx === state.bg) return;
    if (state.bgBusy) return;
    const entry = BACKGROUNDS[nextIdx];
    const btn = document.getElementById('bg-toggle');
    const rect = btn ? btn.getBoundingClientRect() : null;
    const x = rect ? Math.round(rect.left + rect.width / 2) : Math.round(window.innerWidth * 0.92);
    const y = rect ? Math.round(rect.top + rect.height / 2) : Math.round(window.innerHeight * 0.9);

    const reveal = document.createElement('div');
    reveal.className = 'bg-reveal' + (entry.css ? '' : ' is-cream');
    reveal.setAttribute('aria-hidden', 'true');
    reveal.style.setProperty('--rx', x + 'px');
    reveal.style.setProperty('--ry', y + 'px');
    reveal.innerHTML =
      '<div class="bg-reveal-img"></div>' +
      '<div class="bg-reveal-veil"></div>';
    if (entry.css) reveal.querySelector('.bg-reveal-img').style.backgroundImage = entry.css;
    document.body.appendChild(reveal);
    state.bgBusy = true;

    if (btn) {
      btn.classList.remove('is-pulse');
      void btn.offsetWidth;
      btn.classList.add('is-pulse');
      window.setTimeout(function () { btn.classList.remove('is-pulse'); }, 650);
    }

    let done = false;
    function finish() {
      if (done) return;
      done = true;
      applyBg(nextIdx);
      if (reveal.parentNode) reveal.remove();
      state.bg = nextIdx;
      state.bgBusy = false;
      try { localStorage.setItem(BG_KEY, String(nextIdx)); } catch (e) {}
    }
    reveal.addEventListener('transitionend', function onEnd(ev) {
      if (ev.propertyName !== 'clip-path' && ev.propertyName !== '-webkit-clip-path') return;
      reveal.removeEventListener('transitionend', onEnd);
      finish();
    });
    void reveal.offsetWidth;
    reveal.classList.add('is-in');
    window.setTimeout(finish, 1600);
  }

  state.bg = (function () {
    let idx = 0;
    try { idx = Number(localStorage.getItem(BG_KEY)); } catch (e) {}
    return (idx >= 0 && idx < BACKGROUNDS.length) ? idx : 0;
  })();
  state.bgBusy = false;
  applyBg(state.bg);

  const bgBtn = document.getElementById('bg-toggle');
  if (bgBtn) {
    bgBtn.addEventListener('click', function () {
      switchBg((state.bg + 1) % BACKGROUNDS.length);
    });
  }

  window.addEventListener('load', function () {
    BACKGROUNDS.forEach(function (b) {
      if (b.css) {
        const img = new Image();
        img.src = b.css.replace(/^url\("|"\)$/g, '');
      }
    });
  });

  /* ---------- 季节 + 天气开场动画 ---------- */
  function spawnParticles(overlay, type) {
    const wrap = overlay.querySelector('.intro-particles');
    if (!wrap) return;
    const kind = type || 'petal';
    const count = kind === 'sun' ? 24 : 40;
    for (let i = 0; i < count; i++) {
      const p = document.createElement('span');
      p.className = 'intro-particle particle-' + kind;
      p.style.left = (Math.random() * 100) + '%';
      if (kind === 'sun') {
        p.style.animationDelay = (Math.random() * 2.5) + 's';
        p.style.animationDuration = (3.2 + Math.random() * 3.2) + 's';
      } else {
        p.style.animationDelay = (Math.random() * 5) + 's';
        p.style.animationDuration = (7 + Math.random() * 5) + 's';
      }
      p.style.transform = 'scale(' + (0.8 + Math.random() * 1.1).toFixed(2) + ')';
      wrap.appendChild(p);
    }
  }

  function showIntro() {
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const overlay = document.createElement('div');
    overlay.className = 'intro-overlay';
    overlay.innerHTML =
      '<div class="intro-sky" aria-hidden="true"></div>' +
      '<div class="intro-particles" aria-hidden="true"></div>';
    const stage = document.createElement('div');
    stage.className = 'intro-stage';
    stage.innerHTML =
      '<div class="intro-season act-1" aria-hidden="true"></div>' +
      '<div class="intro-line act-1"></div>' +
      '<div class="intro-weather act-2">' +
        '<span class="intro-weather-icon"></span>' +
        '<span class="intro-weather-text">天气加载中…</span>' +
      '</div>' +
      '<div class="intro-hint">点击任意处跳过</div>';
    overlay.appendChild(stage);
    document.body.appendChild(overlay);

    const seasonEl = overlay.querySelector('.intro-season');
    const lineEl = overlay.querySelector('.intro-line');
    const weatherEl = overlay.querySelector('.intro-weather');
    const weatherIcon = overlay.querySelector('.intro-weather-icon');
    const weatherText = overlay.querySelector('.intro-weather-text');

    let season = core.seasonForDate(localDateStr(), null);
    let weather = core.weatherText(Number.NaN, 1);
    let place = '';

    overlay.classList.add('sky-' + season.key);
    seasonEl.textContent = season.name;
    lineEl.textContent = season.line;
    if (!reduced) spawnParticles(overlay, season.particle);

    fetchJson('https://ipwho.is/', 4000)
      .then(function (data) {
        if (!data || data.success === false) throw new Error('ip fail');
        const lat = Number(data.latitude);
        if (!isNaN(lat)) {
          season = core.seasonForDate(localDateStr(), lat);
          overlay.classList.remove('sky-spring', 'sky-summer', 'sky-autumn', 'sky-winter');
          overlay.classList.add('sky-' + season.key);
          seasonEl.textContent = season.name;
          lineEl.textContent = season.line;
        }
        place = String(data.city || data.country || '').trim();
        return fetchJson(
          'https://api.open-meteo.com/v1/forecast?latitude=' + data.latitude +
          '&longitude=' + data.longitude +
          '&current=temperature_2m,weather_code,is_day',
          4000
        );
      })
      .then(function (w) {
        if (!w || !w.current) throw new Error('weather fail');
        const cur = w.current;
        weather = core.weatherText(cur.weather_code, cur.is_day);
        weatherIcon.textContent = weather.icon;
        weatherText.innerHTML =
          esc(weather.label) + ' ' + Math.round(cur.temperature_2m) + '°C' +
          (place ? ' · ' + esc(place) : '');
      })
      .catch(function () {
        weatherIcon.textContent = '🌿';
        weatherText.textContent = '天气未知 · 愿花常开';
      });

    let done = false;
    function dismiss() {
      if (done) return;
      done = true;
      overlay.classList.add('is-exit');
      overlay.addEventListener('transitionend', function onEnd(ev) {
        if (ev.propertyName === 'opacity' || ev.propertyName === 'transform') {
          overlay.removeEventListener('transitionend', onEnd);
          overlay.remove();
        }
      });
      window.setTimeout(function () { if (overlay.parentNode) overlay.remove(); }, 900);
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') dismiss();
    }
    overlay.addEventListener('click', dismiss);
    document.addEventListener('keydown', onKey);
    window.setTimeout(dismiss, reduced ? 1600 : 4000);
  }

  showIntro();
})();
