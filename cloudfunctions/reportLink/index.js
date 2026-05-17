const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { linkId, reason } = event
  const { OPENID } = cloud.getWXContext()

  if (!OPENID) {
    return { success: false, message: '获取用户身份失败' }
  }

  if (!linkId || !reason) {
    return { success: false, message: '参数不完整' }
  }

  try {
    // 查询链接信息
    const link = await db.collection('links').doc(linkId).get()
    if (!link.data) {
      return { success: false, message: '链接不存在' }
    }

    // 写入举报记录
    await db.collection('reports').add({
      data: {
        linkId,
        linkPublisherOpenid: link.data._openid,
        reporterOpenid: OPENID,
        reason,
        status: 'pending',
        createdAt: db.serverDate()
      }
    })

    return { success: true, message: '举报已提交，我们会尽快处理' }
  } catch (err) {
    return { success: false, message: '举报提交失败，请重试' }
  }
}
