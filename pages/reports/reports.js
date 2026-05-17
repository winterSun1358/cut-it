const app = getApp()

Page({
  data: {
    reports: [],
    loading: true,
    expandedReport: null,
    statusBarHeight: app.globalData.statusBarHeight || 44,
    isAdmin: false
  },

  onLoad() {
    const isAdmin = app.globalData.userInfo?.isAdmin || false
    if (!isAdmin) {
      wx.showToast({ title: '无权限', icon: 'error' })
      wx.navigateBack()
      return
    }
    this.setData({ isAdmin })
    this.loadReports()
  },

  onShow() {
    // 从其他页面返回时刷新
    if (this.data.isAdmin) {
      this.loadReports()
    }
  },

  async loadReports() {
    this.setData({ loading: true })
    try {
      const res = await wx.cloud.callFunction({ name: 'getReports' })
      if (res.result.success) {
        this.setData({ reports: res.result.data || [] })
      } else {
        wx.showToast({ title: res.result.message, icon: 'none' })
      }
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'error' })
    }
    this.setData({ loading: false })
  },

  toggleDetail(e) {
    const linkId = e.currentTarget.dataset.linkid
    this.setData({
      expandedReport: this.data.expandedReport === linkId ? null : linkId
    })
  },

  onDeleteLink(e) {
    const linkId = e.currentTarget.dataset.linkid
    wx.showModal({
      title: '管理员删除',
      content: '确认删除此链接？',
      success: async (res) => {
        if (res.confirm) {
          try {
            const res = await wx.cloud.callFunction({
              name: 'adminDeleteLink',
              data: { linkId }
            })
            if (res.result.success) {
              wx.showToast({ title: '已删除', icon: 'success' })
              this.setData({
                reports: this.data.reports.filter(r => r.linkId !== linkId),
                expandedReport: null
              })
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

  goBack() {
    wx.navigateBack()
  }
})
