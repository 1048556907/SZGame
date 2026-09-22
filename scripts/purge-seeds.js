const initSqlJs = require('sql.js')
const fs = require('fs')
const path = require('path')

;(async () => {
  const SQL = await initSqlJs()
  const dbPath = path.join(process.env.APPDATA, 'SZGame', 'szgame.db')
  const db = new SQL.Database(new Uint8Array(fs.readFileSync(dbPath)))

  // 清理种子数据
  const del = db.exec(
    "DELETE FROM games WHERE name IN ('Counter-Strike 2','艾尔登法环','DOTA 2') AND launch_path LIKE 'steam://rungameid/%'"
  )
  const affected = (del[0]?.rowsAffected ?? 0)
  console.log('✓ 删除种子示例游戏:', affected, '条')

  // 查剩余种子名（可能有非 rungameid 的）
  const leftover = db.exec("SELECT name, COUNT(*) FROM games WHERE name IN ('Counter-Strike 2','艾尔登法环','DOTA 2') GROUP BY name")
  if (leftover[0]?.values?.length) {
    leftover[0].values.forEach(r => console.log('  残留:', r[0], 'x' + r[1]))
  }

  // 清理 db.seeded
  db.exec("DELETE FROM settings WHERE key='db.seeded'")

  // 回写
  const data = db.export()
  fs.writeFileSync(dbPath, Buffer.from(data))
  const total = db.exec('SELECT COUNT(*) FROM games')[0].values[0][0]
  console.log('\n清理后总游戏数:', total)
  db.close()
  console.log('✓ DB 已保存')
})()
