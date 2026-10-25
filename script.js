// ========== 视图切换逻辑 ==========
document.addEventListener('DOMContentLoaded', () => {

  const navLinks = document.querySelectorAll('.nav-link');
  const views = {
    home: document.getElementById('view-home'),
    explore: document.getElementById('view-explore'),
    about: document.getElementById('view-about'),
    contact: document.getElementById('view-contact')
  };

  // 切换视图
  function switchView(viewName) {
    // 隐藏所有视图
    Object.values(views).forEach(v => {
      if (v) v.classList.remove('active');
    });
    // 显示目标视图
    if (views[viewName]) {
      views[viewName].classList.add('active');
    }
    // 更新导航高亮
    navLinks.forEach(link => {
      link.classList.toggle('active', link.dataset.view === viewName);
    });
    // 回到顶部
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // 重新触发卡片动画
    setTimeout(observeCards, 100);
  }

  // 绑定导航点击
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      switchView(link.dataset.view);
    });
  });

  // 首页「开始探索」按钮 → 跳转到探索页
  const exploreBtn = document.getElementById('exploreBtn');
  if (exploreBtn) {
    exploreBtn.addEventListener('click', () => {
      switchView('explore');
    });
  }

  // ========== 卡片入场动画 ==========
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.15,
    rootMargin: '0px 0px -40px 0px'
  });

  function observeCards() {
    const cards = document.querySelectorAll('.feature-card, .preview-card, .content-block');
    cards.forEach(card => {
      // 只对当前可见视图内的卡片做动画
      const view = card.closest('.view');
      if (view && !view.classList.contains('active')) return;

      card.style.opacity = '0';
      card.style.transform = 'translateY(24px)';
      card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
      observer.observe(card);
    });
  }

  // 初始触发一次
  observeCards();

  console.log('🎨 当前页面背景色: #FFFAEB');
});