export {};
const button = document.querySelector<HTMLButtonElement>('[data-copy-email]');
const status = document.querySelector<HTMLElement>('.copy-status');
if (button && status) {
  button.hidden = false;
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(button.dataset.copyEmail ?? '');
      status.textContent = '邮箱已复制。';
    } catch {
      status.textContent = '暂时无法复制，请选择上方邮箱文字手动复制。';
    }
  });
}

