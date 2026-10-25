const runSeed = require('./seed-runner')
const { seedCatalog } = require('./seed-catalog-data')
const groups = ['advertisingStands', 'additionalOperations']

if (require.main === module) runSeed(groups).catch(error => { console.error(error.message); process.exitCode = 1 })
module.exports = (pool) => seedCatalog(pool, { groups })
