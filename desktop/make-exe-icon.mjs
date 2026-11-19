import fs from 'node:fs'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'
import rceditImport from 'rcedit'
const rcedit = rceditImport.default || rceditImport.rcedit || rceditImport
const svg = fs.readFileSync('logo.svg')
const sizes = [16,24,32,48,64,128,256]
const bufs = []
for (const s of sizes) {
  bufs.push(await sharp(svg).resize(s,s,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer())
}
const ico = await pngToIco(bufs)
fs.writeFileSync('dist/Beam Agent/resources/app.ico', ico)
fs.writeFileSync('dist/Beam Agent/resources/tray.ico', ico)
fs.writeFileSync('dist/Beam Agent/resources/icon.png', bufs[bufs.length-1])
await rcedit('dist/Beam Agent/Beam Agent.exe', {
  icon: 'dist/Beam Agent/resources/app.ico',
  'product-version': '0.1.8',
  'file-version': '0.1.6.0',
  'version-string': {
    ProductName: 'Beam Agent',
    FileDescription: 'Beam Agent',
    ProductVersion: '0.1.8',
    FileVersion: '0.1.6.0',
    InternalName: 'Beam Agent',
    OriginalFilename: 'Beam Agent.exe',
    CompanyName: 'ASSISTIX',
    LegalCopyright: 'ASSISTIX',
  },
})
console.log('exe icon + ProductName/version set', ico.length)
