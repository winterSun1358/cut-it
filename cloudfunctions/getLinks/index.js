const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { page = 0, pageSize = 20, platform = '' } = event
  const { OPENID } = cloud.getWXContext()

  const now = new Date()

  // 查询 active 状态的链接，在代码层过滤已过期的（兼容无 expiresAt 的老数据）
  const query = { status: 'active' }
  if (platform) query.platform = platform

  const result = await db.collection('links')
    .where(query)
    .orderBy('createdAt', 'desc')
    .skip(page * pageSize)
    .limit(pageSize)
    .get()

  // 过滤掉已过期的
  const links = (result.data || []).filter(l => {
    if (!l.expiresAt) return true // 老数据无过期时间，视为有效
    return l.expiresAt > now
  })

  // 查询发布者信息
  const userIds = [...new Set(links.map(l => l._openid))]
  const users = userIds.length > 0 ? await db.collection('users')
    .where({ _openid: db.command.in(userIds) })
    .field({ _openid: true, nickName: true, avatarUrl: true })
    .get() : { data: [] }
  const userMap = {}
  users.data.forEach(u => { userMap[u._openid] = u })

  // 查询当前用户已复制过的链接
  const copiedRecords = links.length > 0 ? await db.collection('records')
    .where({ copierOpenid: OPENID, linkId: db.command.in(links.map(l => l._id)) })
    .get() : { data: [] }
  const copiedLinkIds = new Set(copiedRecords.data.map(r => r.linkId))

  const linkList = links.map(l => ({
    _id: l._id,
    _openid: l._openid,
    title: l.title,
    url: l.url,
    platform: l.platform || '其他',
    publisher: userMap[l._openid] ? userMap[l._openid].nickName : '未知用户',
    publisherAvatar: userMap[l._openid] ? userMap[l._openid].avatarUrl : '',
    createdAt: l.createdAt,
    copied: copiedLinkIds.has(l._id)
  }))

  // 将 cloud:// 头像 ID 转为可公开访问的临时 URL
  const cloudAvatarLinks = linkList
    .map(l => l.publisherAvatar)
    .filter(url => url && url.startsWith('cloud://'))
  if (cloudAvatarLinks.length > 0) {
    try {
      const { fileList } = await cloud.getTempFileURL({ fileList: cloudAvatarLinks })
      const urlMap = {}
      fileList.forEach(f => { urlMap[f.fileID] = f.tempFileURL })
      linkList.forEach(l => {
        if (urlMap[l.publisherAvatar]) l.publisherAvatar = urlMap[l.publisherAvatar]
      })
    } catch (e) {
      // 降级：保持原值
    }
  }

  return { success: true, data: linkList }
}
