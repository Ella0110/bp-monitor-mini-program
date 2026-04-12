App({
    onLaunch() {
        wx.cloud.init({
            env: "__WECHAT_CLOUD_ENV_ID__",
            traceUser: true,
        });
        this.doLogin();
    },

    async doLogin() {
        try {
            const res = await wx.cloud.callFunction({ name: "login" });
            this.globalData.openid = res.result.openid;
            this.globalData.familyId = res.result.familyId;
            this.globalData.role = res.result.role;
        } catch (e) {
            console.error("Login failed", e);
        }
    },

    globalData: { openid: null, familyId: null, role: null, settings: {} },
});
