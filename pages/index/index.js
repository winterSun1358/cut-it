const app = getApp()

const PLATFORM_CLASS = {
  '拼多多': 'pdd',
  '抖音': 'douyin',
  '淘宝': 'taobao',
  '京东': 'jd',
  '快手': 'kuaishou',
  '小红书': 'xiaohongshu',
  '其他': 'qita'
}

const PLATFORMS = [
  { key: '', label: '全部' },
  { key: '拼多多', label: '拼多多' },
  { key: '抖音', label: '抖音' },
  { key: '淘宝', label: '淘宝' },
  { key: '京东', label: '京东' },
  { key: '快手', label: '快手' },
  { key: '小红书', label: '小红书' },
  { key: '其他', label: '其他' }
]

Page({
  data: {
    platforms: PLATFORMS,
    currentPlatform: '',
    links: [],
    quota: 0,
    loggedIn: false,
    isAdmin: false,
    myOpenid: '',
    loading: false,
    refreshing: false,
    page: 0,
    hasMore: true,
    activeTab: 0,
    statusBarHeight: app.globalData.statusBarHeight || 44
  },

  onLoad() {
    this.login()
  },

  onShow() {
    if (this.data.loggedIn) {
      this.loadLinks(true)
      this.loadQuota()
    }
  },

  onPullDownRefresh() {
    this.setData({ refreshing: true })
    this.loadLinks(true, () => {
      this.setData({ refreshing: false })
      wx.stopPullDownRefresh()
    })
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadLinks()
    }
  },

  onSwitchPlatform(e) {
    const platform = e.currentTarget.dataset.key
    this.setData({ currentPlatform: platform, page: 0, links: [] })
    this.loadLinks(true)
  },

  switchTab(e) {
    const idx = parseInt(e.currentTarget.dataset.index)
    if (idx === 0) return
    const pages = ['/pages/index/index', '/pages/publish/publish', '/pages/profile/profile']
    wx.reLaunch({ url: pages[idx] })
  },

  async login() {
    wx.showLoading({ title: '登录中...' })
    try {
      const res = await wx.cloud.callFunction({ name: 'login', data: {} })
      if (res.result.success) {
        app.globalData.userInfo = res.result.user
        app.globalData.quota = res.result.user.quota
        app.globalData.openid = res.result.openid
        this.setData({
          loggedIn: true,
          quota: res.result.user.quota,
          isAdmin: res.result.user.isAdmin || false,
          myOpenid: res.result.openid
        })
        this.loadLinks(true)
      } else {
        wx.showToast({ title: '登录失败', icon: 'error' })
      }
    } catch (err) {
      wx.showToast({ title: '网络错误', icon: 'error' })
    }
    wx.hideLoading()
  },

  async loadLinks(refresh = false, callback) {
    if (this.data.loading) return
    const page = refresh ? 0 : this.data.page
    this.setData({ loading: true })

    try {
      const res = await wx.cloud.callFunction({
        name: 'getLinks',
        data: { page, pageSize: 20, platform: this.data.currentPlatform }
      })
      if (res.result.success) {
        let links = res.result.data || []
        links = links.map(l => ({ ...l, platformClass: PLATFORM_CLASS[l.platform] || 'qita' }))
        this.setData({
          links: refresh ? links : [...this.data.links, ...links],
          page: refresh ? 1 : page + 1,
          hasMore: links.length === 20,
          loading: false
        })
      } else {
        this.setData({ loading: false })
      }
    } catch (err) {
      this.setData({ loading: false })
    }
    if (callback) callback()
  },

  async loadQuota() {
    try {
      const res = await wx.cloud.callFunction({ name: 'login', data: {} })
      if (res.result.success) {
        const quota = res.result.user.quota
        app.globalData.quota = quota
        this.setData({ quota })
      }
    } catch (err) {}
  },

  async onCopyLink(e) {
    const { id: linkId, url, copied, openid: publisherOpenid } = e.currentTarget.dataset

    // 先复制到剪贴板
    try {
      await wx.setClipboardData({ data: url })
    } catch {
      wx.showToast({ title: '复制失败，请重试', icon: 'error' })
      return
    }

    // 已复制过的 → 仅提示，不获取额度
    if (copied) {
      wx.showToast({ title: '已复制，无法重复获取额度', icon: 'none' })
      return
    }

    // 首次复制 → 尝试获取额度
    try {
      const res = await wx.cloud.callFunction({
        name: 'copyLink',
        data: { linkId, publisherOpenid }
      })
      if (res.result.success) {
        this.setData({ quota: res.result.quota })
        app.globalData.quota = res.result.quota
        if (res.result.isOwn) {
          wx.showToast({ title: res.result.message || '复制自己的口令无法增加额度', icon: 'none' })
          return
        }
        const links = this.data.links.map(l => {
          if (l._id === linkId) l.copied = true
          return l
        })
        this.setData({ links })
        wx.showToast({ title: `+1额度！当前${res.result.quota}`, icon: 'success' })
      } else {
        // copyLink 可能因已复制过而拒绝（兜底），但仍标记已复制
        const links = this.data.links.map(l => {
          if (l._id === linkId) l.copied = true
          return l
        })
        this.setData({ links })
        wx.showToast({ title: res.result.message || '已复制，但获取额度失败', icon: 'none' })
      }
    } catch {
      wx.showToast({ title: '已复制，但获取额度失败', icon: 'none' })
    }
  },

  onReport(e) {
    const { id: linkId, title: linkTitle } = e.currentTarget.dataset
    const reasons = ['垃圾广告', '无效链接', '内容违规', '其他']
    wx.showActionSheet({
      itemList: reasons,
      success: (res) => {
        const reason = reasons[res.tapIndex]
        wx.showLoading({ title: '提交中...' })
        wx.cloud.callFunction({
          name: 'reportLink',
          data: { linkId, reason },
          success(res) {
            wx.hideLoading()
            if (res.result.success) {
              wx.showToast({ title: '举报已提交', icon: 'success' })
            } else {
              wx.showToast({ title: res.result.message, icon: 'none' })
            }
          },
          fail() {
            wx.hideLoading()
            wx.showToast({ title: '提交失败', icon: 'error' })
          }
        })
      }
    })
  },

  onAdminDelete(e) {
    const { id: linkId, title: linkTitle } = e.currentTarget.dataset
    const self = this
    wx.showModal({
      title: '管理员删除',
      content: `确认删除「${linkTitle}」？`,
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' })
          wx.cloud.callFunction({
            name: 'adminDeleteLink',
            data: { linkId },
            success(res) {
              wx.hideLoading()
              if (res.result.success) {
                wx.showToast({ title: '已删除', icon: 'success' })
                const links = self.data.links.filter(l => l._id !== linkId)
                self.setData({ links })
              } else {
                wx.showToast({ title: res.result.message, icon: 'none' })
              }
            },
            fail() {
              wx.hideLoading()
              wx.showToast({ title: '删除失败', icon: 'error' })
            }
          })
        }
      }
    })
  },

  onDeleteMyLink(e) {
    const { id: linkId, title: linkTitle } = e.currentTarget.dataset
    wx.showModal({
      title: '删除口令',
      content: `确认删除「${linkTitle}」？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            const res = await wx.cloud.callFunction({
              name: 'deleteMyLink',
              data: { linkId }
            })
            if (res.result.success) {
              wx.showToast({ title: '已删除', icon: 'success' })
              this.setData({ links: this.data.links.filter(l => l._id !== linkId) })
            } else {
              wx.showToast({ title: res.result.message, icon: 'none' })
            }
          } catch (err) {
            wx.showToast({ title: '删除失败', icon: 'error' })
          }
        }
      }
    })
  },

  onGoReports() {
    wx.navigateTo({ url: '/pages/reports/reports' })
  }
})
