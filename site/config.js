// ─────────────────────────────────────────────────────────────────────────────
//  Grok Bot · AI Office — crew + script（外包接单工作流）
//  改完保存，刷新页面即可，无需构建。
//
//  STATUS: coding | browsing | terminal | thinking | needs_you | error | done | idle
//  SHAPE:  round | square | drop
//  SEATS:  0–8（A 排 0,1,2 · B 排 3,4,5 · C 排 6,7,8），没人坐的显示 "+ FREE SEAT"
// ─────────────────────────────────────────────────────────────────────────────
window.OFFICE_CONFIG = {
  brand: "GROK BOT",
  title: "AI OFFICE",
  subtitle: "外包接单 · Mission control for your Grok Bots",
  wallText: "GROK",
  focus: "delivery",
  loopSeconds: 100,

  crew: [
    { id: "cos",      name: "CHIEF OF STAFF", role: "总管",     color: "#3d7bff", shape: "round",  seat: 1, status: "thinking", note: "排今天的优先级" },
    { id: "leads",    name: "获客",           role: "Leads",    color: "#8b5cf6", shape: "drop",   seat: 0, status: "browsing", note: "刷 X / 小红书找需求" },
    { id: "delivery", name: "交付",           role: "Delivery", color: "#ef4444", shape: "round",  seat: 4, status: "coding",   note: "落地页 v2 开发中" },
    { id: "finance",  name: "财务行政",       role: "Finance",  color: "#3ecf6e", shape: "square", seat: 2, status: "idle",     note: "等报价单" },
    { id: "dani",     name: "Dani",           role: "Assistant",color: "#f59e0b", shape: "drop",   seat: 3, status: "browsing", note: "整理客户邮件" },
    { id: "diandian", name: "点点bot",        role: "Research", color: "#14b8a6", shape: "drop",   seat: 6, status: "thinking", note: "调研竞品报价" },
    { id: "team",     name: "team",           role: "Group",    color: "#f2f2f2", shape: "square", seat: 8, status: "terminal", note: "同步群消息" },
  ],

  tasks: {
    leads:    { title: "本周找到 5 个外包线索", step: 2, steps: 5 },
    delivery: { title: "交付：某咖啡品牌落地页", step: 2, steps: 4 },
    finance:  { title: "报价 + 合同 + 发票", step: 1, steps: 3 },
    cos:      { title: "协调接单流水线", step: 1, steps: 1 },
    dani:     { title: "客户沟通", step: 1, steps: 3 },
    diandian: { title: "竞品报价调研", step: 1, steps: 2 },
    team:     { title: "每日站会纪要", step: 1, steps: 2 },
  },

  // at = 每轮开始后的秒数；say = 气泡；log = 任务日志；activity = 动态流
  // ask:true → 需要你拍板，GO / NO-GO 亮起；go / nogo = 点击后应用的变化
  script: [
    { at: 2,  bot: "leads",    say: "小红书上有人找做落地页的。", log: "发现需求：咖啡品牌落地页", activity: "发现一条落地页外包需求" },
    { at: 6,  bot: "cos",      say: "获客，先问预算和工期。", status: "thinking", note: "评估新线索" },
    { at: 9,  bot: "leads",    status: "coding", note: "私信客户问需求", log: "已私信：预算？工期？", step: 3 },
    { at: 13, bot: "diandian", say: "同类落地页市价 3k–6k。", status: "done", note: "调研完成", log: "竞品报价区间 ¥3,000–6,000", step: 2, activity: "竞品报价调研完成" },
    { at: 16, bot: "dani",     say: "客户回复了：预算 5k，两周。", status: "browsing", note: "客户：¥5,000 / 2 周", activity: "客户回复：预算 ¥5,000" },
    { at: 20, bot: "finance",  status: "coding", note: "出报价单", say: "报价单在做。", log: "报价单 ¥5,000（定金 50%）", step: 1 },
    { at: 24, bot: "delivery", status: "terminal", note: "npm run build", say: "构建中…", log: "构建落地页 v2", step: 3 },
    { at: 28, bot: "finance",  status: "needs_you", note: "合同待你确认", say: "合同好了，发给客户吗？", log: "合同已起草，等你确认后发送", step: 2, ask: true,
      go:   { status: "done", note: "合同已发，定金到账", say: "已发出，定金 ¥2,500 到账。", log: "合同已发送 · 定金到账", step: 3, activity: "签约成功，定金 ¥2,500 到账" },
      nogo: { status: "coding", note: "修改合同条款", say: "好，我先改条款。", log: "按你的意见修改合同" } },
    { at: 32, bot: "team",     say: "站会纪要已发群里。", status: "done", note: "纪要已同步", log: "站会纪要已发", step: 2, activity: "站会纪要已同步到群" },
    { at: 36, bot: "delivery", status: "error", note: "构建失败：8080 端口被占", say: "8080 被占了。", log: "构建失败：端口 8080 被占用", activity: "部署失败：端口被占用" },
    { at: 40, bot: "delivery", status: "terminal", note: "改用 8081 重试", say: "换 8081 重试。", log: "改用端口 8081 重试" },
    { at: 45, bot: "delivery", status: "needs_you", note: "预览链接待你验收", say: "预览好了，你先看一眼？", log: "预览链接已生成，等你验收", step: 4, ask: true,
      go:   { status: "done", note: "已交付客户", say: "好，发给客户了。", log: "已交付客户，等尾款", activity: "落地页已交付客户" },
      nogo: { status: "coding", note: "按反馈修改", say: "收到，我再改改。", log: "按你的反馈修改页面" } },
    { at: 50, bot: "cos",      status: "coding", note: "写今日复盘", say: "大家辛苦了。", activity: "开始写今日复盘" },
    { at: 54, bot: "dani",     say: "客户说很满意！", status: "done", note: "客户确认验收", step: 3, activity: "客户确认验收" },
    { at: 58, bot: "finance",  status: "terminal", note: "开发票 + 催尾款", say: "发票已开。", log: "发票已开，尾款 ¥2,500", activity: "发票已开出" },
    { at: 62, bot: "delivery", status: "done", note: "已交付客户", say: "交付完成 ✅", log: "已交付客户，等尾款", activity: "落地页已交付客户" },
    { at: 66, bot: "leads",    status: "browsing", note: "继续找下一单", say: "又看到两个需求。", activity: "新增 2 条线索" },
    { at: 72, bot: "diandian", status: "thinking", note: "研究小程序报价", log: "调研小程序外包报价" },
    { at: 78, bot: "finance",  status: "done", note: "尾款到账", say: "尾款到账，本单 ¥5,000。", log: "尾款 ¥2,500 到账", step: 3, activity: "尾款到账，本单收入 ¥5,000" },
    { at: 84, bot: "team",     status: "idle", note: "空闲" },
    { at: 88, bot: "delivery", status: "idle", note: "空闲，可接新单" },
    { at: 94, bot: "cos",      status: "done", note: "复盘已发你", say: "今日复盘已发你。", activity: "今日复盘已完成" },
  ],
};
