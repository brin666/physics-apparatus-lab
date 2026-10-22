import { createBoardStore } from './whiteboard-store.mjs';

const icons = {
  model: '<path d="m12 3 8 5v8l-8 5-8-5V8zM4 8l8 5 8-5M12 13v8"/>',
  pen: '<path d="m4 20 4-1L20 7l-3-3L5 16zM14 7l3 3M4 22h16"/>',
  highlighter: '<path d="m7 15 7-11 7 5-8 10zM7 15l-4 5h9l1-1M14 4l7 5"/>',
  eraser: '<path d="m4 13 9-10 8 8-9 10H9zM8 9l8 8M12 21h9"/>',
  text: '<path d="M4 5h16M12 5v15M8 20h8M4 5v3M20 5v3"/>',
  line: '<path d="m5 19 14-14"/><circle cx="5" cy="19" r="1"/><circle cx="19" cy="5" r="1"/>',
  arrow: '<path d="m4 20 16-16M9 4h11v11"/>',
  undo: '<path d="m8 4-5 5 5 5M3 9h11a6 6 0 0 1 0 12"/>',
  redo: '<path d="m16 4 5 5-5 5m5-5H10a6 6 0 0 0 0 12"/>',
  reset: '<path d="M20 11a8 8 0 1 1-4-6M20 3v6h-6M12 8v4l3 2"/>',
};
const svg = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || ''}</svg>`;
const toolList = [['model', '模型'], ['pen', '画笔'], ['highlighter', '荧光笔'], ['eraser', '橡皮擦'], ['text', '文字'], ['line', '直线'], ['arrow', '箭头']];
const palette = [['#4b5964', '墨灰'], ['#1c73ff', '蓝色'], ['#ff7b00', '橙色'], ['#d83232', '红色'], ['#2b8b54', '绿色']];
const clone = value => structuredClone(value);
const uid = () => globalThis.crypto?.randomUUID?.() || `board-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const contextIdentity = (title, detail, snapshot) => {
  // A camera is part of the saved board, not a new teaching moment.
  const pose = snapshot ? Object.fromEntries(Object.entries(snapshot).filter(([key]) => key !== 'camera')) : null;
  return JSON.stringify([title, detail, pose]);
};

