/**
 * 回填 `_openid` 脚本
 *
 * 背景：云开发「仅创建者可读写」权限依赖记录内的 `_openid` 字段判定创建者。
 * 该字段只有小程序端写入时自动生成；云函数端写入不会自动带，需手动补充。
 * 早期版本写入的 group_members / checkins 缺少 `_openid`，需用本脚本回填为
 * 各记录自身的 openid 字段值。
 *
 * 用法（二选一）：
 *   A. 云开发控制台 → 数据库 → 「数据库脚本」→ 新建脚本 → 粘贴本文件内容 → 运行
 *   B. 作为一次性云函数部署运行（需 wx-server-sdk 环境），跑完可删除
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const COLLECTIONS = ['group_members', 'checkins']

async function main() {
  for (const coll of COLLECTIONS) {
    let total = 0
    const seen = new Set()
    while (true) {
      const res = await db.collection(coll)
        .where({ _openid: _.exists(false) })
        .limit(100)
        .get()
      if (!res.data.length) break
      let changed = false
      for (const doc of res.data) {
        if (seen.has(doc._id)) continue
        seen.add(doc._id)
        if (doc.openid) {
          await db.collection(coll).doc(doc._id).update({
            data: { _openid: doc.openid }
          })
          total++
          changed = true
        }
      }
      if (!changed) break
    }
    console.log(`[backfill] ${coll} 回填 ${total} 条`)
  }
  return { code: 0, message: 'done' }
}

if (require.main === module) {
  main().then(console.log).catch(err => {
    console.error(err)
    process.exit(1)
  })
}

exports.main = main
