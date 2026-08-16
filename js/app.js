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
        '<section class="hero">' +
          '<div class="hero-copy fade-up">' +
            '<span class="eyebrow">' + svgIcon('calendar') + '每日一花 · ' + esc(formatDateCN(todayStr)) + '</span>' +
            '<h1 class="hero-title">' + esc(hero.name) + '</h1>' +
            '<div class="hero-latin">' + esc(hero.latin) + '</div>' +
            '<div class="hero-meaning">花语 · ' + esc(hero.meaning) + '</div>' +
            '<p class="hero-blurb">' + esc(hero.blurb) + '</p>' +
            '<div class="hero-actions">' +
              '<a class="btn btn-primary" href="#/flower/' + encodeURIComponent(hero.id) + '">查看详情</a>' +
              '<button class="btn btn-ghost" data-action="shuffle">' + svgIcon('shuffle') + '换一朵</button>' +
            '</div>' +
            '<div class="hero-tags">' + tagHtml(hero) + '</div>' +
          '</div>' +
          '<div class="hero-art fade-up" id="hero-art" style="animation-delay:.08s">' +
            '<span class="hero-leaf hero-leaf-one" aria-hidden="true"></span>' +
            '<span class="hero-leaf hero-leaf-two" aria-hidden="true"></span>' +
            '<div class="hero-frame">' +
              '<img data-img alt="' + esc(hero.name) + '的图片" src="' + esc(hero.image) + '">' +
              '<span class="shimmer" aria-hidden="true"></span>' +
              '<span class="hero-badge">' + svgIcon('calendar') + '今日之花</span>' +
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

  function renderHeroOnly(hero) {
    const art = document.getElementById('hero-art');
    if (!art) return;
    const frame = art.querySelector('.hero-frame');
    frame.innerHTML =
      '<img data-img alt="' + esc(hero.name) + '的图片" src="' + esc(hero.image) + '">' +
      '<span class="shimmer" aria-hidden="true"></span>' +
      '<span class="hero-badge">' + svgIcon('calendar') + '今日之花</span>';
    bindImages(art);
    const copy = document.querySelector('.hero-copy');
    if (copy) {
      copy.classList.remove('fade-up');
      void copy.offsetWidth;
      copy.classList.add('fade-up');
    }
    copy.querySelector('.hero-title').textContent = hero.name;
    copy.querySelector('.hero-latin').textContent = hero.latin;
    copy.querySelector('.hero-meaning').textContent = '花语 · ' + hero.meaning;
    copy.querySelector('.hero-blurb').textContent = hero.blurb;
    copy.querySelector('.btn-primary').setAttribute('href', '#/flower/' + encodeURIComponent(hero.id));
    copy.querySelector('.hero-tags').innerHTML = tagHtml(hero);
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

    app.innerHTML =
      '<div class="container">' +
        '<div class="detail fade-in">' +
          '<a class="detail-back" href="#/explore">' + svgIcon('left') + '返回花大全</a>' +
          '<div class="detail-layout">' +
            '<div class="detail-media">' +
              '<img data-img alt="' + esc(f.name) + '的图片" src="' + esc(f.image) + '">' +
              '<span class="shimmer" aria-hidden="true"></span>' +
            '</div>' +
            '<div class="detail-copy">' +
              '<h1 class="detail-name">' + esc(f.name) + '</h1>' +
              '<div class="detail-latin">' + esc(f.latin) + (f.en ? ' · ' + esc(f.en) : '') + '</div>' +
              '<div class="detail-meaning">' + esc(f.meaning) + '</div>' +
              '<p class="detail-blurb">' + esc(f.blurb) + '</p>' +
              '<div class="detail-facts">' + facts + '</div>' +
              '<div class="detail-credit">' +
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
      else renderHome();
      window.scrollTo(0, 0);
    }
    setNav(r.route);
  }

  /* ---------- 事件 ---------- */
  document.addEventListener('click', function (e) {
    const shuffleBtn = e.target.closest('[data-action="shuffle"]');
    if (shuffleBtn) {
      e.preventDefault();
      const currentIdx = FLOWERS.findIndex(function (f) { return f.id === state.heroId; });
      const nextIdx = core.randomIndex(FLOWERS, currentIdx);
      state.heroId = FLOWERS[nextIdx].id;
      renderHeroOnly(FLOWERS[nextIdx]);
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
})();
