// 滚动渐入的渐进增强：内容默认可见，仅在脚本运行且用户未开启“减少动态效果”时添加入场动画。
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const targets = document.querySelectorAll<HTMLElement>('.reveal');

if (!prefersReducedMotion && targets.length > 0 && 'IntersectionObserver' in window) {
  document.documentElement.classList.add('reveal-ready');
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
  );
  targets.forEach((target) => observer.observe(target));
}
