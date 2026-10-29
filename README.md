# Grok Bot · AI Office

Static Three.js page served by nginx in Docker, bound to 127.0.0.1 only,
published to the tailnet with `tailscale serve` (HTTPS, tailnet-only — no Funnel).

    site/config.js     ← crew + script (edit this)
    site/app.js        ← scene, HUD, script engine
    site/style.css     ← look of the panels
    site/index.html
    site/vendor/       ← three.js r170 + addons (no CDN needed)
    site/fonts/        ← Geist Mono, Orbitron
    docker-compose.yml ← nginx:alpine, 127.0.0.1:${BOT_OFFICE_PORT}:80
    nginx.conf

Edit crew/script: `nano site/config.js`, then reload the browser.
(Mounted read-only into nginx; no restart or rebuild needed.)

URL params: `?t=30` jump to second 30 of the script · `?tod=day|dusk|night|now`

Ops:
    docker compose up -d      # start / update
    docker compose logs -f                          # logs
    tailscale serve status                          # see the HTTPS mapping
    tailscale serve --https=7443 off                # unpublish

Setup:
    cp .env.example .env          # set BOT_OFFICE_PORT
    docker compose up -d
    tailscale serve --bg --https=7443 http://127.0.0.1:8095

Third-party: three.js (MIT) in site/vendor/, Geist Mono and Orbitron (SIL OFL 1.1) in site/fonts/.
