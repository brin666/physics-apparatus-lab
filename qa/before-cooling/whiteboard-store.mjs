// The board keeps vector ink and teaching context together, in this browser only.
export const WHITEBOARD_STORAGE_KEY = 'thermal-energy-whiteboard';
const clone = value => structuredClone(value);
const finite = value => Number.isFinite(value);
function validOperation(op) {
  if (!op || typeof op.id !== 'string' || !['pen', 'highlighter', 'line', 'arrow', 'text'].includes(op.type)) return false;
  if (typeof op.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(op.color) || !finite(op.width) || op.width <= 0) return false;
  if (op.type === 'text') return typeof op.text === 'string' && op.text.length <= 2000 && finite(op.x) && finite(op.y) && finite(op.fontSize) && op.fontSize > 0;
  return Array.isArray(op.points) && op.points.length > 0 && op.points.length <= 6000 && op.points.every(p => Array.isArray(p) && p.length === 2 && p.every(finite));
}
function validBoard(board) {
  return board && typeof board.id === 'string' && typeof board.contextKey === 'string' && typeof board.title === 'string' && typeof board.detail === 'string'
    && finite(board.width) && board.width > 0 && finite(board.height) && board.height > 0 && finite(board.updatedAt)
    && Array.isArray(board.operations) && board.operations.length <= 2000 && board.operations.every(validOperation);
}
export function createBoardStore({ storage, onStatus = () => {} } = {}) {
  let boards = [], timer, target = storage, writable = true, disposed = false;
  let status = { state: 'ready', message: '板书仅保存在当前浏览器' };
  function report(state, message) { status = { state, message }; onStatus(clone(status)); }
  try {
    if (target === undefined) target = globalThis.localStorage;
    if (!target) throw new Error('Local storage unavailable');
    const raw = target.getItem(WHITEBOARD_STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved.version !== 1 || !Array.isArray(saved.boards) || !saved.boards.every(validBoard)) throw new Error('Unreadable board data');
      boards = saved.boards;
    }
  } catch {
    writable = false;
    report('error', '本地存储无法读取；本次板书仅暂存内存，刷新后会丢失');
  }
  function flush() {
    clearTimeout(timer); timer = null;
    if (!writable || disposed) return false;
    try {
      target.setItem(WHITEBOARD_STORAGE_KEY, JSON.stringify({ version: 1, boards }));
      report('saved', '已保存到当前浏览器'); return true;
    } catch {
      // Keep the complete in-memory copy; quota/privacy failures must stay visible.
      report('error', '保存失败；本次更改仅暂存内存，刷新后可能丢失'); return false;
    }
  }
  return {
    list: () => clone(boards).sort((a, b) => b.updatedAt - a.updatedAt),
    get: id => clone(boards.find(board => board.id === id) || null),
    find: contextKey => clone(boards.filter(board => board.contextKey === contextKey).sort((a, b) => b.updatedAt - a.updatedAt)[0] || null),
    save(board) {
      if (disposed || !validBoard(board)) return false;
      const index = boards.findIndex(row => row.id === board.id);
      if (index < 0) boards.push(clone(board)); else boards[index] = clone(board);
      clearTimeout(timer);
      if (writable) { report('saving', '正在保存板书…'); timer = setTimeout(flush, 220); }
      return true;
    },
    flush,
    get status() { return clone(status); },
    destroy() { flush(); disposed = true; clearTimeout(timer); },
  };
}
