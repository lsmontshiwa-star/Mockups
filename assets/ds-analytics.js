/* Digital Switch site analytics (31 Oct 2026). Cloudflare Web Analytics: cookie-free, no consent banner.
   Turned on by putting the site token below; until then this file does nothing. Skips Lethabo's and callers' devices. */
(function(){
  var TOKEN = '';
  if (!TOKEN) return;
  try { if (localStorage.getItem('ds-desk-key') || localStorage.getItem('dsc-key')) return; } catch (e) {}
  var s = document.createElement('script');
  s.defer = true; s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  s.setAttribute('data-cf-beacon', JSON.stringify({ token: TOKEN }));
  document.head.appendChild(s);
})();
