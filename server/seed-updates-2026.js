const runSeed = require('./seed-runner')

const groups = ['businessCards', 'wideFormat', 'textile', 'flagsProducts', 'advertisingStands',
  'stateSymbols', 'garmentPrinting', 'additionalOperations']

if (require.main === module) runSeed(groups).catch(error => { console.error(error.message); process.exitCode = 1 })
module.exports = groups
