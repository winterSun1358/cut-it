const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()

  if (!OPENID) {
    return { success: false, message: '获取用户身份失败' }
  }

  // 检查用户是否被封禁
  const banCheck = await db.collection('users').where({ _openid: OPENID }).get()
  if (banCheck.data.length > 0 && banCheck.data[0].banned) {
    return { success: false, message: '账号已被封禁', banned: true }
  }

  const { nickName, avatarUrl } = event

  // 查找用户是否已存在
  let user = await db.collection('users').where({ _openid: OPENID }).get()

  if (user.data.length === 0) {
    // 新用户，创建记录并分配初始额度
    await db.collection('users').add({
      data: {
        _openid: OPENID,
        nickName: nickName || '微信用户',
        avatarUrl: avatarUrl || '',
        quota: 10,
        banned: false,
        createdAt: db.serverDate()
      }
    })

    return {
      success: true,
      isNewUser: true,
      openid: OPENID,
      user: {
        nickName: nickName || '微信用户',
        avatarUrl: avatarUrl || '',
        quota: 10,
        banned: false
      }
    }
  }

  // 老用户，返回已有数据
  const userData = user.data[0]
  return {
    success: true,
    isNewUser: false,
    openid: OPENID,
    user: {
      nickName: userData.nickName,
      avatarUrl: userData.avatarUrl,
      quota: userData.quota,
      banned: userData.banned || false,
      isAdmin: userData.isAdmin || false
    }
  }
}
