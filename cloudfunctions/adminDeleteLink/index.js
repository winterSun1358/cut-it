const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { linkId } = event
  const { OPENID } = cloud.getWXContext()

  if (!OPENID || !linkId) {
    return { success: false, message: '参数不完整' }
  }

  // 验证管理员身份
  const user = await db.collection('users').where({ _openid: OPENID }).get()
  if (user.data.length === 0 || !user.data[0].isAdmin) {
    return { success: false, message: '无权限执行此操作' }
  }

  // 删除链接（软删除，将 status 改为 deleted）
  try {
    await db.collection('links').doc(linkId).update({
      data: { status: 'deleted' }
    })
    return { success: true, message: '已删除' }
  } catch (err) {
    return { success: false, message: '删除失败' }
  }
}
