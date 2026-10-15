"""Build the site: inline the font and logo into src/v2.html, write the manifest and an offline service worker."""
import base64, hashlib, json, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC, OUT = os.path.join(ROOT, 'src'), ROOT
os.makedirs(OUT, exist_ok=True)
font = base64.b64encode(open(os.path.join(SRC, 'oswald-600.woff2'), 'rb').read()).decode()
svg = open(os.path.join(SRC, 'logo.svg')).read()
svg = re.sub(r'\s+width="\d+" height="\d+"', '', svg, count=1)
f64 = lambda n: base64.b64encode(open(os.path.join(SRC, n), 'rb').read()).decode()
html = (open(os.path.join(SRC, 'app.html')).read().replace('{{FONT}}', font).replace('{{LOGO_SVG}}', svg)
        .replace('{{FONT_MONO4}}', f64('ibm-plex-mono-latin-400-normal.woff2')).replace('{{FONT_MONO5}}', f64('ibm-plex-mono-latin-500-normal.woff2'))
        .replace('{{FONT_SERIF}}', f64('instrument-serif-latin-400-italic.woff2')))
open(os.path.join(OUT, 'index.html'), 'w').write(html)
ver = hashlib.sha1(html.encode()).hexdigest()[:10]
manifest = {
    "name": "HOME TEAM FM", "short_name": "HOME TEAM FM", "start_url": "./", "scope": "./",
    "display": "standalone", "orientation": "any", "background_color": "#000000", "theme_color": "#000000",
    "icons": [{"src": "icon-192.png", "sizes": "192x192", "type": "image/png"},
              {"src": "icon-512.png", "sizes": "512x512", "type": "image/png"},
              {"src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}]}
open(os.path.join(OUT, 'manifest.webmanifest'), 'w').write(json.dumps(manifest, indent=1))
sw = """const CACHE = 'htfm-%s';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('htfm-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // network first for the page so updates arrive when online, cache fallback offline
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put('./index.html', cp)); return r; })
      .catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.match(e.request, {ignoreSearch: true}).then(r => r || fetch(e.request)));
});
""" % ver
open(os.path.join(OUT, 'sw.js'), 'w').write(sw)
print('built index.html', len(html) // 1024, 'KB, cache', ver)
