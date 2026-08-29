# OSS 导航（oss.cnp.cc）

GitHub Pages 静态站，已完成自定义域名配置（见 `CNAME`）。

- **根目录 `index.html` 是导航引导页**：只有若干个带常驻阴影的导航按钮，在视口内上下左右双向居中，负责把访问者送到各个子站。
- **列表页已下沉到 `AiPrice/`**。
- **全站静态资源统一放在根目录 `assets/`**（只有一份），各页面按自身层级用相对路径回引。

## 目录结构

```
.
├── CNAME                       # 自定义域名：oss.cnp.cc
├── index.html                  # 导航引导页
├── AiPrice/
│   └── index.html              # 列表页（标签切换 + 悬浮卡片，示例数据内嵌）
├── oss/                        # 其它静态资源（app 下载等）
├── .gitignore                  # 排除 .codebuddy/ .workbuddy/ 等本地产物
└── assets/                     # ★ 全站唯一的静态资源目录
    ├── css/style.css           #   样式：设计令牌 / 悬浮卡片 / 标签切换器 / 引导页 / 响应式
    ├── js/main.js              #   脚本（原生 JS，无第三方依赖），引导页与列表页共用
    └── img/                    #   图片（图标 svg 等）
        └── ai.svg              #     AiPrice 导航按钮的图标
```

> `.codebuddy/` 与 `.workbuddy/` 是本地工具目录，已在 `.gitignore` 中排除，不会推送到 GitHub，也不会发布到 Pages。

### 资源引用规则（按页面层级回上一级）

| 页面 | 引用写法 |
| --- | --- |
| `/index.html`（根目录） | `href="assets/css/style.css"`、`src="assets/js/main.js"` |
| `/AiPrice/index.html`（二级） | `href="../assets/css/style.css"`、`src="../assets/js/main.js"` |
| 若再往下加一层 `/a/b/index.html` | `../../assets/...`，依此类推 |

**新增子目录页面时，只改引用前缀，不要再复制一份 `assets/`** —— 否则改样式要同步多份，迟早不一致。

`assets/css/style.css` 共 10 节，前 9 节是列表页，第 10 节（`.home` 开头）是引导页，两者共用同一套设计令牌与主题变量。

## 导航引导页（根目录 index.html）

| 要点 | 说明 |
| --- | --- |
| 布局 | `body` 为纵向 flex，`.shell` 占满剩余高度并 `align-items:center` + `justify-content:center`，实现上下 + 左右双向居中 |
| 按钮 | `.nav-list` 竖向排列，单个 `.nav-btn` 为「图标 \| 标题+描述 \| 箭头」三段式。**当前只挂了「AiPrice 报价列表」一个入口**，其余后续追加 |
| 阴影 | `--shadow-btn` 常驻（不依赖 hover）；`--shadow-btn-hover` 只在 hover 时再抬高一档并 `translateY(-3px)` |
| 图标底色 | 由 `data-tone="ai\|docker\|brand"` 决定，新增按钮复制一个 `<a class="nav-btn">` 即可 |
| 图标用图 | 格子加 `nav-btn__icon--img`，内部放 `<img class="nav-btn__icon-img" src="assets/img/xx.svg" alt="">`；文字与图片两种写法可混用 |
| 高度适配 | `min-height: 100svh`（移动端按可视高度算，避开地址栏）；`max-height: 520px` 的横屏场景改为顶部对齐并允许滚动 |
| 断点 | ≤ 560px 收紧字号与间距；另适配 `prefers-reduced-motion` 与 `env(safe-area-inset-*)` 安全区 |
| 主题按钮 | 类名 `.theme-fab`（右上角悬浮），**不要**与列表页头部的 `.icon-btn.theme-toggle` 混用；`main.js` 用 `'.theme-toggle, .theme-fab'` 一并选中 |
| 依赖 | 按钮刻意不套 `.reveal`：进场动画依赖 JS，引导按钮一旦脚本未加载就会全部不可见 |

主题偏好与子站共用 `localStorage` 键 `oss-site-theme`，全站一致。

## 列表页（AiPrice/index.html）页面结构

| 区块 | 说明 |
| --- | --- |
| 顶部标签切换 | 全部 / Ai报价 / Docker，激活态是淡色胶囊 + 品牌色粗体字，切换时胶囊滑动 |
| 资源列表 | 单列卡片列表，每行：图标 \| 标题+描述+标签 \| 状态+更新时间 |
| 加载更多 | 从 `main.js` 的 `MORE_ITEMS` 逐批追加 |
| 页脚 | 站点说明 + 导航链接 + 版权 |

