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
    linkFilter: 'all', // all | active | expired
    statusBarHeight: app.globalData.statusBarHeight || 44
  },

  onLoad() {
    this.loadProfile()
    this.loadMyLinks()
  },

  onShow() {
    if (this.data.quota !== app.globalData.quota) {
      this.setData({ quota: app.globalData.quota || 0 })
    }
  },

  loadProfile() {
    const info = app.globalData.userInfo || {}
    this.setData({
      userInfo: {
        avatarUrl: info.avatarUrl || 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0',
        nickName: info.nickName || '微信用户'
      },
      quota: app.globalData.quota || 0
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
    } catch (err) {}
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
      const res = await wx.cloud.callFunction({
        name: 'updateProfile',
        data: { nickName, avatarUrl: this.data.userInfo.avatarUrl }
      })
      if (res.result.success) {
        app.globalData.userInfo = { ...app.globalData.userInfo, nickName, avatarUrl: this.data.userInfo.avatarUrl }
        this.setData({ 'userInfo.nickName': nickName, editMode: false })
        wx.showToast({ title: '保存成功', icon: 'success' })
      } else {
        wx.showToast({ title: res.result.message, icon: 'none' })
      }
    } catch (err) {
      wx.showToast({ title: '保存失败', icon: 'error' })
    }
    this.setData({ saving: false })
  },

  onDeleteLink(e) {
    const linkId = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认删除',
      content: '删除后不可恢复',
      success: async (res) => {
        if (res.confirm) {
          try {
            await wx.cloud.database().collection('links').doc(linkId).update({ data: { status: 'deleted' } })
            wx.showToast({ title: '已删除', icon: 'success' })
            this.loadMyLinks()
          } catch (err) {
            wx.showToast({ title: '删除失败', icon: 'error' })
          }
        }
      }
    })
  }
})
