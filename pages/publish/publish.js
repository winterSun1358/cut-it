const app = getApp()

const PLATFORMS = ['拼多多', '抖音', '淘宝', '京东', '快手', '小红书', '其他']
const EXPIRE_OPTIONS = [
  { label: '1 小时', hours: 1 },
  { label: '6 小时', hours: 6 },
  { label: '12 小时', hours: 12 },
  { label: '24 小时', hours: 24 },
  { label: '3 天', hours: 72 },
  { label: '7 天', hours: 168 }
]

Page({
  data: {
    platforms: PLATFORMS,
    platformIndex: -1,
    platform: '',
    expireOptions: EXPIRE_OPTIONS,
    expireIndex: -1,
    expireHours: 0,
    title: '',
    url: '',
    quota: 0,
    submitting: false,
    activeTab: 1,
    isAdmin: false,
    statusBarHeight: app.globalData.statusBarHeight || 44
  },

  onLoad() {
    this.setData({
      quota: app.globalData.quota || 0,
      isAdmin: app.globalData.userInfo?.isAdmin || false
    })
  },

  onShow() {
    this.setData({
      quota: app.globalData.quota || 0,
      isAdmin: app.globalData.userInfo?.isAdmin || false
    })
  },

  onTitleInput(e) { this.setData({ title: e.detail.value }) },
  onUrlInput(e) { this.setData({ url: e.detail.value }) },

  onPlatformChange(e) {
    const idx = e.detail.value
    this.setData({ platformIndex: idx, platform: PLATFORMS[idx] })
  },

  onExpireChange(e) {
    const idx = e.detail.value
    this.setData({ expireIndex: idx, expireHours: EXPIRE_OPTIONS[idx].hours })
  },

  switchTab(e) {
    const idx = parseInt(e.currentTarget.dataset.index)
    if (idx === 1) return
    wx.reLaunch({ url: ['/pages/index/index', '/pages/publish/publish', '/pages/profile/profile'][idx] })
  },

  async onSubmit() {
    const { title, url, platform, expireHours } = this.data

    if (!title.trim()) { wx.showToast({ title: '请输入链接标题', icon: 'none' }); return }
    if (!url.trim()) { wx.showToast({ title: '请输入助力口令', icon: 'none' }); return }
    if (!platform) { wx.showToast({ title: '请选择所属平台', icon: 'none' }); return }
    if (!expireHours) { wx.showToast({ title: '请选择口令有效期', icon: 'none' }); return }
    if (!app.globalData.userInfo?.isAdmin && app.globalData.quota <= 0) { wx.showToast({ title: '额度不足', icon: 'none' }); return }

    this.setData({ submitting: true })

    try {
      const res = await wx.cloud.callFunction({
        name: 'createLink',
        data: { title: title.trim(), url: url.trim(), platform, expireHours }
      })

      if (res.result.success) {
        if (!app.globalData.userInfo?.isAdmin) {
          app.globalData.quota = (app.globalData.quota || 0) - 1
        }
        wx.showToast({ title: '发布成功！', icon: 'success' })
        setTimeout(() => wx.reLaunch({ url: '/pages/index/index' }), 1000)
      } else {
        wx.showToast({ title: res.result.message, icon: 'none' })
      }
    } catch (err) {
      wx.showToast({ title: '发布失败', icon: 'error' })
    }

    this.setData({ submitting: false })
  }
})