// Screen-space vector ink, adapted from the gene-expression teaching whiteboard.
// This layer deliberately knows nothing about model state or the teaching clock.
function createInk({ canvas, onChange, onTextRequest, onStatus }) {
  const ctx = canvas.getContext('2d');
  let operations = [], past = [], future = [], documentWidth = 1600, documentHeight = 900;
  let tool = 'pen', color = palette[1][0], width = 4, draft = null, before = null;
  let primary = null, blocked = false, frame = 0, disposed = false;
  const pointers = new Set();
  const notify = () => onChange(clone(operations), { canUndo: !!past.length, canRedo: !!future.length });
  function invalidate() { if (!frame && !disposed) frame = requestAnimationFrame(draw); }
  function path(points) {
    ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    if (points.length === 1) ctx.lineTo(points[0][0] + .01, points[0][1]);
  }
  function drawOperation(op) {
    ctx.save(); ctx.strokeStyle = ctx.fillStyle = op.color; ctx.lineWidth = op.width; ctx.lineCap = ctx.lineJoin = 'round';
    if (op.type === 'text') {
      ctx.font = `500 ${op.fontSize}px "Microsoft YaHei", sans-serif`; ctx.textBaseline = 'top';
      op.text.split('\n').forEach((line, i) => ctx.fillText(line, op.x, op.y + i * op.fontSize * 1.4));
    } else {
      ctx.globalAlpha = op.type === 'highlighter' ? .25 : 1; path(op.points); ctx.stroke();
      if (op.type === 'arrow' && op.points.length > 1) {
        const a = op.points[0], b = op.points.at(-1), angle = Math.atan2(b[1] - a[1], b[0] - a[0]), length = Math.max(16, op.width * 3);
        ctx.beginPath(); ctx.moveTo(b[0] - Math.cos(angle - .48) * length, b[1] - Math.sin(angle - .48) * length);
        ctx.lineTo(...b); ctx.lineTo(b[0] - Math.cos(angle + .48) * length, b[1] - Math.sin(angle + .48) * length); ctx.stroke();
      }
    }
    ctx.restore();
  }
  function draw() {
    frame = 0; if (disposed) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(canvas.width / documentWidth, 0, 0, canvas.height / documentHeight, 0, 0);
    operations.forEach(drawOperation); if (draft) drawOperation(draft);
  }
  function change(next, old = operations) {
    past.push(old); if (past.length > 60) past.shift(); future = []; operations = next; invalidate(); notify();
  }
  function point(event) {
    const rect = canvas.getBoundingClientRect();
    return [Math.max(0, Math.min(documentWidth, (event.clientX - rect.left) / rect.width * documentWidth)), Math.max(0, Math.min(documentHeight, (event.clientY - rect.top) / rect.height * documentHeight))];
  }
  function distance(p, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], f = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(p[0] - a[0] - dx * f, p[1] - a[1] - dy * f);
  }
  function hit(op, p, radius = 12) {
    if (op.type === 'text') {
      ctx.font = `500 ${op.fontSize}px "Microsoft YaHei", sans-serif`;
      const lines = op.text.split('\n'), w = Math.max(...lines.map(line => ctx.measureText(line).width));
      return p[0] >= op.x - radius && p[0] <= op.x + w + radius && p[1] >= op.y - radius && p[1] <= op.y + lines.length * op.fontSize * 1.4 + radius;
    }
    return op.points.some((a, i) => distance(p, a, op.points[i + 1] || a) < radius + op.width / 2);
  }
  function erase(p) { operations = operations.filter(op => !hit(op, p, Math.max(12, width * 2))); invalidate(); }
  function cancelDraft() { if (before) operations = before; draft = null; before = null; primary = null; invalidate(); }
  function cancelGesture() {
    cancelDraft(); blocked = false; const captured = [...pointers]; pointers.clear();
    for (const pointer of captured) if (canvas.hasPointerCapture(pointer)) canvas.releasePointerCapture(pointer);
  }
  function down(event) {
    if (tool === 'model' || event.button > 0) return;
    event.preventDefault(); event.stopPropagation(); canvas.focus({ preventScroll: true });
    pointers.add(event.pointerId); canvas.setPointerCapture(event.pointerId);
    if (pointers.size > 1) { blocked = true; cancelDraft(); return; }
    if (blocked) return;
    primary = event.pointerId; const p = point(event);
    if (tool === 'text') {
      const existing = [...operations].reverse().find(op => op.type === 'text' && hit(op, p, 4));
      onTextRequest({ x: p[0], y: p[1], existing: existing ? clone(existing) : null }); primary = null; return;
    }
    before = operations;
    if (tool === 'eraser') { erase(p); return; }
    if (operations.length >= 2000) { onStatus('此页笔迹已达上限，请清理后继续。'); cancelGesture(); return; }
    draft = { id: uid(), type: tool, color, width: tool === 'highlighter' ? width * 5 : width, points: [p] }; invalidate();
  }
  function move(event) {
    if (tool === 'model') return;
    event.preventDefault(); if (blocked || primary !== event.pointerId) return;
    if (tool === 'eraser') { erase(point(event)); return; }
    if (!draft) return;
    const events = event.getCoalescedEvents?.() || [];
    for (const e of events.length ? events : [event]) {
      const p = point(e);
      if (tool === 'line' || tool === 'arrow') { draft.points = [draft.points[0], p]; continue; }
      const previous = draft.points.at(-1); if (Math.hypot(p[0] - previous[0], p[1] - previous[1]) > .9) draft.points.push(p);
      if (draft.points.length > 6000) draft.points = draft.points.filter((_, i) => i % 2 === 0 || i === draft.points.length - 1);
    }
    invalidate();
  }
  function up(event) {
    if (tool !== 'model') event.preventDefault();
    if (primary === event.pointerId && !blocked) {
      if (draft) { move(event); const next = [...operations, draft]; draft = null; change(next, before); }
      else if (before && operations.length !== before.length) change(operations, before);
      before = null; primary = null;
    }
    pointers.delete(event.pointerId); if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (!pointers.size) blocked = false;
  }
  function cancel(event) {
    if (primary === event.pointerId) cancelDraft(); pointers.delete(event.pointerId); blocked = pointers.size > 0;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  }
  const handlers = [['pointerdown', down], ['pointermove', move], ['pointerup', up], ['pointercancel', cancel], ['lostpointercapture', cancel]];
  handlers.forEach(([name, fn]) => canvas.addEventListener(name, fn));
  return {
    setDocument(record) { cancelGesture(); documentWidth = record.width; documentHeight = record.height; operations = clone(record.operations); past = []; future = []; invalidate(); notify(); },
    setTool(next, nextColor, nextWidth) { cancelGesture(); tool = next; color = nextColor; width = nextWidth; canvas.style.pointerEvents = tool === 'model' ? 'none' : 'auto'; canvas.style.cursor = tool === 'text' ? 'text' : tool === 'eraser' ? 'cell' : 'crosshair'; },
    resize(w, h) { const dpr = Math.min(2, globalThis.devicePixelRatio || 1); canvas.width = Math.max(1, Math.round(w * dpr)); canvas.height = Math.max(1, Math.round(h * dpr)); invalidate(); },
    undo() { cancelGesture(); if (past.length) { future.push(operations); operations = past.pop(); invalidate(); notify(); } },
    redo() { cancelGesture(); if (future.length) { past.push(operations); operations = future.pop(); invalidate(); notify(); } },
    clear() { cancelGesture(); if (operations.length) change([]); },
    addText({ x, y, text, existing }) {
      const cleaned = String(text).trim().slice(0, 2000), next = operations.filter(op => op.id !== existing?.id);
      if (cleaned && (existing || next.length < 2000)) next.push({ id: existing?.id || uid(), type: 'text', color: existing?.color || color, width: 1, x: existing?.x ?? x, y: existing?.y ?? y, text: cleaned, fontSize: existing?.fontSize || 30 + width });
      if (cleaned || next.length !== operations.length) change(next);
    },
    cancelGesture,
    get operations() { return clone(operations); },
    destroy() { cancelGesture(); disposed = true; cancelAnimationFrame(frame); handlers.forEach(([name, fn]) => canvas.removeEventListener(name, fn)); },
  };
}

