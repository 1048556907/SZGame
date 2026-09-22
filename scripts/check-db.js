const initSqlJs = require('sql.js')
const fs = require('fs')
const path = require('path')

;(async () => {
  const SQL = await initSqlJs()
  const dbPath = path.join(process.env.APPDATA, 'SZGame', 'szgame.db')
  const db = new SQL.Database(new Uint8Array(fs.readFileSync(dbPath)))

  const total = db.exec('SELECT COUNT(*) FROM games')[0].values[0][0]
  const seeds = db.exec("SELECT name, COUNT(*) FROM games WHERE name IN ('Counter-Strike 2','艾尔登法环','DOTA 2') GROUP BY name")

  console.log('=== SZGame DB 状态 ===')
  console.log('总游戏数:', total)
  if (seeds[0]?.values?.length) {
    seeds[0].values.forEach(r => console.log('  种子残留:', r[0], 'x' + r[1]))
    console.log('⚠️ 旧 exe 生成的种子数据还在，下次启动新 exe 会自动 purgeLegacySeedGames 清掉')
  } else {
    console.log('✓ 种子示例数据: 干净')
  }

  // 封面格式检查
  const covers = db.exec("SELECT substr(cover_image,1,30) FROM games WHERE cover_image IS NOT NULL LIMIT 5")
  console.log('\n封面存储格式抽样 (前30字符):')
  if (covers[0]) {
    covers[0].values.forEach(r => console.log(' ', r[0] + '...'))
  } else {
    console.log('  (无封面)')
  }
  db.close()
})()
