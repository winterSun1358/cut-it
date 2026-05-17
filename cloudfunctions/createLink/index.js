const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { title, url, platform, expireHours } = event
  const { OPENID } = cloud.getWXContext()

  if (!OPENID) return { success: false, message: '获取用户身份失败' }
  if (!title || !url) return { success: false, message: '标题和链接不能为空' }
  if (!platform) return { success: false, message: '请选择所属平台' }
  if (!expireHours) return { success: false, message: '请选择口令有效期' }

  // 检查封禁
  const banCheck = await db.collection('users').where({ _openid: OPENID }).get()
  if (banCheck.data.length > 0 && banCheck.data[0].banned) {
    return { success: false, message: '账号已被封禁', banned: true }
  }

  // 内容安全审核
  try {
    await cloud.openapi.security.msgSecCheck({ content: title })
  } catch (err) {
    if (err.errCode === 87014) return { success: false, message: '标题包含违规内容' }
  }

  // 检查额度
  const userResult = await db.collection('users').where({ _openid: OPENID }).get()
  if (userResult.data.length === 0) return { success: false, message: '用户不存在' }
  if (userResult.data[0].quota <= 0) return { success: false, message: '额度不足' }

  // 计算过期时间
  const expiresAt = new Date(Date.now() + expireHours * 60 * 60 * 1000)

  try {
    await db.collection('users').where({ _openid: OPENID }).update({
      data: { quota: db.command.inc(-1) }
    })

    await db.collection('links').add({
      data: {
        _openid: OPENID,
        title,
        url,
        platform,
        status: 'active',
        expireHours,
        expiresAt,
        createdAt: db.serverDate()
      }
    })

    return { success: true, message: '发布成功' }
  } catch (err) {
    return { success: false, message: '发布失败，请重试' }
  }
}
