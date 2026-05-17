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
      return { success: false, message: '只能删除自己的链接' }
    }

    await db.collection('links').doc(linkId).remove()
    return { success: true, message: '已删除' }
  } catch (err) {
    return { success: false, message: '删除失败' }
  }
}
