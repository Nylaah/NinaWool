// Génère les icônes PWA à partir de public/favicon.svg (à relancer si le logo change) :
//   node scripts/make-icons.cjs      (nécessite playwright)
const { chromium } = require('playwright')
const { readFileSync } = require('node:fs')

;(async () => {
const svg = readFileSync('public/favicon.svg', 'utf8')
const browser = await chromium.launch()
const shot = async (file, size, pad, bg) => {
  const page = await browser.newPage({ viewport: { width: size, height: size } })
  await page.setContent(
    `<body style="margin:0;background:${bg};display:grid;place-items:center;height:100vh">
       <div style="width:${size - pad * 2}px;height:${size - pad * 2}px">${svg}</div></body>`,
  )
  await page.screenshot({ path: `public/${file}`, omitBackground: bg === 'transparent' })
  await page.close()
}
await shot('pwa-192.png', 192, 8, 'transparent')
await shot('pwa-512.png', 512, 20, 'transparent')
await shot('pwa-maskable-512.png', 512, 90, '#FAF5EC')
await shot('apple-touch-icon.png', 180, 22, '#FAF5EC')
await browser.close()
})()
