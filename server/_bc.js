const d = require('../src/data/pricing.json')
const bc = d.businessCards
console.log('Всего позиций визиток:', bc.length)
console.log('')
for (const b of bc) {
  const p = b.prices
  console.log(`${b.name} [${b.colorType}]: ` +
    `до49=${p.upTo49}, 50-99=${p['50to99']}, 100-299=${p['100to299']}, 300-499=${p['300to499']}, от500=${p.from500} тг/шт`)
}