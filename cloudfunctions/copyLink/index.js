const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { linkId, publisherOpenid } = event
  const { OPENID } = cloud.getWXContext()

  if (!OPENID) {
    return { success: false, message: '获取用户身份失败' }
  }

  // 检查用户是否被封禁
  const banCheck = await db.collection('users').where({ _openid: OPENID }).get()
  if (banCheck.data.length > 0 && banCheck.data[0].banned) {
    return { success: false, message: '账号已被封禁', banned: true }
  }

  if (OPENID === publisherOpenid) {
    return { success: false, message: '不能复制自己的链接' }
  }

  // 检查是否已经复制过这条链接
  const existing = await db.collection('records').where({
    linkId,
    copierOpenid: OPENID
  }).get()

  if (existing.data.length > 0) {
    return { success: false, message: '你已经复制过这条链接了' }
  }

  try {
    // 记录复制行为
    await db.collection('records').add({
      data: {
        linkId,
        copierOpenid: OPENID,
        publisherOpenid,
        copiedAt: db.serverDate()
      }
    })

    // 给复制者增加额度
    await db.collection('users').where({ _openid: OPENID }).update({
      data: { quota: db.command.inc(1) }
    })

    const userResult = await db.collection('users').where({ _openid: OPENID }).get()

    return {
      success: true,
      message: '复制成功，已获得1次额度！',
      quota: userResult.data[0].quota
    }
  } catch (err) {
    return { success: false, message: '操作失败，请重试' }
  }
}
