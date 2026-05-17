const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()

  if (!OPENID) {
    return { success: false, message: '获取用户身份失败' }
  }

  // 验证管理员身份
  const user = await db.collection('users').where({ _openid: OPENID }).get()
  if (user.data.length === 0 || !user.data[0].isAdmin) {
    return { success: false, message: '无权限' }
  }

  try {
    // 获取所有 pending 状态的举报
    const reports = await db.collection('reports')
      .orderBy('createdAt', 'desc')
      .get()

    // 按 linkId 聚合
    const reportMap = {}
    for (const r of reports.data || []) {
      if (!reportMap[r.linkId]) {
        reportMap[r.linkId] = {
          linkId: r.linkId,
          linkPublisherOpenid: r.linkPublisherOpenid,
          count: 0,
          reasons: [],
          reporters: [],
          firstReportedAt: r.createdAt,
          lastReportedAt: r.createdAt
        }
      }
      reportMap[r.linkId].count++
      reportMap[r.linkId].reasons.push(r.reason)
      reportMap[r.linkId].reporters.push(r.reporterOpenid)
      if (r.createdAt > reportMap[r.linkId].lastReportedAt) {
        reportMap[r.linkId].lastReportedAt = r.createdAt
      }
    }

    const linkIds = Object.keys(reportMap)
    if (linkIds.length === 0) {
      return { success: true, data: [] }
    }

    // 查询关联的链接信息
    const links = await db.collection('links')
      .where({ _id: db.command.in(linkIds) })
      .field({ _id: true, title: true, url: true, platform: true, _openid: true, status: true })
      .get()

    const linkMap = {}
    links.data.forEach(l => { linkMap[l._id] = l })

    // 查询关联的发布者信息和举报人信息
    const allOpenids = new Set()
    linkIds.forEach(id => {
      allOpenids.add(reportMap[id].linkPublisherOpenid)
      reportMap[id].reporters.forEach(rid => allOpenids.add(rid))
    })

    const users = await db.collection('users')
      .where({ _openid: db.command.in([...allOpenids]) })
      .field({ _openid: true, nickName: true, avatarUrl: true })
      .get()

    const userMap = {}
    users.data.forEach(u => { userMap[u._openid] = u })

    // 统计每个链接各原因的次数
    const result = linkIds.map(id => {
      const info = reportMap[id]
      const link = linkMap[id] || {}
      const reasonCount = {}
      info.reasons.forEach(r => {
        reasonCount[r] = (reasonCount[r] || 0) + 1
      })

      return {
        linkId: id,
        linkTitle: link.title || '已删除',
        linkUrl: link.url || '',
        linkPlatform: link.platform || '',
        linkStatus: link.status || 'deleted',
        linkPublisher: userMap[info.linkPublisherOpenid]?.nickName || '未知',
        linkPublisherAvatar: userMap[info.linkPublisherOpenid]?.avatarUrl || '',
        count: info.count,
        reasons: Object.entries(reasonCount).map(([reason, cnt]) => ({ reason, count: cnt })),
        reporters: info.reporters.map(rid => ({
          openid: rid,
          nickName: userMap[rid]?.nickName || '未知'
        })),
        firstReportedAt: info.firstReportedAt,
        lastReportedAt: info.lastReportedAt
      }
    })

    // 按举报次数降序排列
    result.sort((a, b) => b.count - a.count)

    return { success: true, data: result }
  } catch (err) {
    return { success: false, message: '获取失败' }
  }
}
