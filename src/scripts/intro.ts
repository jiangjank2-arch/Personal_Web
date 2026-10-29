// 入场加载动画：仅在页面带有 intro-ready 类时运行；进度与淡出均由脚本驱动，
// 减少动态效果或脚本失败时不会出现（见 BaseLayout 中的内联兜底）。
const root = document.documentElement;
const overlay = document.querySelector<HTMLElement>('[data-intro]');

if (overlay && root.classList.contains('intro-ready')) {
  const counter = overlay.querySelector<HTMLElement>('[data-intro-count]');
  const bar = overlay.querySelector<HTMLElement>('[data-intro-bar]');
  let finished = false;

  const finish = () => {
    if (finished) return;
    finished = true;
    overlay.classList.add('is-leaving');
    root.classList.remove('intro-ready');
    window.setTimeout(() => overlay.remove(), 700);
  };

  overlay.addEventListener('click', finish);

  const DURATION = 1800;
  const start = performance.now();
  const tick = (now: number) => {
    const progress = Math.min((now - start) / DURATION, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    if (counter) counter.textContent = `${Math.round(eased * 100)}%`;
    if (bar) bar.style.transform = `scaleX(${eased})`;
    if (progress < 1) requestAnimationFrame(tick);
    else window.setTimeout(finish, 280);
  };
  requestAnimationFrame(tick);
}
