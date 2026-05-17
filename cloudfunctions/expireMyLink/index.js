const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { linkId } = event
  const { OPENID } = cloud.getWXContext()

  if (!OPENID || !linkId) {
    return { success: false, message: '参数不完整' }
  }

  try {
    const link = await db.collection('links').doc(linkId).get()
    if (!link.data) {
      return { success: false, message: '链接不存在' }
    }
    if (link.data._openid !== OPENID) {
      return { success: false, message: '只能操作自己的链接' }
    }
    if (link.data.status !== 'active') {
      return { success: false, message: '只有进行中的链接可以设为失效' }
    }

    await db.collection('links').doc(linkId).update({
      data: { status: 'expired' }
    })
    return { success: true, message: '已设为失效' }
  } catch (err) {
    return { success: false, message: '操作失败' }
  }
}
