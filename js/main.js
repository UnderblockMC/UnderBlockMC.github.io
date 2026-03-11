
document.querySelectorAll('[data-copy]').forEach(btn => {
  btn.addEventListener('click', async () => {
    const text = btn.getAttribute('data-copy');
    try {
      await navigator.clipboard.writeText(text);
      const original = btn.textContent;
      btn.textContent = 'Copied';
      setTimeout(() => btn.textContent = original, 1200);
    } catch {
      btn.textContent = text;
    }
  });
});
