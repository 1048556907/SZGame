const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

(async () => {
  const SQL = await initSqlJs();
  const dbPath = path.join(process.env.APPDATA, 'SZGame', 'szgame.db');
  const buf = fs.readFileSync(dbPath);
  const db = new SQL.Database(new Uint8Array(buf));

  console.log('=== SZGame DB 诊断 ===');
  const total = db.exec('SELECT COUNT(*) FROM games')[0].values[0][0];
  console.log('总游戏数:', total);

  // 示例数据的 name 特征（steam:// 开头 + 常见游戏名）
  const seedGames = ['Counter-Strike 2', '艾尔登法环', 'DOTA 2'];
  for (const name of seedGames) {
    const rows = db.exec(`SELECT id, name, launch_path FROM games WHERE name = '${name}'`);
    console.log(`\n${name}: ${rows[0]?.values.length ?? 0} 条`);
    for (const r of rows[0]?.values ?? []) console.log(`  id=${r[0]} path=${r[2]}`);
  }

  // db.seeded 设置存在吗
  const seeded = db.exec("SELECT value FROM settings WHERE key='db.seeded'");
  console.log('\ndb.seeded:', seeded[0]?.values[0]?.[0] ?? '(缺失)');

  // 清理：对每个 seed 游戏，只保留 id 最小的那条（最早插入的），删除其余重复
  let deleted = 0;
  for (const name of seedGames) {
    const rs = db.exec(`SELECT id FROM games WHERE name = '${name}' ORDER BY id ASC`);
    const ids = rs[0]?.values.map(r => r[0]) ?? [];
    if (ids.length > 1) {
      const keep = ids[0];
      const remove = ids.slice(1);
      for (const id of remove) {
        db.run(`DELETE FROM games WHERE id = ${id}`);
        deleted++;
      }
      console.log(`\n清理 ${name}: 保留 id=${keep}, 删除 ${remove.join(', ')}`);
    }
  }

  // 写回 seeded 守卫（防止后续版本重复执行 SEED_SQL）
  if (!seeded[0]?.values.length) {
    db.run("INSERT INTO settings (key, value) VALUES ('db.seeded', '1')");
    console.log('\n补写 db.seeded = 1');
  }

  // 持久化
  const out = db.export();
  fs.writeFileSync(dbPath, Buffer.from(out));
  const afterTotal = db.exec('SELECT COUNT(*) FROM games')[0].values[0][0];
  console.log('\n=== 清理完成 ===');
  console.log('删除重复:', deleted, '条');
  console.log('剩余游戏:', afterTotal, '条');
  db.close();
})();
