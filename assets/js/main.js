/* ==========================================================================
 * 站点：oss.cnp.cc —— 资源列表首页交互脚本
 * 路径：assets/js/main.js
 * 依赖：无（原生 ES2015+，不引入任何第三方库）
 *
 * 模块清单（按文件内顺序）：
 *   1. 主题切换（深色 / 浅色，记忆到 localStorage）
 *   2. 列表控制器：顶部标签切换 + 搜索过滤 + 计数（三者共用一套状态）
 *   3. 加载更多（从下方 MORE_ITEMS 数据源逐批追加）
 *   4. 滚动进场动画（IntersectionObserver）
 *   5. 回到顶部
 *   6. 页脚年份
 *
 * 一句话：本文件被「引导页」与「列表页」共用。
 *   引导页（/index.html）没有 #list / #tabs / .to-top，对应模块会自动跳过，
 *   只有主题切换与页脚年份生效 —— 所以各模块开头都有「元素不存在就 return」的守卫，
 *   新增模块时请沿用这个写法。
 *
 * 维护提示：
 *   - 接真实接口时把 MORE_ITEMS 换成 fetch 请求即可，
 *     渲染、筛选、计数、加载状态的逻辑无需改动。
 *   - 新增列表条目时务必写上 data-cat 与 data-search，
 *     否则标签切换与搜索会漏掉该条目（详见 README）。
 * ========================================================================== */

