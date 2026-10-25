const runSeed = require('./seed-runner')

if (require.main === module) runSeed().catch(error => { console.error(error.message); process.exitCode = 1 })
module.exports = require('./seed-catalog-data').seedCatalog
