(function () {
  'use strict';

  // 获取 DOM 元素
  const seriesContainer = document.getElementById('seriesContainer');
  const categoryList = document.getElementById('categoryList');
  const searchInput = document.getElementById('searchInput');
  const sidebar = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const threeDotsBtn = document.getElementById('threeDotsBtn');
  
  const modalOverlay = document.getElementById('modalOverlay');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalTitle = document.getElementById('modalTitle');
  const modalId = document.getElementById('modalId');
  const modalStats = document.getElementById('modalStats'); 
  const modalDesc = document.getElementById('modalDesc');
  const toast = document.getElementById('toast');

  // 全局状态变量
  let itemDatabase = [];
  let allCategories = [];
  const BATCH_SIZE = 60; 
  
  let currentFilteredItems = []; 
  let renderIndex = 0;           
  let currentCategory = 'all';   
  let currentSearch = '';        
  let observer = null;

  // 工具函数：防 XSS 注入
  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // 工具函数：显示提示
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
  }

  // 工具函数：复制文本
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => showToast('已复制: ' + text));
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "absolute";
      textArea.style.left = "-999999px";
      document.body.prepend(textArea);
      textArea.select();
      try { document.execCommand('copy'); showToast('已复制: ' + text); } 
      catch (error) { showToast('复制失败'); }
      textArea.remove();
    }
  }

  // 工具函数：解析游戏内富文本 (最终完美版)
  function parseRichText(text) {
    if (!text) return '暂无描述';
    let html = escapeHtml(text);
    
    // 1. 强行把文本里原本就有的 \n 转成换行
    html = html.replace(/\\n/g, '<br>');
    
    // 2. 精确匹配：所有的纯小写 #r 必定是换行符 (Return)
    html = html.replace(/#r/g, '<br>');
    
    // 3. 智能过滤被和谐的星号色号：
    // 比如匹配到 #c0a******* 就直接删掉这一截，防止它乱染色
    html = html.replace(/#c[0-9a-fA-F]{0,6}\*+/g, '');
    
    // 4. 解析正常的原生 #c 色号 (此时剩下的都是纯净色号了)
    html = html.replace(/#c([0-9a-fA-F]{6}|[0-9a-fA-F]{3})/g, '<span style="color:#$1">');
    
    // 5. 解析单字母颜色代码
    // 如果游戏里真的有把 #R 当红色的，放在这处理（因为换行符 #r 已经被处理干净了）
    html = html.replace(/#R/g, '<span style="color:#e53935">'); // 红
    html = html.replace(/#G/g, '<span style="color:#43a047">'); // 绿
    html = html.replace(/#B/g, '<span style="color:#1e88e5">'); // 蓝
    html = html.replace(/#K/g, '<span style="color:#222222">'); // 黑
    html = html.replace(/#W/g, '<span style="color:#ffffff; text-shadow: 0 0 2px #999, 0 0 2px #999;">'); // 白
    html = html.replace(/#N/g, '<span class="rainbow-text">'); // 幻彩
    
    // 6. 解析颜色结束符 #n
    html = html.replace(/#n/g, '</span>');
    
    // 7. 解析道具跳转标记 @item_xxx#
    html = html.replace(/@item_(\d+)#/g, (match, id) => {
      const target = itemDatabase.find(i => i.id === id);
      const name = target ? target.name : `未知(${id})`;
      return `<span class="item-link" data-jump-id="${id}">${name}</span>`;
    });
    
    // 8. 修复颜色标签未闭合问题，防止样式崩塌
    const open = (html.match(/<span[^>]*>/g) || []).length;
    const close = (html.match(/<\/span>/g) || []).length;
    if (open > close) html += '</span>'.repeat(open - close);
    
    return html;
  }

  // ==================== 核心：数据加载与合并 ====================
  async function loadData() {
    try {
      const [resAll, resWiki] = await Promise.all([
        fetch('all.json', { cache: 'no-cache' }),
        fetch('wiki.json', { cache: 'no-cache' })
      ]);

      if (!resAll.ok) throw new Error('all.json 加载失败');
      
      let textAll = await resAll.text();
      let textWiki = resWiki.ok ? await resWiki.text() : '{}';

      // 自动跳过第一行的 {"retcode":0...} 状态码
      const allStartIdx = textAll.indexOf('{\n');
      if (allStartIdx !== -1) textAll = textAll.substring(allStartIdx);
      
      const wikiStartIdx = textWiki.indexOf('{\n');
      if (wikiStartIdx !== -1) textWiki = textWiki.substring(wikiStartIdx);

      const jsonAll = JSON.parse(textAll);
      let wikiMap = {};
      
      try {
        const jsonWiki = JSON.parse(textWiki);
        if (jsonWiki.data && Array.isArray(jsonWiki.data)) {
          jsonWiki.data.forEach(w => {
            wikiMap[String(w.id)] = w;
          });
        }
      } catch (e) {
        console.warn('wiki.json 解析失败', e);
      }

      const list = [];
      const catMap = {};

      Object.keys(jsonAll).forEach(cat => {
        const group = jsonAll[cat];
        if (!group || !Array.isArray(group.data)) return;
        catMap[cat] = group.data.length;

        group.data.forEach(item => {
          const idStr = String(item['道具ID'] ?? '');
          
          const obj = {
            name: item['道具名称'] ?? '',
            id: idStr,
            desc: item['描述'] ?? '',
            attack: Number(item['攻击力']) || 0,
            stack: item['堆叠上限'] ?? 0,
            category: cat 
          };

          // 仅“道具”分类合并 wiki 里的高级防御数据
          if (cat === '道具' && wikiMap[idStr]) {
            const wikiData = wikiMap[idStr];
            obj.meleeDef = Number(wikiData.meleeDef) || 0;
            obj.rangedDef = Number(wikiData.rangedDef) || 0;
            obj.explodeDef = Number(wikiData.explodeDef) || 0;
            obj.fireDef = Number(wikiData.fireDef) || 0;
            obj.poisonDef = Number(wikiData.poisonDef) || 0;
            obj.chaosDef = Number(wikiData.chaosDef) || 0;
            obj.durability = Number(wikiData.durability) || 0;
            obj.shootInterval = Number(wikiData.shootInterval) || 0;
            obj.magazine = Number(wikiData.magazine) || 0;
          }

          list.push(obj);
        });
      });

      itemDatabase = list;
      allCategories = Object.keys(catMap).map(k => ({ name: k, count: catMap[k] }));
      
      renderCategories();
      applyFilter();
    } catch (err) {
      console.error(err);
      seriesContainer.innerHTML = `<div class="loading">加载失败：${escapeHtml(err.message)}</div>`;
    }
  }

  // ==================== 渲染分类栏 ====================
  function renderCategories() {
    let html = `<div class="category-item active" data-category="all"><span>📋 全部条目</span><span>${itemDatabase.length}</span></div>`;
    allCategories.forEach(cat => {
      html += `<div class="category-item" data-category="${escapeHtml(cat.name)}"><span>📦 ${escapeHtml(cat.name)}</span><span>${cat.count}</span></div>`;
    });
    categoryList.innerHTML = html;

    document.querySelectorAll('.category-item').forEach(el => {
      el.addEventListener('click', function () {
        document.querySelectorAll('.category-item').forEach(i => i.classList.remove('active'));
        this.classList.add('active');
        currentCategory = this.getAttribute('data-category');
        applyFilter();
        if (window.innerWidth <= 750) closeSidebar();
      });
    });
  }

  // ==================== 应用筛选与搜索 ====================
  function applyFilter() {
    currentFilteredItems = itemDatabase.filter(item => {
      const matchCat = (currentCategory === 'all' || item.category === currentCategory);
      const matchSearch = (!currentSearch || item.name.toLowerCase().includes(currentSearch) || item.id.includes(currentSearch));
      return matchCat && matchSearch;
    });

    // 精准搜索 ID 时优先排序
    if (currentSearch && /^\d+$/.test(currentSearch)) {
      currentFilteredItems.sort((a, b) => (a.id === currentSearch ? -1 : 1));
    }

    seriesContainer.innerHTML = '';
    renderIndex = 0;
    if (observer) {
      observer.disconnect();
      observer = null;
    }

    if (currentFilteredItems.length === 0) {
      seriesContainer.innerHTML = '<div class="loading">没有找到匹配的条目</div>';
      return;
    }
    renderBatch();
  }

  // ==================== 分批渲染（懒加载） ====================
  function renderBatch() {
    const oldTrigger = document.getElementById('load-more-trigger');
    if (oldTrigger) oldTrigger.remove();

    const batchItems = currentFilteredItems.slice(renderIndex, renderIndex + BATCH_SIZE);
    const grouped = {};
    batchItems.forEach(item => {
      if (!grouped[item.category]) grouped[item.category] = [];
      grouped[item.category].push(item);
    });

    for (const [cat, catItems] of Object.entries(grouped)) {
      const existingBlock = seriesContainer.querySelector(`.series-block[data-category="${cat}"]`);
      
      let cardsHtml = catItems.map(item => {
        let badges = '';
        // 仅“道具”分类展示角标
        if (item.category === '道具') {
          if (item.attack > 0) badges += `<span class="card-badge badge-atk">⚔️ ${item.attack}</span>`;
          if (item.meleeDef > 0) badges += `<span class="card-badge badge-def">🛡️ ${item.meleeDef}</span>`;
        }
        return `
        <div class="item-card" data-id="${escapeHtml(item.id)}">
          <div class="item-name">${escapeHtml(item.name)}</div>
          <div class="item-id">#${escapeHtml(item.id)}</div>
          ${badges ? `<div class="card-badges-row">${badges}</div>` : ''}
        </div>
      `}).join('');

      if (existingBlock) {
        existingBlock.querySelector('.items-grid').insertAdjacentHTML('beforeend', cardsHtml);
      } else {
        seriesContainer.insertAdjacentHTML('beforeend', `
          <div class="series-block" data-category="${escapeHtml(cat)}">
            <div class="series-annotation">📦 分类 · ${escapeHtml(cat)}</div>
            <div class="series-title">📦 ${escapeHtml(cat)}</div>
            <div class="items-grid">${cardsHtml}</div>
          </div>
        `);
      }
    }

    renderIndex += batchItems.length;

    if (renderIndex < currentFilteredItems.length) {
      setupInfiniteScroll();
    } else {
      seriesContainer.insertAdjacentHTML('beforeend', `<div class="load-end">—— 已经到底啦 ——</div>`);
    }
  }

  // ==================== 触底探测器 ====================
  function setupInfiniteScroll() {
    if (observer) observer.disconnect();
    let trigger = document.getElementById('load-more-trigger');
    if (!trigger) {
      trigger = document.createElement('div');
      trigger.id = 'load-more-trigger';
      trigger.className = 'load-more-trigger';
      trigger.textContent = '正在加载更多...';
    }
    seriesContainer.appendChild(trigger);

    observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        observer.disconnect(); 
        renderBatch();         
      }
    }, { root: null, rootMargin: '300px', threshold: 0 });
    observer.observe(trigger);
  }

  // ==================== 侧边栏交互 ====================
  function openSidebar() {
    sidebar.classList.add('active');
    sidebarOverlay.classList.add('active');
  }
  function closeSidebar() {
    sidebar.classList.remove('active');
    sidebarOverlay.classList.remove('active');
  }
  threeDotsBtn.addEventListener('click', () => sidebar.classList.contains('active') ? closeSidebar() : openSidebar());
  sidebarOverlay.addEventListener('click', closeSidebar);

  // ==================== 搜索框事件 ====================
  let searchTimer = null;
  searchInput.addEventListener('input', function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      currentSearch = this.value.trim().toLowerCase();
      applyFilter();
    }, 300);
  });

  // ==================== 详情弹窗 ====================
  function openModal(item) {
    modalTitle.textContent = item.name;
    modalId.textContent = `#${item.id}`;
    modalDesc.innerHTML = parseRichText(item.desc);

    let statsHtml = '';
    
    if (item.category === '道具') {
      let combatStats = '';
      let weaponStats = '';

      if (item.attack > 0) combatStats += `<div class="wiki-stat-item"><span class="stat-icon">⚔️</span> 攻击力 <span class="stat-num text-red">${item.attack}</span></div>`;
      if (item.meleeDef > 0) combatStats += `<div class="wiki-stat-item"><span class="stat-icon">🛡️</span> 近战防御 <span class="stat-num text-green">${item.meleeDef}</span></div>`;
      if (item.rangedDef > 0) combatStats += `<div class="wiki-stat-item"><span class="stat-icon">🏹</span> 远程防御 <span class="stat-num text-green">${item.rangedDef}</span></div>`;
      if (item.explodeDef > 0) combatStats += `<div class="wiki-stat-item"><span class="stat-icon">💥</span> 爆炸防御 <span class="stat-num text-green">${item.explodeDef}</span></div>`;
      if (item.fireDef > 0) combatStats += `<div class="wiki-stat-item"><span class="stat-icon">🔥</span> 燃烧防御 <span class="stat-num text-green">${item.fireDef}</span></div>`;
      if (item.poisonDef > 0) combatStats += `<div class="wiki-stat-item"><span class="stat-icon">🧪</span> 毒素防御 <span class="stat-num text-green">${item.poisonDef}</span></div>`;
      if (item.chaosDef > 0) combatStats += `<div class="wiki-stat-item"><span class="stat-icon">🌀</span> 混乱防御 <span class="stat-num text-green">${item.chaosDef}</span></div>`;

      if (item.durability > 0) weaponStats += `<div class="wiki-stat-item"><span class="stat-icon">🔨</span> 最大耐久 <span class="stat-num">${item.durability}</span></div>`;
      if (item.shootInterval > 0) weaponStats += `<div class="wiki-stat-item"><span class="stat-icon">⏱️</span> 射击间隔 <span class="stat-num">${item.shootInterval}</span></div>`;
      if (item.magazine > 0) weaponStats += `<div class="wiki-stat-item"><span class="stat-icon">🔫</span> 弹容量 <span class="stat-num">${item.magazine}</span></div>`;

      if (combatStats) statsHtml += `<div class="wiki-stat-row">${combatStats}</div>`;
      if (weaponStats) statsHtml += `<div class="wiki-stat-row">${weaponStats}</div>`;
    }
    
    statsHtml += `<div class="wiki-info-row">`;
    statsHtml += `<div class="wiki-info-item">分类：<span>${escapeHtml(item.category)}</span></div>`;
    if (item.stack > 0) statsHtml += `<div class="wiki-info-item">堆叠上限：<span>${item.stack}</span></div>`;
    statsHtml += `</div>`;

    modalStats.innerHTML = statsHtml;
    modalOverlay.classList.add('active');
  }

  function closeModal() {
    modalOverlay.classList.remove('active');
  }

  // ==================== 事件绑定 ====================
  seriesContainer.addEventListener('click', function(e) {
    const card = e.target.closest('.item-card');
    if (!card) return;
    const item = itemDatabase.find(i => i.id === card.getAttribute('data-id'));
    if (item) openModal(item);
  });

  modalCloseBtn.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });

  // 点击标题或 ID 复制到剪贴板
  modalTitle.addEventListener('click', () => copyText(modalTitle.textContent));
  modalId.addEventListener('click', () => copyText(modalId.textContent.replace('#', '')));

  // 描述内的富文本跳转
  modalDesc.addEventListener('click', function(e) {
    const link = e.target.closest('.item-link');
    if (!link) return;
    closeModal();
    
    searchInput.value = link.getAttribute('data-jump-id');
    currentSearch = searchInput.value;
    currentCategory = 'all';
    
    document.querySelectorAll('.category-item').forEach(i => i.classList.remove('active'));
    const allCatBtn = document.querySelector('.category-item[data-category="all"]');
    if (allCatBtn) allCatBtn.classList.add('active');

    applyFilter();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (window.innerWidth <= 750) closeSidebar();
  });

  // 启动！
  loadData();
})();