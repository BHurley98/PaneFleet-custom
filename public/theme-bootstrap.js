try {
  document.documentElement.dataset.theme = window.localStorage.getItem('host-control:theme') === 'night'
    ? 'night'
    : 'light';
} catch {
  document.documentElement.dataset.theme = 'light';
}
