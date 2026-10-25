(function () {
    'use strict';

    /* ---------- 下载按钮交互（预留） ---------- */
    var downloadBtn = document.getElementById('downloadBtn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', function () {
            console.log('下载按钮已点击 — 此处为预留下载逻辑');
            downloadBtn.style.transform = 'scale(0.98)';
            setTimeout(() => { downloadBtn.style.transform = ''; }, 150);
        });
    }

    /* ---------- 公告栏配置 ---------- */
    var ANNOUNCEMENT_URL = 'ssomini.json';
    var HOME_LIMIT = 5;

    var listEl = document.getElementById('announcement-list');
    var moreBtn = document.getElementById('announcement-more');

    var allAnnouncements = [];
    var expanded = false;

    /* ---------------- 工具 ---------------- */

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // 宽松解析（支持多个 {} 拼接）
    function parseLooseJson(text) {
        if (typeof text !== 'string') return null;
        var trimmed = text.trim();
        if (!trimmed) return null;

        try { return JSON.parse(trimmed); } catch (e) {}

        var parts = [];
        var depth = 0, start = -1, inString = false, escapeNext = false;

        for (var i = 0; i < trimmed.length; i++) {
            var ch = trimmed[i];
            if (escapeNext) { escapeNext = false; continue; }
            if (ch === '\\') { escapeNext = true; continue; }
            if (ch === '"') { inString = !inString; continue; }
            if (inString) continue;

            if (ch === '{') {
                if (depth === 0) start = i;
                depth++;
            } else if (ch === '}') {
                if (depth > 0) {
                    depth--;
                    if (depth === 0 && start !== -1) {
                        parts.push(trimmed.slice(start, i + 1));
                        start = -1;
                    }
                }
            }
        }

        if (parts.length === 0) return null;

        var results = [];
        for (var j = 0; j < parts.length; j++) {
            try {
                var obj = JSON.parse(parts[j]);
                if (obj && typeof obj === 'object') results.push(obj);
            } catch (e2) {}
        }
        return results;
    }

    function normalizeData(raw) {
        if (Array.isArray(raw)) return raw;
        if (!raw || typeof raw !== 'object') return [];
        var keys = ['announcements', 'data', 'list', 'items', 'notices'];
        for (var i = 0; i < keys.length; i++) {
            if (Array.isArray(raw[keys[i]])) return raw[keys[i]];
        }
        if (raw.do !== undefined || raw.id !== undefined) return [raw];
        return [];
    }

    // 清洗单条（去掉了系列提取）
    function sanitizeItem(item) {
        if (!item || typeof item !== 'object') return null;

        var rawId = item.id;
        var numId = parseInt(rawId, 10);
        var hasValidId = rawId != null && !isNaN(numId) && isFinite(numId) && String(numId) === String(rawId).trim();

        var content = '';
        if (typeof item.do === 'string') content = item.do.trim();
        else if (item.do != null) content = String(item.do).trim();

        if (!content) return null;

        var sruo = typeof item.sruo === 'string' ? item.sruo : '';

        return {
            id: hasValidId ? numId : null,
            idDisplay: hasValidId ? String(numId) : '--',
            do: content,
            sruo: sruo
        };
    }

    function sanitizeAndSort(rawArr) {
        var valid = [];
        rawArr.forEach(item => {
            var s = sanitizeItem(item);
            if (s) valid.push(s);
        });

        valid.sort((a, b) => {
            if (a.id === null && b.id === null) return 0;
            if (a.id === null) return 1;
            if (b.id === null) return -1;
            return b.id - a.id; // 数字 ID 降序
        });

        return valid;
    }

    /* ---------------- 渲染 ---------------- */

    function renderList(list) {
        if (!listEl) return;

        if (!list || list.length === 0) {
            listEl.innerHTML = '<div class="announcement-loading">暂无公告。</div>';
            return;
        }

        var html = '';
        list.forEach(item => {
            var badgeText = '#' + escapeHtml(item.idDisplay);
            var text = escapeHtml(item.do);

            // 干净的 HTML 结构，没有多余的 series-tag
            html += 
                '<div class="announcement-item">' +
                    '<span class="badge">' + badgeText + '</span>' +
                    '<span class="text">' + text + '</span>' +
                '</div>';
        });
        listEl.innerHTML = html;
    }

    function updateMoreButton(total) {
        if (!moreBtn) return;

        // 重点修复：只要 ≤ 5 条，直接隐藏按钮并移除展开状态
        if (total <= HOME_LIMIT) {
            moreBtn.hidden = true;
            moreBtn.style.display = 'none'; // 强制隐藏，防覆盖
            moreBtn.classList.remove('expanded');
            expanded = false;
            return;
        }

        moreBtn.hidden = false;
        moreBtn.style.display = 'flex';
        
        if (expanded) {
            moreBtn.innerHTML = '收起 <span class="arrow">▾</span>';
            moreBtn.classList.add('expanded');
        } else {
            moreBtn.innerHTML = '更多 <span class="arrow">▾</span>';
            moreBtn.classList.remove('expanded');
        }
    }

    function render() {
        var total = allAnnouncements.length;

        if (total === 0) {
            renderList([]);
            updateMoreButton(0);
            return;
        }

        var visible = expanded ? allAnnouncements : allAnnouncements.slice(0, HOME_LIMIT);
        renderList(visible);
        updateMoreButton(total);
    }

    /* ---------------- 拉取 ---------------- */

    async function fetchAnnouncements() {
        if (listEl) listEl.innerHTML = '<div class="announcement-loading">正在加载最新公告…</div>';
        if (moreBtn) moreBtn.hidden = true;

        try {
            var res = await fetch(ANNOUNCEMENT_URL, { cache: 'no-store' });
            if (!res.ok) throw new Error('HTTP ' + res.status);

            var text = await res.text();
            var raw = parseLooseJson(text);
            if (raw === null) throw new Error('无法解析');

            var arr = normalizeData(raw);
            allAnnouncements = sanitizeAndSort(arr);

            allAnnouncements.forEach(item => {
                if (item.sruo) console.debug('[状态] id=' + item.idDisplay + ' sruo=' + item.sruo);
            });

            if (allAnnouncements.length === 0) {
                if (listEl) listEl.innerHTML = '<div class="announcement-loading">暂无公告。</div>';
                if (moreBtn) moreBtn.hidden = true;
                return;
            }

            render();
        } catch (err) {
            console.warn('公告获取失败：', err);
            if (listEl) listEl.innerHTML = '<div class="announcement-loading">暂时无法获取公告。</div>';
            if (moreBtn) moreBtn.hidden = true;
        }
    }

    if (moreBtn) {
        moreBtn.addEventListener('click', function () {
            if (allAnnouncements.length <= HOME_LIMIT) return;
            expanded = !expanded;
            render();
        });
    }

    fetchAnnouncements();
})();