/** Move the live model into a fullscreen board. The host owns the teaching clock. */
export function createWhiteboard({ model, getContext = () => ({}), onOpen = () => {}, onClose = () => {}, onViewAction = () => {}, onInteractionChange = () => {}, onRestoreContext = () => {} } = {}) {
  if (!(model instanceof HTMLElement)) throw new TypeError('createWhiteboard requires the live model element');
  const root = document.createElement('section'); root.id = 'whiteboard'; root.className = 'wb-shell'; root.hidden = true;
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-labelledby', 'wb-title'); root.tabIndex = -1;
  root.innerHTML = `<header class="wb-header"><div class="wb-heading"><span class="wb-brand">${svg('pen')}</span><div><h2 id="wb-title">课堂白板</h2><p id="wb-context"></p></div></div><div class="wb-header-actions"><span class="wb-frozen"><i></i>教学已暂停</span><button id="wb-pages" type="button" aria-expanded="false" aria-controls="wb-library">本地板书</button><button id="wb-exit" class="wb-exit" type="button">返回教学 <span aria-hidden="true">↗</span></button></div></header>
    <div class="wb-workspace"><div id="wb-frame" class="wb-frame"><canvas id="wb-ink" tabindex="0" aria-label="板书画布。选择工具后用鼠标、触控笔或手指书写；Ctrl+Z 撤销。"></canvas><div class="wb-view-actions" role="group" aria-label="模型视角"><button type="button" data-wb-view="zoom-in" aria-label="放大模型">＋</button><button type="button" data-wb-view="zoom-out" aria-label="缩小模型">−</button><button type="button" data-wb-view="reset" aria-label="复位模型视角">${svg('reset')}<span>视角复位</span></button></div></div>
    <aside id="wb-library" class="wb-library" aria-labelledby="wb-library-title" hidden><div class="wb-library-top"><h3 id="wb-library-title">本地板书</h3><button id="wb-library-close" type="button" aria-label="收起板书列表">×</button></div><p>打开板书时，会恢复对应的教学时刻。</p><div id="wb-page-list" class="wb-page-list"></div><p class="wb-library-note">仅保存在当前浏览器，清理浏览器数据或更换设备后无法恢复。</p></aside></div>
    <footer class="wb-footer"><div class="wb-toolbar" role="toolbar" aria-label="课堂板书工具"><div class="wb-tools" role="group" aria-label="操作模式">${toolList.map(([name, label]) => `<button type="button" data-wb-tool="${name}" aria-pressed="${name === 'pen'}">${svg(name)}<span>${label}</span></button>`).join('')}</div><div class="wb-palette" role="group" aria-label="笔迹颜色">${palette.map(([value, label], i) => `<button type="button" data-wb-color="${value}" style="--wb-swatch:${value}" aria-label="${label}" aria-pressed="${i === 1}"><span></span></button>`).join('')}</div><label class="wb-width"><span class="wb-sr-only">笔迹粗细</span><select id="wb-width" aria-label="笔迹粗细"><option value="2">细</option><option value="4" selected>中</option><option value="8">粗</option></select></label><div class="wb-history"><button id="wb-undo" type="button" disabled>${svg('undo')}<span>撤销</span></button><button id="wb-redo" type="button" disabled>${svg('redo')}<span>重做</span></button><button id="wb-clear" type="button" disabled>清空</button></div></div><div class="wb-footnotes"><span id="wb-gesture-hint">画笔模式 · 拖动书写</span><span id="wb-save-state" role="status" aria-live="polite">板书仅保存在当前浏览器</span></div></footer>
    <dialog id="wb-text-dialog" class="wb-dialog"><form><h3>添加课堂文字</h3><label for="wb-text-input">板书内容</label><textarea id="wb-text-input" maxlength="2000" rows="4" placeholder="输入关键词或一句讲解"></textarea><div><button type="button" data-wb-cancel>取消</button><button class="wb-primary" type="submit">放到白板</button></div></form></dialog><dialog id="wb-clear-dialog" class="wb-dialog"><h3>清空这一页的板书？</h3><p>清空后仍可用“撤销”恢复，其他本地板书会保留。</p><div><button type="button" data-wb-cancel>保留板书</button><button id="wb-clear-confirm" class="wb-primary" type="button">清空本页</button></div></dialog>`;
  document.body.append(root);
  const $ = id => root.querySelector(`#${id}`), frame = $('wb-frame'), canvas = $('wb-ink');
  let active = false, busy = false, disposed = false, tool = 'pen', color = palette[1][0], width = 4, current = null, suppressSave = false;
  let placeholder, originalParent, modelStyle, modelClass, previousFocus, previousOverflow, resizeObserver, textPosition, inertNodes = [], frameBindings = [];
  const notice = message => { $('wb-save-state').textContent = message; };
  const store = createBoardStore({ onStatus(status) { $('wb-save-state').dataset.state = status.state; notice(status.message); } });
  $('wb-save-state').dataset.state = store.status.state; notice(store.status.message);
  const ink = createInk({ canvas, onChange(operations, history) {
    $('wb-undo').disabled = !history.canUndo; $('wb-redo').disabled = !history.canRedo; $('wb-clear').disabled = !operations.length;
    if (current && !suppressSave) { current.operations = operations; save(); }
  }, onTextRequest(position) { textPosition = position; ink.cancelGesture(); $('wb-text-input').value = position.existing?.text || ''; $('wb-text-dialog').showModal(); $('wb-text-input').focus(); }, onStatus: notice });
  function save() {
    if (!current || disposed) return;
    const snapshot = getContext()?.snapshot;
    if (snapshot) current.snapshot = clone(snapshot);
    current.updatedAt = Date.now(); store.save(current);
  }
  function resize() { if (active) ink.resize(frame.clientWidth, frame.clientHeight); }
  function setTool(next) {
    if (!toolList.some(([name]) => name === next)) return;
    tool = next; root.dataset.tool = tool; ink.setTool(tool, color, width);
    root.querySelectorAll('[data-wb-tool]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.wbTool === tool)));
    $('wb-gesture-hint').textContent = tool === 'model' ? '模型模式 · 拖动旋转，滚轮或双指缩放' : tool === 'eraser' ? '橡皮擦 · 按整笔擦除，可撤销恢复' : tool === 'text' ? '文字模式 · 点击添加，点击已有文字可编辑' : `${toolList.find(([name]) => name === tool)[1]}模式 · 拖动${tool === 'pen' ? '书写' : '绘制'}`;
    onInteractionChange(tool === 'model' ? 'model' : 'draw');
  }
  function heading() { $('wb-context').textContent = [current.title, current.detail].filter(Boolean).join(' · '); }
  function setDocument(record) { current = clone(record); suppressSave = true; ink.setDocument(current); suppressSave = false; heading(); resize(); }
  function library(show) {
    $('wb-library').hidden = !show; $('wb-pages').setAttribute('aria-expanded', String(show));
    if (!show) return;
    const rows = store.list(); $('wb-page-list').replaceChildren();
    if (!rows.length) { const p = document.createElement('p'); p.textContent = '还没有保存的板书。'; $('wb-page-list').append(p); }
    rows.forEach(row => {
      const button = document.createElement('button'); button.type = 'button'; button.dataset.wbBoard = row.id; button.setAttribute('aria-current', row.id === current?.id ? 'page' : 'false');
      const title = document.createElement('strong'); title.textContent = [row.title, row.detail].filter(Boolean).join(' · ') || '课堂板书';
      const detail = document.createElement('span'); detail.textContent = `${new Date(row.updatedAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · ${row.operations.length} 笔${row.id === current?.id ? ' · 当前页' : ''}`;
      button.append(title, detail); button.addEventListener('click', async () => {
        if (busy || row.id === current?.id) { library(false); return; }
        busy = true; ink.cancelGesture(); save(); store.flush();
        root.inert = true; root.setAttribute('aria-busy', 'true'); canvas.style.visibility = 'hidden';
        try { if (row.snapshot) await onRestoreContext(clone(row.snapshot)); setDocument(row); setTool('pen'); library(false); notice(store.status.state === 'error' ? store.status.message : '已恢复此时刻的模型与板书'); }
        catch { notice('此页模型暂时无法恢复，已保留当前板书。'); }
        finally { canvas.style.visibility = ''; root.inert = false; root.removeAttribute('aria-busy'); busy = false; }
      }); $('wb-page-list').append(button);
    });
    $('wb-library-close').focus({ preventScroll: true });
  }
  function moveModel(parent, reference) {
    // moveBefore preserves the iframe browsing context, camera, and WebGL canvas.
    if (typeof parent.moveBefore === 'function') parent.moveBefore(model, reference);
    else parent.insertBefore(model, reference);
  }
  function frameKeydown(event) {
    if (!active) return;
    // Keyboard events inside the live iframe do not bubble into the modal.
    event.stopImmediatePropagation();
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    else if (event.key === 'Tab') { event.preventDefault(); canvas.focus({ preventScroll: true }); }
  }
  function bindFrameKeys() {
    frameBindings = [...model.querySelectorAll('iframe')].map(iframe => {
      const attach = () => { try { iframe.contentWindow.addEventListener('keydown', frameKeydown, true); } catch { /* Cross-origin frames must manage their own keyboard access. */ } };
      iframe.addEventListener('load', attach); attach(); return { iframe, attach };
    });
  }
  async function open() {
    if (active || busy || disposed) return;
    busy = true; previousFocus = document.activeElement;
    try {
      await onOpen(); // Pause teaching before the live model changes its DOM parent.
      const context = getContext() || {}, title = String(context.title || '汽油机'), detail = String(context.detail || '');
      const contextKey = contextIdentity(title, detail, context.snapshot);
      // Also recognize boards written before camera-independent keys were added.
      const savedRecord = store.find(contextKey) || store.list().find(row => contextIdentity(row.title, row.detail, row.snapshot) === contextKey);
      const record = savedRecord || { id: uid(), contextKey, title, detail, snapshot: context.snapshot ? clone(context.snapshot) : null, width: 1600, height: 900, updatedAt: Date.now(), operations: [] };
      record.contextKey = contextKey;
      originalParent = model.parentNode; if (!originalParent) throw new Error('Live model is detached');
      placeholder = document.createComment('live-model-whiteboard-position'); originalParent.insertBefore(placeholder, model);
      modelStyle = model.getAttribute('style'); modelClass = model.getAttribute('class');
      root.hidden = false; root.inert = true; root.setAttribute('aria-busy', 'true'); canvas.style.visibility = 'hidden'; active = true; model.classList.add('wb-model');
      model.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;min-height:0;margin:0;border:0;border-radius:0;';
      moveModel(frame, canvas);
      bindFrameKeys();
      previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
      inertNodes = [...document.body.children].filter(node => node !== root && !['SCRIPT', 'STYLE', 'LINK'].includes(node.tagName)).map(node => [node, node.inert]);
      inertNodes.forEach(([node]) => { node.inert = true; });
      if (!savedRecord) record.height = Math.max(300, Math.round(record.width * frame.clientHeight / Math.max(1, frame.clientWidth)));
      if (savedRecord?.snapshot) await onRestoreContext(clone(savedRecord.snapshot));
      setDocument(record); setTool('pen'); save();
      canvas.style.visibility = ''; root.inert = false; root.removeAttribute('aria-busy');
      resizeObserver = new ResizeObserver(resize); resizeObserver.observe(frame); $('wb-exit').focus({ preventScroll: true });
    } catch (error) {
      if (placeholder) restore(); active = false; onClose(); throw error;
    } finally { busy = false; }
  }
  function restore() {
    resizeObserver?.disconnect(); resizeObserver = null;
    frameBindings.forEach(({ iframe, attach }) => { iframe.removeEventListener('load', attach); try { iframe.contentWindow.removeEventListener('keydown', frameKeydown, true); } catch { /* The iframe may have navigated. */ } }); frameBindings = [];
    if (placeholder?.parentNode) { moveModel(placeholder.parentNode, placeholder); placeholder.remove(); }
    placeholder = null;
    if (modelClass === null) model.removeAttribute('class'); else model.setAttribute('class', modelClass);
    if (modelStyle === null) model.removeAttribute('style'); else model.setAttribute('style', modelStyle);
    inertNodes.forEach(([node, wasInert]) => { node.inert = wasInert; }); inertNodes = [];
    if (previousOverflow !== undefined) document.body.style.overflow = previousOverflow;
    root.hidden = true; root.inert = false; root.removeAttribute('aria-busy'); canvas.style.visibility = ''; library(false);
  }
  function close() {
    if (!active || busy) return;
    ink.cancelGesture(); root.querySelectorAll('dialog[open]').forEach(dialog => dialog.close()); save(); store.flush(); restore(); active = false;
    onClose(); if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  }
  root.querySelectorAll('[data-wb-tool]').forEach(button => button.addEventListener('click', () => { if (!busy) setTool(button.dataset.wbTool); }));
  root.querySelectorAll('[data-wb-color]').forEach(button => button.addEventListener('click', () => {
    color = button.dataset.wbColor; root.querySelectorAll('[data-wb-color]').forEach(other => other.setAttribute('aria-pressed', String(other === button))); ink.setTool(tool, color, width);
  }));
  $('wb-width').addEventListener('change', () => { width = Number($('wb-width').value); ink.setTool(tool, color, width); });
  $('wb-undo').addEventListener('click', () => ink.undo()); $('wb-redo').addEventListener('click', () => ink.redo());
  $('wb-clear').addEventListener('click', () => { ink.cancelGesture(); $('wb-clear-dialog').showModal(); });
  $('wb-clear-confirm').addEventListener('click', () => { ink.clear(); $('wb-clear-dialog').close(); canvas.focus(); });
  root.querySelectorAll('[data-wb-cancel]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
  $('wb-text-dialog').querySelector('form').addEventListener('submit', event => { event.preventDefault(); ink.addText({ ...textPosition, text: $('wb-text-input').value }); $('wb-text-dialog').close(); canvas.focus(); });
  $('wb-exit').addEventListener('click', close); $('wb-pages').addEventListener('click', () => library($('wb-library').hidden));
  $('wb-library-close').addEventListener('click', () => { library(false); $('wb-pages').focus(); });
  root.querySelectorAll('[data-wb-view]').forEach(button => button.addEventListener('click', () => { if (!busy) onViewAction(button.dataset.wbView); }));
  function keydown(event) {
    if (!active) return;
    event.stopPropagation(); const dialog = root.querySelector('dialog[open]');
    if (event.key === 'Escape') { event.preventDefault(); if (dialog) dialog.close(); else if (!$('wb-library').hidden) { library(false); $('wb-pages').focus(); } else close(); return; }
    const editing = event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLInputElement;
    if (!editing && !dialog && (event.ctrlKey || event.metaKey) && ['z', 'y'].includes(event.key.toLowerCase())) {
      event.preventDefault(); if (event.key.toLowerCase() === 'y' || event.shiftKey) ink.redo(); else ink.undo(); return;
    }
    if (event.key !== 'Tab') return;
    const controls = [...(dialog || root).querySelectorAll('button:not(:disabled),select,textarea,[tabindex="0"]')].filter(element => element.getClientRects().length);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && (document.activeElement === first || document.activeElement === root)) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  root.addEventListener('keydown', keydown);
  // Keep drawing, toolbar clicks, and their shortcuts out of teaching handlers.
  const stop = event => event.stopPropagation(); ['pointerdown', 'click', 'keyup'].forEach(name => root.addEventListener(name, stop));
  const flush = () => { if (active && !busy) { ink.cancelGesture(); save(); } store.flush(); };
  const visibility = () => { if (document.hidden) flush(); };
  window.addEventListener('pagehide', flush); document.addEventListener('visibilitychange', visibility);
  return {
    open, close, get isOpen() { return active; },
    inspect: () => ({ isOpen: active, tool, record: current ? clone(current) : null, storage: store.status }),
    destroy() { if (active) { busy = false; close(); } disposed = true; ink.destroy(); store.destroy(); window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', visibility); root.remove(); },
  };
}
