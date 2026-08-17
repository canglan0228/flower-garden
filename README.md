# 花语花园

一个清新治愈的静态花卉网站：收录中外常见花卉，每天固定展示一朵「今日之花」，支持按名称/学名/花语搜索、按颜色与花期筛选，每朵花都配有真实照片与花语资料。

## 功能

- 每日一花：按日期稳定生成，每天更换，可点「换一朵」随机浏览
- 今日之花页：独立页面完整展示当日花朵的形态、花语与文化、分布与养护，可一键查看详情
- 花大全：全文搜索（中文名、别名、学名、花语、颜色）、颜色/季节筛选、排序
- 详情页：大图、花语、形态特征/花语与文化/分布与养护三大板块、科属资料、来源标注、相关推荐，带柔和入场动画
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
seed/flowers.tsv        种子清单（约 390 种：名称/学名/科/颜色/花语/花期/简介）
scripts/fetch-inat.mjs     混合图源抓取（iNaturalist 主 → ppbc 补漏 → fpcn）
scripts/ppbc-worker.py     ppbc 中国植物图像库浏览器抓取 worker（Scrapling）
scripts/lib/seed.mjs       种子清单解析等共享工具
scripts/fetch-flowers.mjs  （备用）Wikimedia Commons 抓取
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

新增花卉时请在种子清单 `seed/flowers.tsv` 中补充学名、中文名、科属、颜色、花语、花期与简介，再运行抓取脚本。
