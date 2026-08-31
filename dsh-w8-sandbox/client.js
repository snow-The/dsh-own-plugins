// dsh-w8-sandbox client - floating draggable sandbox window (notemap-style).
window.__ModuleLoader__.load({
  id: '@snow-the/dsh-w8-sandbox',
  factory: (require) => {
    const module = { exports: {} };
    const jsx = require('react/jsx-runtime');
    document.documentElement.setAttribute('data-w8-sandbox-mounted', '');
    const DIALOG_ID = 'w8-sandbox-dialog-root';
    const LS_KEY = 'dsh.w8.rect';
    const MIN_W = 360, MIN_H = 260;
    function loadRect() {
      try { const r = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); if (r && typeof r.left === 'number' && r.w >= MIN_W) return r; } catch {}
      return { left: Math.max(8, window.innerWidth - 780), top: 80, w: 720, h: 480 };
    }
    function saveRect(r) { try { localStorage.setItem(LS_KEY, JSON.stringify(r)); } catch {} }
    const openSandbox = () => {
      let root = document.getElementById(DIALOG_ID);
      if (root) { root.style.display = 'flex'; return; }
      const rect = loadRect();
      root = document.createElement('div');
      root.id = DIALOG_ID;
      root.style.cssText = 'position:fixed;z-index:9998;font-family:system-ui,sans-serif;';
      root.style.left = rect.left + 'px'; root.style.top = rect.top + 'px';
      root.style.width = rect.w + 'px'; root.style.height = rect.h + 'px';
      root.style.display = 'flex'; root.style.flexDirection = 'column';
      root.style.background = 'var(--ds-bg, #16161a)';
      root.style.border = '1px solid var(--ds-border, rgba(128,128,128,.4))';
      root.style.borderRadius = '12px';
      root.style.boxShadow = '0 12px 40px rgba(0,0,0,.45)';
      root.style.overflow = 'hidden';
      const bar = document.createElement('div');
      bar.style.cssText = 'display:flex;align-items:center;gap:8px;padding:7px 10px;border-bottom:1px solid var(--ds-border, rgba(128,128,128,.25));flex:none;cursor:grab;user-select:none;';
      bar.innerHTML = '<span style="font-size:13px;font-weight:600;flex:1;color:inherit;">🌍 w8 世界沙盒</span>';
      const close = document.createElement('button');
      close.type = 'button'; close.textContent = '×';
      close.style.cssText = 'border:1px solid var(--ds-border, rgba(128,128,128,.35));background:transparent;color:inherit;border-radius:8px;width:26px;height:26px;font-size:15px;cursor:pointer;line-height:1;';
      close.addEventListener('click', () => { root.style.display = 'none'; });
      bar.appendChild(close);
      const frame = document.createElement('iframe');
      frame.src = '/w8/';
      frame.style.cssText = 'flex:1;border:0;width:100%;height:100%;background:#111;';
      const grip = document.createElement('div');
      grip.style.cssText = 'position:absolute;right:2px;bottom:2px;width:14px;height:14px;cursor:se-resize;';
      root.appendChild(bar); root.appendChild(frame); root.appendChild(grip);
      let dragging = null;
      bar.addEventListener('pointerdown', (e) => { if (e.target === close) return; dragging = { dx: e.clientX - root.offsetLeft, dy: e.clientY - root.offsetTop, moved: false }; bar.setPointerCapture(e.pointerId); });
      bar.addEventListener('pointermove', (e) => { if (!dragging) return; root.style.left = Math.min(Math.max(0, e.clientX - dragging.dx), window.innerWidth - 40) + 'px'; root.style.top = Math.min(Math.max(0, e.clientY - dragging.dy), window.innerHeight - 40) + 'px'; dragging.moved = true; });
      bar.addEventListener('pointerup', () => { if (!dragging) return; const m = dragging.moved; dragging = null; if (m) saveRect({ left: root.offsetLeft, top: root.offsetTop, w: root.offsetWidth, h: root.offsetHeight }); });
      let resizing = null;
      grip.addEventListener('pointerdown', (e) => { resizing = { x: e.clientX, y: e.clientY, w: root.offsetWidth, h: root.offsetHeight }; grip.setPointerCapture(e.pointerId); e.stopPropagation(); });
      grip.addEventListener('pointermove', (e) => { if (!resizing) return; root.style.width = Math.max(MIN_W, resizing.w + (e.clientX - resizing.x)) + 'px'; root.style.height = Math.max(MIN_H, resizing.h + (e.clientY - resizing.y)) + 'px'; });
      grip.addEventListener('pointerup', () => { if (!resizing) return; resizing = null; saveRect({ left: root.offsetLeft, top: root.offsetTop, w: root.offsetWidth, h: root.offsetHeight }); });
      document.body.appendChild(root);
    };
    const HeaderButton = () => jsx.jsx('button', {
      type: 'button', 'data-w8-anchor': 'true', title: '打开 w8 世界沙盒(可拖拽小窗口)', 'aria-label': '打开 w8 世界沙盒',
      onClick: openSandbox,
      style: { display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', border: '1px solid var(--ds-border, #444)', borderRadius: '6px', background: 'transparent', color: 'inherit', fontSize: '12px', cursor: 'pointer', lineHeight: '1.6' },
      children: '🌍 沙盒',
    });
    module.exports.inject = ['slots'];
    module.exports.apply = (ctx) => {
      try {
        ctx.slots.inject('conversation.session.header.actions', () =>
          ctx.slots.register({ name: 'conversation.session.header.actions', id: 'w8-sandbox-open', component: HeaderButton }));
      } catch (e) { console.warn('[w8-sandbox] slot inject failed:', e); }
    };
    return module.exports;
  },
});
