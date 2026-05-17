App({
  onLaunch() {
    wx.cloud.init({
      env: wx.cloud.DYNAMIC_CURRENT_ENV,
      traceUser: true
    })

    const sys = wx.getSystemInfoSync()
    this.globalData.statusBarHeight = sys.statusBarHeight
    this.globalData.screenWidth = sys.screenWidth
  },
  globalData: {
    userInfo: null,
    quota: 0,
    statusBarHeight: 44
  }
})
