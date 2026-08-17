# 花语花园

一个清新治愈的静态花卉网站：收录中外常见花卉，每天固定展示一朵「今日之花」，支持按名称/学名/花语搜索、按颜色与花期筛选，每朵花都配有真实照片、花语资料与小故事。

## 功能

- 每日一花：按日期稳定生成，每天更换，可点「换一朵」随机浏览
- 今日之花页：独立页面完整展示当日花朵的形态、花语与文化、分布与养护，可一键查看详情
- 花大全：全文搜索（中文名、别名、学名、花语、颜色）、颜色/季节筛选、排序
- 详情页：大图、花语、小故事（动漫/影视/游戏/传说出处，30 种常见花为 300-400 字三段式）、形态特征/花语与文化/分布与养护三大板块、科属资料、来源标注、相关推荐，带柔和入场动画
- 动漫风背景：内置 6 张 Pixabay 动漫风花卉/风景插画，右下角按钮一键切换，Wallpaper Engine 式淡入淡出转场（旧图亮出 → 交叉溶解 → 新图沉降），选择记忆在浏览器
- 季节天气开场：每次打开网站先展示约 5.5 秒的分幕式「季节 + 当地天气」开场动画（大字季节 → 天气实景特效 → 天气卡片 → 柔和淡出；晴有太阳光晕、阴天飘云、雾天起雾、大雨飘雨、下雪飘雪、雷暴闪雷；按访客自己 IP 定位展示所在城市天气），单击/双击/空格均可跳过，断网自动降级
- 虚拟养花：右上角导航新增入口，占位页展示「正在建设中 · 敬请期待」
- 视觉：奶油白 + 淡粉 + 鼠尾草绿，圆润卡片、柔和光影、响应式、支持减少动效
- 离线可用：双击 `index.html` 即可打开，无需服务器

## 项目结构

```
index.html              单页应用入口
styles.css              奶油治愈风样式
js/core.js              核心逻辑（今日之花、搜索、筛选、路由解析）
js/app.js               页面渲染与交互
data/flowers.js         花卉数据（由脚本生成，浏览器直接加载）
data/image-meta.json    图片来源元数据（生成物）
images/                 本地化后的真实花朵图片
seed/flowers.tsv        种子清单（约 390 种：名称/学名/科/颜色/花语/花期/简介/形态/文化/养护/小故事）
seed/stories.tsv        小故事作者稿（中文名 → 100-150 字故事），由脚本合并进 flowers.tsv
seed/story-fixes-*.tsv  小故事补长稿（追加句），由脚本合并进 stories.tsv
backgrounds/            动漫风背景图（Pixabay，WebP）
scripts/fetch-inat.mjs     混合图源抓取（iNaturalist 主 → ppbc 补漏 → fpcn）
scripts/ppbc-worker.py     ppbc 中国植物图像库浏览器抓取 worker（Scrapling）
scripts/lib/seed.mjs       种子清单解析等共享工具
scripts/fetch-flowers.mjs  （备用）Wikimedia Commons 抓取
scripts/apply-story-fixes.mjs  把补长稿合并进 stories.tsv
scripts/apply-story-rewrites.mjs  把 30 种常见花的扩写稿整段替换进 stories.tsv
scripts/merge-stories.mjs      把 stories.tsv 合并进 flowers.tsv 的第 13 列
scripts/replace-story-tails.mjs  用新尾句替换 stories.tsv 中重复/冗余的末句（配合 seed/story-tail-fixes.tsv）
scripts/make-backgrounds.mjs   把源图压缩为 backgrounds/*.webp
scripts/build-data.mjs     生成 data/flowers.js
scripts/check-data.mjs     数据完整性校验
scripts/serve.mjs          本地静态服务器
test/core.test.mjs         核心逻辑单元测试
```

## 本地运行

```bash
npm install          # 安装 sharp（图片压缩）
npm run serve        # 打开 http://localhost:4173
```

也可以直接双击 `index.html` 离线打开。

## 重新抓取与构建数据

```bash
npm run fetch:inat   # 联网抓图（iNaturalist 并发 → ppbc 补漏 → fpcn 兜底）
npm run build        # 生成 data/flowers.js
npm run check        # 校验数据完整性
npm test             # 核心逻辑单元测试
```

修改小故事后按顺序重建数据：

```bash
node scripts/apply-story-fixes.mjs   # 若改了 seed/story-fixes-*.tsv
node scripts/merge-stories.mjs       # 合并进 seed/flowers.tsv
npm run build && npm run check
```

抓取顺序：

1. iNaturalist：按学名/中文名/别名匹配分类单元，取带 CC 许可的真实照片（10 并发）
2. ppbc 中国植物图像库：用 Scrapling 无头浏览器搜索，只取首条匹配结果，逐朵限速 1 秒，图片 CDN 直接下载
3. fpcn.net 花卉图片网：按中文名检索文章并核对学名后取图

每条结果都做学名/中文名校验，避免张冠李戴；失败条目记录在 `data/missing.json`，构建时若存在未配图花卉会直接失败，确保交付 100% 配图。图片统一压缩为 WebP（单张约 100-200KB）。需要分段运行时可用环境变量 `PPBC_SKIP=1`（只跑 iNaturalist）或 `INAT_SKIP=1`（只跑 ppbc 补漏）。

## 部署

静态目录可直接部署到任意静态托管平台：

- GitHub Pages：把整个目录推送到仓库，开启 Pages 并选择根目录
- Vercel / Netlify：导入仓库，构建命令留空，输出目录选根目录

所有页面依赖都在项目内，无外部 CDN，离线亦可运行。

## 图片来源与许可

图片来自多个公开图源，每朵花的详情页均标注作者、许可协议与来源链接：

- [iNaturalist](https://www.inaturalist.org/)：CC0 / CC BY / CC BY-SA / CC BY-NC 等许可
- [ppbc.iplant.cn](https://ppbc.iplant.cn/)（中国植物图像库）：个人娱乐授权使用，脚本已按站点要求限速并只取首条结果
- [fpcn.net](https://www.fpcn.net/)（花卉图片网）：公开网络图片

网站背景插画来自 [Pixabay](https://pixabay.com/)，适用 [Pixabay Content License](https://pixabay.com/service/license-summary/)（可免费商用、无需署名、允许修改），对应页面：

- 樱落小径（粉色富士山樱花）https://pixabay.com/illustrations/anime-sakura-flowers-beach-water-8562951/
- 紫花春树（紫红花树插画）https://pixabay.com/illustrations/pink-blossom-tree-cartoon-tree-9686526/
- 初夏晴空（夏日蓝天白云）https://pixabay.com/illustrations/anime-style-road-sky-clouds-9412279/
- 花田远山（花田雪山插画）https://pixabay.com/illustrations/flower-nature-meadow-landscape-9514615/
- 秋雪星野（秋树雪景星空）https://pixabay.com/illustrations/anime-landscape-wallpaper-nature-9426874/
- 冬雪暖灯（冬雪庭院暖灯）https://pixabay.com/illustrations/anime-winter-snow-bicycle-puddle-10244543/

开场动画的天气数据来自 [ipwho.is](https://ipwho.is/) 与 [Open-Meteo](https://open-meteo.com/)（免费、无需 Key），仅在开场层短暂展示。

新增花卉时请在种子清单 `seed/flowers.tsv` 中补充学名、中文名、科属、颜色、花语、花期与简介，再运行抓取脚本。