## 关于「悬浮卡片」

阴影是**常驻**的，不依赖鼠标悬停。定义在 CSS 变量里：

```css
--shadow-float:        /* 默认：三层柔和阴影，卡片看起来浮在页面上 */
--shadow-float-hover:  /* hover：再抬高一档 + 上移 3px */
```

想调整悬浮感，只改这两个变量即可，不用动 `.item` 的规则。

## 替换为真实内容

1. **改导航按钮**：编辑根目录 `index.html` 的 `.nav-list`，复制 / 删除 `<a class="nav-btn">` 并改 `href` 与 `data-tone` 即可。
2. **改条目**：编辑 `AiPrice/index.html` 中 `.list` 下的 `<article class="item">`，替换图标、标题、描述、标签、状态。
3. **改数据源**：`assets/js/main.js` 中的 `MORE_ITEMS` 是「加载更多」的示例数据。接真实接口时换成 `fetch` 请求，渲染 / 筛选 / 计数 / 加载状态的逻辑不用改。

## 新增条目的两个约定属性

标签切换与搜索完全依赖这两个属性，漏写会导致条目筛不出来：

```html
<article class="item reveal"
         data-cat="ai"
         data-search="deepseek 国产 大模型 低价 错峰 优惠">
```

- `data-cat`：`ai` / `docker`，必须与顶部标签按钮的 `data-cat` 一致
- `data-search`：搜索命中的关键词，建议小写，可包含标题 + 描述要点 + 同义词

新增分类时，顶部加一个 `<button class="tab" data-cat="新值">`，条目里用同样的值即可，JS 无需改动。

## 条目字段说明

```html
<span class="item__icon item__icon--ai">AI</span>   <!-- 图标：--ai / --docker / --note -->
<span class="chip chip--ai">Ai报价</span>            <!-- 标签：--ai / --docker，或默认灰色 -->
<span class="badge badge--new">NEW</span>           <!-- 角标：--new / --hot / --free，或默认 -->
<span class="status status--warn">…</span>          <!-- 状态：默认正常 / --warn / --down -->
```

## 本地预览

```bash
python -m http.server 8000
# 导航引导页 http://127.0.0.1:8000/
# 列表子站   http://127.0.0.1:8000/AiPrice/
```

## 响应式

**列表页（`AiPrice/`）**

| 断点 | 变化 |
| --- | --- |
| ≤ 720px | 顶部改为两行（品牌+工具 / 标签占满整宽）；卡片状态区移到正文下方 |
| ≤ 420px | 标题字号下调，描述放宽到三行 |

**引导页（根目录）**

| 断点 | 变化 |
| --- | --- |
| ≤ 560px | 收紧内边距、字号与图标尺寸 |
| ≤ 520px 高 | 横屏场景：改为顶部对齐并允许滚动，隐藏站点标识 |
| 任意 | `min-height: 100svh` 保证移动端居中不被地址栏顶偏 |

## 顶部标签的一条设计约束（改动前请读）

激活文字的品牌色是**无条件**的：`.tab.is-active { color: var(--c-brand) }` 不带任何
`.is-ready` 前缀，不依赖滑动胶囊是否渲染成功。胶囊（`.tabs__ink`）只是装饰性淡色底。

**不要把激活文字改成白色等浅色。** 一旦文字需要靠胶囊提供对比度，就得同时保证「胶囊一定渲染成功」——
而这个条件由 JS 控制，历史上正是因此出过「激活标签白字压浅底、完全看不见」的 bug。

胶囊的定位仍由 JS 完成，量不到宽度时会保持隐藏（避免错位闪现），此时标签靠品牌色粗体显示，可读性不受影响。

## 其他

- 深色模式：读写 `localStorage` 键 `oss-site-theme`，首次访问跟随系统偏好
- 深色主题下激活文字单独提亮为 `#f08a92`：`--c-brand` 在深底上只有 4.1:1，未达 AA 的 4.5:1
- 标签切换会同步地址栏 hash（`#ai` / `#docker`），可直接分享
- 标签上的数字会随搜索关键词实时变化，表示各分类下的命中数
- 已适配 `prefers-reduced-motion`，开启后关闭滑动与进场动画
- 动态插入的内容做了 HTML 转义；接外部接口时仍建议服务端同步校验
