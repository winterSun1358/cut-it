const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { nickName, avatarUrl } = event
  const { OPENID } = cloud.getWXContext()

  if (!OPENID) {
    return { success: false, message: '获取用户身份失败' }
  }

  const updateData = {}
  if (nickName) updateData.nickName = nickName
  if (avatarUrl) updateData.avatarUrl = avatarUrl

  if (Object.keys(updateData).length === 0) {
    return { success: false, message: '没有需要修改的内容' }
  }

  try {
    await db.collection('users').where({ _openid: OPENID }).update({
      data: updateData
    })
    return { success: true, message: '更新成功', ...updateData }
  } catch (err) {
    return { success: false, message: '更新失败' }
  }
}
