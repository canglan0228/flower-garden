import { test } from 'node:test';
import assert from 'node:assert/strict';

await import('../js/core.js');
const core = globalThis.FlowerCore;

const flowers = [
  {
    id: 'rosa-rugosa',
    name: '玫瑰',
    en: 'Rose',
    latin: 'Rosa rugosa',
    family: '蔷薇科',
    colors: ['红', '粉', '白'],
    aliases: ['刺玫'],
    meaning: '热烈的爱',
    season: '春夏',
    blurb: '带刺而温柔，爱情的象征。',
    morph: '落叶灌木，枝干带刺，花朵单瓣或重瓣，色分红、粉、白。',
    culture: '西方文化中象征爱情与浪漫，常用于婚礼与告白。',
    care: '原产亚洲，喜光耐寒，栽培需通风透光。'
  },
  {
    id: 'tulipa-gesneriana',
    name: '郁金香',
    en: 'Tulip',
    latin: 'Tulipa gesneriana',
    family: '百合科',
    colors: ['红', '黄', '紫', '粉'],
    aliases: ['洋荷花'],
    meaning: '博爱与祝福',
    season: '春',
    blurb: '荷兰国花，色彩明丽。',
    morph: '鳞茎草本，花杯状单生，色彩极为丰富。',
    culture: '荷兰国花，象征博爱与祝福。',
    care: '原产中亚，喜冷凉气候，球根需低温春化。'
  },
  {
    id: 'lavandula-angustifolia',
    name: '薰衣草',
    en: 'Lavender',
    latin: 'Lavandula angustifolia',
    family: '唇形科',
    colors: ['紫'],
    aliases: ['香水草'],
    meaning: '等待爱情',
    season: '夏',
    blurb: '紫色花海，香气安宁。',
    morph: '常绿小灌木，穗状花序，花朵蓝紫色。',
    culture: '常与「等待爱情」的浪漫故事联系在一起。',
    care: '原产地中海沿岸，喜干燥阳光，忌积水。'
  },
  {
    id: 'nelumbo-nucifera',
    name: '荷花',
    en: 'Lotus',
    latin: 'Nelumbo nucifera',
    family: '莲科',
    colors: ['粉', '白'],
    aliases: ['莲花'],
    meaning: '纯洁高雅',
    season: '夏',
    blurb: '出淤泥而不染。',
    morph: '多年生水生草本，叶盾形，花大色艳。',
    culture: '「出淤泥而不染」出自周敦颐《爱莲说》。',
    care: '中国南北广布，喜温暖水湿环境。'
  }
];

test('dailyIndex 同一天返回同一索引且在范围内', () => {
  const a = core.dailyIndex(flowers, '2026-08-16');
  const b = core.dailyIndex(flowers, '2026-08-16');
  assert.equal(a, b);
  assert.ok(a >= 0 && a < flowers.length);
});

test('dailyIndex 连续一百天至少出现三个不同索引（每日更换）', () => {
  const seen = new Set();
  const start = Date.UTC(2026, 0, 1);
  for (let i = 0; i < 100; i++) {
    const d = new Date(start + i * 86400000).toISOString().slice(0, 10);
    seen.add(core.dailyIndex(flowers, d));
  }
  assert.ok(seen.size >= 3, `only saw ${seen.size} distinct indices`);
});

test('dailyIndex 空列表返回 -1', () => {
  assert.equal(core.dailyIndex([], '2026-08-16'), -1);
});

test('randomIndex 返回与当前不同的合法索引', () => {
  const next = core.randomIndex(flowers, 0);
  assert.ok(next >= 0 && next < flowers.length);
  assert.notEqual(next, 0);
});

test('randomIndex 单花列表只能返回 0', () => {
  assert.equal(core.randomIndex([flowers[0]], 0), 0);
});

test('searchFlowers 按中文名命中', () => {
  assert.equal(core.searchFlowers(flowers, '玫瑰').length, 1);
});

test('searchFlowers 按学名大小写不敏感命中', () => {
  assert.equal(core.searchFlowers(flowers, 'ROSA').length, 1);
  assert.equal(core.searchFlowers(flowers, 'lavandula').length, 1);
});

test('searchFlowers 按花语与颜色命中', () => {
  assert.equal(core.searchFlowers(flowers, '等待爱情').length, 1);
  assert.equal(core.searchFlowers(flowers, '紫').length, 2);
});

test('searchFlowers 可命中形态特征、文化典故与养护内容', () => {
  assert.equal(core.searchFlowers(flowers, '爱莲说').length, 1);
  assert.equal(core.searchFlowers(flowers, '通风透光').length, 1);
  assert.equal(core.searchFlowers(flowers, '鳞茎').length, 1);
});

test('searchFlowers 空查询返回全部', () => {
  assert.equal(core.searchFlowers(flowers, '').length, flowers.length);
});

test('searchFlowers 无结果返回空数组', () => {
  assert.deepEqual(core.searchFlowers(flowers, '不存在的花'), []);
});

test('applyFilters 组合查询、颜色与季节筛选', () => {
  const filtered = core.applyFilters(flowers, { query: '', color: '紫', season: '夏' });
  assert.deepEqual(filtered.map((f) => f.id), ['lavandula-angustifolia']);
});

test('applyFilters 按中文名称排序', () => {
  const sorted = core.applyFilters(flowers, { sort: 'name' });
  assert.deepEqual(
    sorted.map((f) => f.name),
    ['荷花', '玫瑰', '薰衣草', '郁金香']
  );
});

test('parseHash 解析各路由', () => {
  assert.deepEqual(core.parseHash('#/flower/rosa-rugosa'), { route: 'flower', id: 'rosa-rugosa' });
  assert.deepEqual(core.parseHash('#/explore'), { route: 'explore', id: null });
  assert.deepEqual(core.parseHash('#/today'), { route: 'today', id: null });
  assert.deepEqual(core.parseHash('#/explore?color=%E7%BA%A2'), { route: 'explore', id: null });
  assert.deepEqual(core.parseHash('#/explore?color=%E7%BA%A2&season=%E5%A4%8F'), { route: 'explore', id: null });
  assert.deepEqual(core.parseHash('#/flower/rosa-rugosa?from=home'), { route: 'flower', id: 'rosa-rugosa' });
  assert.deepEqual(core.parseHash('#/'), { route: 'home', id: null });
  assert.deepEqual(core.parseHash(''), { route: 'home', id: null });
});

test('slugify 生成稳定 id', () => {
  assert.equal(core.slugify('Rosa rugosa'), 'rosa-rugosa');
  assert.equal(core.slugify('Cymbidium goeringii'), 'cymbidium-goeringii');
});

test('seasonTags 从花期文本提取季节', () => {
  assert.deepEqual(core.seasonTags('春夏'), ['春', '夏']);
  assert.deepEqual(core.seasonTags('5-8月'), []);
});

test('relatedFlowers 优先同科属或同色并排除自身', () => {
  const related = core.relatedFlowers(flowers, flowers[0], 2);
  assert.ok(!related.some((f) => f.id === 'rosa-rugosa'));
  assert.ok(related.length <= 2);
  assert.ok(related.some((f) => f.colors.includes('红') || f.family === '蔷薇科'));
});
