export {};

const root = document.querySelector<HTMLElement>('[data-pointer-effects]');
if (root) {
  const glow = root.querySelector<HTMLElement>('[data-pointer-glow]')!;
  const orbit = root.querySelector<HTMLElement>('[data-pointer-orbit]')!;
  const position = root.querySelector<HTMLElement>('[data-pointer-position]')!;
  const ripple = root.querySelector<HTMLElement>('[data-pointer-ripple]')!;
  const particles = [...root.querySelectorAll<HTMLElement>('.pointer-particle')];
  const preference = matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
  const interactiveSelector = 'a[href], button:not(:disabled), [role="button"], summary';
  const quietSelector = '.prose, input, textarea, select, [contenteditable="true"]';
  let controller: AbortController | undefined;
  let frame = 0;
  let x = 0;
  let y = 0;
  let ringX = 0;
  let ringY = 0;
  let glowX = 0;
  let glowY = 0;
  let visible = false;
  let quiet = false;
  let lastSparkAt = 0;
  let sparkX = 0;
  let sparkY = 0;
  let particleIndex = 0;

  const place = (element: HTMLElement, left: number, top: number) => {
    element.style.transform = 'translate3d(' + left.toFixed(1) + 'px,' + top.toFixed(1) + 'px,0)';
  };
  const cancelAnimations = () => {
    for (const element of [...particles, ripple]) element.getAnimations().forEach((animation) => animation.cancel());
  };
  const hide = () => {
    visible = false;
    root.hidden = true;
    root.classList.remove('is-hovering', 'is-reading');
    cancelAnimationFrame(frame);
    frame = 0;
    cancelAnimations();
  };
  const paint = () => {
    frame = 0;
    if (!visible || !preference.matches || document.hidden) return;
    ringX += (x - ringX) * 0.22;
    ringY += (y - ringY) * 0.22;
    glowX += (x - glowX) * 0.12;
    glowY += (y - glowY) * 0.12;
    place(position, x, y);
    place(orbit, ringX, ringY);
    place(glow, glowX, glowY);
    if (Math.abs(x - glowX) + Math.abs(y - glowY) + Math.abs(x - ringX) + Math.abs(y - ringY) > 0.4) {
      frame = requestAnimationFrame(paint);
    }
  };
  const spark = (left: number, top: number, dx: number, dy: number, duration: number) => {
    const particle = particles[particleIndex++ % particles.length]!;
    particle.getAnimations().forEach((animation) => animation.cancel());
    particle.style.left = left + 'px';
    particle.style.top = top + 'px';
    particle.animate([
      { transform: 'translate(-50%,-50%) scale(1)', opacity: 0.7 },
      { transform: 'translate(calc(-50% + ' + dx + 'px),calc(-50% + ' + dy + 'px)) scale(0.15)', opacity: 0 },
    ], { duration, easing: 'cubic-bezier(0.16,1,0.3,1)', fill: 'none' });
  };
  const move = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse' || document.hidden) return;
    x = event.clientX;
    y = event.clientY;
    const target = event.target instanceof Element ? event.target : null;
    quiet = Boolean(target?.closest(quietSelector));
    root.classList.toggle('is-hovering', Boolean(target?.closest(interactiveSelector)) && !quiet);
    root.classList.toggle('is-reading', quiet);
    if (!visible) {
      ringX = glowX = sparkX = x;
      ringY = glowY = sparkY = y;
      visible = true;
      root.hidden = false;
    }
    if (!frame) frame = requestAnimationFrame(paint);
    if (!quiet && event.timeStamp - lastSparkAt > 75 && Math.hypot(x - sparkX, y - sparkY) > 24) {
      spark(x - 4, y + 5, -5, 15, 620);
      lastSparkAt = event.timeStamp;
      sparkX = x;
      sparkY = y;
    }
  };
  const click = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse' || event.button !== 0 || !visible || quiet) return;
    ripple.getAnimations().forEach((animation) => animation.cancel());
    ripple.style.left = event.clientX + 'px';
    ripple.style.top = event.clientY + 'px';
    ripple.animate([
      { transform: 'translate(-50%,-50%) scale(0.3)', opacity: 0.65 },
      { transform: 'translate(-50%,-50%) scale(2.5)', opacity: 0 },
    ], { duration: 560, easing: 'cubic-bezier(0.16,1,0.3,1)' });
    for (let index = 0; index < 6; index++) {
      const angle = index * Math.PI / 3;
      spark(event.clientX, event.clientY, Math.cos(angle) * 32, Math.sin(angle) * 32, 600);
    }
  };
  const sync = () => {
    controller?.abort();
    hide();
    root.dataset.enabled = String(preference.matches);
    if (!preference.matches) return;
    controller = new AbortController();
    const options = { signal: controller.signal, passive: true };
    document.addEventListener('pointermove', move, options);
    document.addEventListener('pointerdown', click, options);
    document.addEventListener('pointerout', (event) => { if (!event.relatedTarget) hide(); }, options);
    document.addEventListener('visibilitychange', () => { if (document.hidden) hide(); }, options);
    document.addEventListener('keydown', (event) => { if (event.key === 'Tab') hide(); }, { signal: controller.signal });
    window.addEventListener('blur', hide, options);
  };
  const leavePage = () => { controller?.abort(); hide(); };
  preference.addEventListener('change', sync);
  window.addEventListener('pagehide', leavePage);
  window.addEventListener('pageshow', sync);
  sync();
  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      leavePage();
      preference.removeEventListener('change', sync);
      window.removeEventListener('pagehide', leavePage);
      window.removeEventListener('pageshow', sync);
    });
  }
}