(function () {
  'use strict';

  /* ======================================================================
   * 0. 公共工具
   * ==================================================================== */
  const $  = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

  /** HTML 转义，防止动态数据里的尖括号破坏结构（基础 XSS 防护） */
  const escapeHTML = (str) =>
    String(str).replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[ch]);

  /** 防抖：连续触发时只在最后一次结束后执行 */
  function debounce(fn, wait) {
    let timer = null;
    return function () {
      const args = arguments;
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  /* ======================================================================
   * 1. 主题切换
   *    两个页面的按钮类名不同：列表页是头部里的 .icon-btn.theme-toggle，
   *    引导页是右上角悬浮的 .theme-fab。这里一并选中，谁存在就给谁绑事件。
   * ==================================================================== */
  (function initTheme() {
    const THEME_KEY = 'oss-site-theme';
    const root = document.documentElement;

    const apply = (theme) => {
      root.setAttribute('data-theme', theme);
      try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* 隐私模式下忽略 */ }
    };

    // 优先沿用用户上次选择，其次跟随系统偏好
    let saved = null;
    try { saved = localStorage.getItem(THEME_KEY); } catch (e) { /* noop */ }
    const prefersDark = window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    apply(saved || (prefersDark ? 'dark' : 'light'));

    const btn = $('.theme-toggle, .theme-fab');
    if (btn) {
      btn.addEventListener('click', () => {
        apply(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
      });
    }
  })();

  /* ======================================================================
   * 2. 列表控制器：标签切换 + 搜索 + 计数
   * ==================================================================== */
  const Board = (function () {
    const list = $('#list');
    const tabs = $('#tabs');
    if (!list || !tabs) return null;

    const ink = $('.tabs__ink', tabs);
    const tabBtns = $$('.tab', tabs);
    const emptyBox = $('#list-empty');
    const countEl = $('#board-count');
    const searchInput = $('.search__input');

    // 当前状态：分类 + 关键词（两者是与关系）
    const state = { cat: 'all', keyword: '' };

    /** 读取列表里所有条目（含后续动态追加的） */
    const items = () => $$('.item', list);

    /** 判断单个条目是否匹配当前状态 */
    function match(item) {
      const okCat = state.cat === 'all' || item.dataset.cat === state.cat;
      // 中文无大小写之分，转小写只为兼容英文关键词
      const hay = (item.dataset.search || '').toLowerCase();
      const kw = state.keyword.trim().toLowerCase();
      return okCat && (!kw || hay.indexOf(kw) !== -1);
    }

    /** 重算并刷新：可见性、空状态、计数 */
    function refresh() {
      let visible = 0;
      items().forEach((item) => {
        const show = match(item);
        item.hidden = !show;           // CSS 中 [hidden] 优先级最高
        if (show) visible += 1;
      });

      if (emptyBox) emptyBox.hidden = visible !== 0;
      if (countEl) countEl.textContent = '共 ' + visible + ' 项';

      // 标签上的数字：按当前关键词统计各分类命中数，方便判断该往哪个标签找
      const kw = state.keyword.trim().toLowerCase();
      tabBtns.forEach((btn) => {
        const cat = btn.dataset.cat;
        const n = items().filter((item) => {
          if (cat !== 'all' && item.dataset.cat !== cat) return false;
          if (!kw) return true;
          return (item.dataset.search || '').toLowerCase().indexOf(kw) !== -1;
        }).length;
        const badge = $('.tab__count', btn);
        if (badge) badge.textContent = n;
      });

      // 地址栏同步，方便直接分享 #ai / #docker
      if (history.replaceState) {
        history.replaceState(null, '',
          state.cat === 'all' ? location.pathname + location.search : '#' + state.cat);
      }
    }

    /**
     * 把滑动胶囊移动到指定按钮下方。
     * 返回值表示定位是否成功——量不到宽度时不要让胶囊显形，否则会在
     * 错误位置闪现一块色块。
     *
     * 注意：胶囊只是装饰性底色，激活文字的品牌色由 CSS 的 .tab.is-active
     * 无条件提供。所以这里即使完全失败，也只是没有滑动色块，
     * 激活标签本身依然清晰可读，不会出现「看不见」的情况。
     */
    function moveInk(btn) {
      if (!ink || !btn) return false;
      const w = btn.offsetWidth;
      if (!w) return false;          // 布局尚未完成，宽度不可信
      ink.style.width = w + 'px';
      ink.style.transform = 'translateX(' + btn.offsetLeft + 'px)';
      return true;
    }

    /** 定位成功后才让胶囊显形；失败时静默跳过，不影响标签可读性 */
    function enableInk() {
      if (!ink || tabs.classList.contains('is-ready')) return;
      tabs.classList.add('is-ready');
    }

    /** 横向滚动容器时，让当前标签尽量居中可见 */
    function revealTab(btn) {
      if (!btn) return;
      const target = btn.offsetLeft - (tabs.clientWidth - btn.offsetWidth) / 2;
      if (tabs.scrollTo) tabs.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
    }

    /** 切换到某个分类 */
    function select(cat, opts) {
      const btn = tabBtns.find((t) => t.dataset.cat === cat) || tabBtns[0];
      state.cat = btn.dataset.cat;

      tabBtns.forEach((t) => {
        const on = t === btn;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', String(on));
      });

      if (moveInk(btn)) enableInk();   // 定位成功才切到胶囊样式
      if (opts && opts.scroll) revealTab(btn);
      refresh();
    }

    // 初始化：先按 DOM 定位胶囊，成功之后才让它显形，避免从错误位置滑入。
    // 定位失败（宽度算不出来）时胶囊保持隐藏，激活标签靠 CSS 的品牌色粗体显示。
    (function init() {
      const current = tabBtns.find((t) => t.classList.contains('is-active')) || tabBtns[0];

      // 首次定位关掉过渡，否则胶囊会从左上角滑到目标位置
      tabs.classList.add('no-anim');
      const ok = moveInk(current);

      if (ok) {
        requestAnimationFrame(() => {
          enableInk();
          // 下一帧再恢复过渡，让后续切换有滑动效果
          requestAnimationFrame(() => tabs.classList.remove('no-anim'));
        });
      } else {
        tabs.classList.remove('no-anim');
      }

      tabBtns.forEach((btn) => {
        btn.addEventListener('click', () => select(btn.dataset.cat, { scroll: true }));
      });

      if (searchInput) {
        searchInput.addEventListener('input', debounce(() => {
          state.keyword = searchInput.value;
          refresh();
        }, 200));
      }

      // 尺寸变化与字体加载都会让胶囊位置失效，需要重算
      const reposition = () => {
        const active = tabBtns.find((t) => t.classList.contains('is-active'));
        if (moveInk(active)) enableInk();   // 首次失败的话，这里补一次
      };

      window.addEventListener('resize', debounce(reposition, 150));
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(reposition);

      // 支持通过 #docker 这样的锚点直接进入对应标签
      const hash = location.hash.replace('#', '');
      select(hash && tabBtns.some((t) => t.dataset.cat === hash) ? hash : 'all');
    })();

    return { refresh: refresh, state: state };
  })();

  /* ======================================================================
   * 3. 加载更多
   *    新条目会带上 data-cat / data-search，因此自动被标签与搜索接管。
   * ==================================================================== */
  const MORE_ITEMS = [
    {
      cat: 'ai', icon: 'GLM', iconType: 'ai',
      title: '智谱 GLM / 豆包 / 文心 报价横评',
      desc: '三家国产模型在输入输出单价、上下文长度与并发限制上的横向对比，附同等预算下的可用 token 量测算。',
      chips: ['Ai报价', '三家横评', '并发限制'],
      status: '正常', statusType: '', time: '更新于 6 天前',
      search: '智谱 glm 豆包 文心 国产 模型 横评 并发'
    },
    {
      cat: 'ai', icon: '中转', iconType: 'note',
      title: 'API 聚合中转价格对比',
      desc: '主流中转服务相对官方价格的加价幅度、可用性表现与结算方式差异，含自建网关的成本参考。',
      chips: ['Ai报价', '中转服务', '成本参考'],
      status: '价格波动', statusType: 'warn', time: '更新于 8 天前',
      search: 'api 中转 聚合 网关 加价 自建 成本'
    },
    {
      cat: 'docker', icon: '自建', iconType: 'note',
      title: '自建 Registry 镜像加速',
      desc: '用 registry:2 搭建本地缓存仓库的完整流程，含存储后端选择、垃圾回收与 HTTPS 证书配置。',
      chips: ['Docker', 'registry:2', '垃圾回收'],
      status: '正常', statusType: '', time: '更新于 3 天前',
      search: '自建 registry 缓存 仓库 垃圾回收 https 证书'
    },
    {
      cat: 'docker', icon: '测速', iconType: 'docker',
      title: '镜像源可用性与拉取测速',
      desc: '定时探测各加速节点的连通性与首字节耗时，按地域给出推荐顺序，异常节点自动降权。',
      chips: ['Docker', '定时探测', '地域推荐'],
      status: '维护中', statusType: 'down', time: '更新于 9 天前',
      search: '镜像源 测速 可用性 探测 节点 地域 降权'
    }
  ];

  (function initLoadMore() {
    const list = $('#list');
    const btn = $('#load-more');
    const tip = $('#load-tip');
    if (!list || !btn) return;

    let cursor = 0;
    const PAGE_SIZE = 2;

    function itemHTML(it) {
      return `
        <article class="item reveal" data-cat="${it.cat}"
                 data-search="${escapeHTML(it.search)}">
          <span class="item__icon item__icon--${it.iconType}">${escapeHTML(it.icon)}</span>
          <div class="item__body">
            <h2 class="item__title">${escapeHTML(it.title)}</h2>
            <p class="item__desc">${escapeHTML(it.desc)}</p>
            <div class="item__meta">
              ${it.chips.map((c, i) =>
                `<span class="chip${i === 0 ? ' chip--' + it.cat : ''}">${escapeHTML(c)}</span>`
              ).join('')}
            </div>
          </div>
          <div class="item__side">
            <span class="status${it.statusType ? ' status--' + it.statusType : ''}">
              <i class="status__dot"></i>${escapeHTML(it.status)}
            </span>
            <span class="item__time">${escapeHTML(it.time)}</span>
            <span class="item__go">查看 →</span>
          </div>
        </article>`;
    }

    btn.addEventListener('click', () => {
      if (cursor >= MORE_ITEMS.length) return;

      // 模拟请求耗时（接真实接口时改为 await fetch）
      btn.classList.add('is-loading');
      btn.disabled = true;

      setTimeout(() => {
        const slice = MORE_ITEMS.slice(cursor, cursor + PAGE_SIZE);
        list.insertAdjacentHTML('beforeend', slice.map(itemHTML).join(''));

        // 新节点也要有进场动画
        observeReveal($$('.item.reveal:not(.is-in)', list));

        cursor += slice.length;
        btn.classList.remove('is-loading');
        btn.disabled = false;

        // 追加后重算计数、标签数字与当前筛选的可见性
        if (Board) Board.refresh();

        if (cursor >= MORE_ITEMS.length) {
          btn.hidden = true;
          if (tip) {
            tip.hidden = false;
            tip.textContent = '已经到底啦，已加载全部 ' + MORE_ITEMS.length + ' 条额外资源';
          }
        }
      }, 400);
    });
  })();

  /* ======================================================================
   * 4. 滚动进场动画
   * ==================================================================== */
  let revealObserver = null;

  if ('IntersectionObserver' in window) {
    revealObserver = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          obs.unobserve(entry.target);      // 只播放一次
        }
      });
    }, { threshold: 0.06, rootMargin: '0px 0px -30px 0px' });
  }

  /** 对一组元素启用进场观察；不支持时直接显示，避免内容永远不可见 */
  function observeReveal(nodes) {
    (nodes || []).forEach((el, i) => {
      if (!revealObserver) { el.classList.add('is-in'); return; }
      el.style.transitionDelay = Math.min(i * 55, 280) + 'ms';   // 轻微错峰
      revealObserver.observe(el);
    });
  }

  observeReveal($$('.reveal'));

  /* ======================================================================
   * 5. 回到顶部
   * ==================================================================== */
  (function initToTop() {
    const btn = $('.to-top');
    if (!btn) return;

    const onScroll = () => {
      btn.classList.toggle('is-visible', window.scrollY > window.innerHeight * 0.8);
    };

    window.addEventListener('scroll', debounce(onScroll, 100), { passive: true });
    onScroll();

    btn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  })();

  /* ======================================================================
   * 6. 页脚年份
   * ==================================================================== */
  (function initYear() {
    const el = $('#year');
    if (el) el.textContent = new Date().getFullYear();
  })();

})();
