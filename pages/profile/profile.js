const app = getApp()

Page({
  data: {
    userInfo: { nickName: '微信用户', avatarUrl: '' },
    editMode: false,
    editNickName: '',
    quota: 0,
    myLinks: [],
    filteredLinks: [],
    loading: true,
    activeTab: 2,
    saving: false,
    linkFilter: 'all',
    statusBarHeight: app.globalData.statusBarHeight || 44,

    isAdmin: false
  },

  onLoad() {
    this.loadProfile()
    this.loadMyLinks()
  },

  onShow() {
    if (this.data.quota !== app.globalData.quota) {
      this.setData({ quota: app.globalData.quota || 0 })
    }
    this.loadMyLinks()
  },

  loadProfile() {
    const info = app.globalData.userInfo || {}
    const isAdmin = app.globalData.userInfo?.isAdmin || false
    this.setData({
      userInfo: {
        avatarUrl: info.avatarUrl || '',
        nickName: info.nickName || '微信用户'
      },
      quota: app.globalData.quota || 0,
      isAdmin
    })
  },

  async loadMyLinks() {
    this.setData({ loading: true })
    try {
      const res = await wx.cloud.callFunction({ name: 'getMyLinks' })
      if (res.result.success) {
        this.setData({ myLinks: res.result.data || [] })
        this.applyLinkFilter()
      }
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'error' })
    }
    this.setData({ loading: false })
  },

  applyLinkFilter() {
    const { myLinks, linkFilter } = this.data
    let filtered = myLinks
    if (linkFilter === 'active') {
      filtered = myLinks.filter(l => l.status === 'active')
    } else if (linkFilter === 'expired') {
      filtered = myLinks.filter(l => l.status === 'deleted' || l.status === 'expired')
    }
    this.setData({ filteredLinks: filtered })
  },

  onSwitchLinkFilter(e) {
    const filter = e.currentTarget.dataset.filter
    this.setData({ linkFilter: filter })
    this.applyLinkFilter()
  },

  switchTab(e) {
    const idx = parseInt(e.currentTarget.dataset.index)
    if (idx === 2) return
    wx.reLaunch({ url: ['/pages/index/index', '/pages/publish/publish', '/pages/profile/profile'][idx] })
  },

  onStartEdit() {
    this.setData({ editMode: true, editNickName: this.data.userInfo.nickName })
  },

  onCancelEdit() {
    this.setData({ editMode: false })
  },

  onNickNameInput(e) {
    this.setData({ editNickName: e.detail.value })
  },

  onChooseAvatar(e) {
    const { avatarUrl } = e.detail
    if (avatarUrl) {
      this.setData({ 'userInfo.avatarUrl': avatarUrl })
    }
  },

  async onSaveProfile() {
    const nickName = this.data.editNickName.trim()
    if (!nickName) { wx.showToast({ title: '昵称不能为空', icon: 'none' }); return }

    this.setData({ saving: true })
    try {
      let avatarUrl = this.data.userInfo.avatarUrl

      // 如果头像临时文件，上传到云存储获得永久链接
      if (avatarUrl && (avatarUrl.startsWith('wxfile') || avatarUrl.startsWith('http://tmp'))) {
        wx.showLoading({ title: '上传头像中...' })
        const openid = app.globalData.openid
        const uploadRes = await wx.cloud.uploadFile({
          cloudPath: `avatars/${openid}_${Date.now()}.jpg`,
          filePath: avatarUrl,
        })
        wx.hideLoading()
        avatarUrl = uploadRes.fileID
        this.setData({ 'userInfo.avatarUrl': avatarUrl })
      }

      const res = await wx.cloud.callFunction({
        name: 'updateProfile',
        data: { nickName, avatarUrl }
      })
      if (res.result.success) {
        app.globalData.userInfo = { ...app.globalData.userInfo, nickName, avatarUrl }
        this.setData({ 'userInfo.nickName': nickName, editMode: false })
        wx.showToast({ title: '保存成功', icon: 'success' })
      } else {
        wx.showToast({ title: res.result.message, icon: 'none' })
      }
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: '保存失败', icon: 'error' })
    }
    this.setData({ saving: false })
  },

  // 使链接失效
  async onExpireLink(e) {
    const linkId = e.currentTarget.dataset.id
    wx.showModal({
      title: '设为失效',
      content: '设为失效后其他用户将无法看到此口令，确定继续？',
      success: async (res) => {
        if (res.confirm) {
          try {
            const res = await wx.cloud.callFunction({
              name: 'expireMyLink',
              data: { linkId }
            })
            if (res.result.success) {
              wx.showToast({ title: '已设为失效', icon: 'success' })
              const myLinks = this.data.myLinks.map(l =>
                l._id === linkId ? { ...l, status: 'expired' } : l
              )
              this.setData({ myLinks }, () => this.applyLinkFilter())
            } else {
              wx.showToast({ title: res.result.message, icon: 'none' })
            }
          } catch (err) {
            wx.showToast({ title: '操作失败', icon: 'error' })
          }
        }
      }
    })
  },

  // 删除链接（已失效的记录）
  async onDeleteLink(e) {
    const linkId = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认删除',
      content: '删除后不可恢复',
      success: async (res) => {
        if (res.confirm) {
          try {
            const res = await wx.cloud.callFunction({
              name: 'deleteMyLink',
              data: { linkId }
            })
            if (res.result.success) {
              wx.showToast({ title: '已删除', icon: 'success' })
              const myLinks = this.data.myLinks.filter(l => l._id !== linkId)
              this.setData({ myLinks }, () => this.applyLinkFilter())
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

  // ===== 管理员入口 =====
  goReports() {
    wx.navigateTo({ url: '/pages/reports/reports' })
  }
})
