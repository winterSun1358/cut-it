const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const now = new Date()

  const result = await db.collection('links')
    .where({ _openid: OPENID })
    .orderBy('createdAt', 'desc')
    .get()

  const links = (result.data || []).map(l => {
    // 计算动态状态
    let status = l.status
    if (status === 'active' && l.expiresAt && l.expiresAt <= now) {
      status = 'expired'
    }
    return {
      _id: l._id,
      title: l.title,
      url: l.url,
      platform: l.platform,
      status,
      expireHours: l.expireHours,
      expiresAt: l.expiresAt,
      createdAt: l.createdAt
    }
  })

  return { success: true, data: links }
}
