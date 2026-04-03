import { createCanvas } from 'canvas'
import { writeFileSync } from 'fs'

const sizes = [192, 512]

for (const size of sizes) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')
  const s = size / 680

  // 배경
  ctx.fillStyle = '#f97316'
  roundRect(ctx, 140*s, 140*s, 400*s, 400*s, 90*s)
  ctx.fill()

  // 바벨
  ctx.fillStyle = 'white'
  roundRect(ctx, 200*s, 326*s, 280*s, 28*s, 14*s); ctx.fill()
  roundRect(ctx, 196*s, 256*s, 44*s, 168*s, 12*s); ctx.fill()
  roundRect(ctx, 168*s, 284*s, 30*s, 112*s, 8*s); ctx.fill()
  roundRect(ctx, 152*s, 304*s, 18*s, 72*s, 6*s); ctx.fill()
  roundRect(ctx, 440*s, 256*s, 44*s, 168*s, 12*s); ctx.fill()
  roundRect(ctx, 482*s, 284*s, 30*s, 112*s, 8*s); ctx.fill()
  roundRect(ctx, 510*s, 304*s, 18*s, 72*s, 6*s); ctx.fill()

  writeFileSync(`public/icon-${size}.png`, canvas.toBuffer('image/png'))
  console.log(`icon-${size}.png 생성 완료`)
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}
