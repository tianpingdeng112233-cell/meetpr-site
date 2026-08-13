# meetpr-site — meetpr.app 静态站点

只有两个页面,纯静态,零依赖、零构建:

```
index.html          → https://meetpr.app/
privacy/index.html  → https://meetpr.app/privacy
```

`privacy/index.html` 而不是 `privacy.html`,是为了让 `/privacy`(无扩展名)在任何静态托管上都能直接命中。

## 为什么这个仓存在

`https://meetpr.app/privacy` 硬编码在 iOS 仓 `Modules/AppShell/Sources/AppShell/AnalyticsPrivacyNotice.swift`
的 `privacyPolicyURL`。2026-07-30 登录页 v3 重做把这个链接提到了登录页首屏的条款行
(「继续即表示同意 隐私政策」),每个用户都点得到。2026-07-30 实测该 URL 超时(域名在
Namecheap 停放,`192.64.119.206`,没有服务在跑),所以必须真上线一个页面。

⚖️ David 2026-07-30 拍板 D:iOS 侧不改代码,链接保留不阻塞发版,由本站点补上页面。

## 待填项(上线前必须替换)

页面里有两处黄色标记的占位符,搜 `class="todo"` 就能找到:

- 运营主体名称(PIPL 要求写明个人信息处理者身份)
- 隐私联系邮箱

## 部署

### 方案 A(推荐):Cloudflare Pages

境外托管,不需要 ICP 备案,免费,自动签 HTTPS 证书,支持裸域。

1. `git init && git add -A && git commit` ,推到一个 GitHub 仓(可以是 private)。
2. Cloudflare Dashboard → Workers & Pages → Create → Pages → 连接该仓。
   构建命令留空,输出目录填 `/`(根目录)。
3. 把 `meetpr.app` 加进 Cloudflare(Add a site),Cloudflare 会给两个 nameserver。
4. Namecheap → Domain → Nameservers → 改成 Custom DNS,填 Cloudflare 给的两个。
   **注意**:切 NS 会接管整个域名的 DNS,现有记录要在 Cloudflare 侧重建
   (目前只有 Namecheap 的停放记录,可以不管)。
5. Pages 项目 → Custom domains → 添加 `meetpr.app`(以及 `www` 如果要)。

NS 生效通常几分钟到几小时。

### 方案 B:后端同源(阿里云杭州)

**不推荐**,原因见下:

- `meetpr.app` 指向境内阿里云需要 **ICP 备案**;`.app` 是否在工信部批复的域名列表内需先核实。
  备案本身还要 5–20 个工作日。
- 后端当前只监听 3000 端口(实测 80 / 443 都不通),要开 80/443 + 上证书;
  HTTPS 迁移在 `hold/https-migration-2026-07-09` 分支碳封着,是另一件事。
- 后端 `web/` 目录是 plan-web 的构建产物(`src/app.ts` 里 `express.static(webDir)` + SPA fallback),
  往里塞 `/privacy` 会跟 web-swap 部署流程打架。

也就是说 B 把一个「上线一个静态页」的活儿,绑到了备案 + HTTPS 迁移 + 部署流程改造三件事上。

### 方案 C:阿里云 OSS 香港桶 + 静态网站托管

境外 region 同样不需要备案,境内访问比 Cloudflare 稳,还在同一个云账号里。
代价是自定义域名要挂 CDN 才能上 HTTPS(要自己传/签证书),配置步骤比 A 多,且按量计费。

## 上线后验证

```bash
curl -sI --max-time 15 https://meetpr.app/privacy | head -3
```

要看到 `HTTP/2 200`。然后:

- iOS 真机/模拟器点登录页条款行的「隐私政策」,确认能打开。
- App Store Connect → App 信息 → 隐私政策 URL,确认填的是 `https://meetpr.app/privacy`。

## 内容口径来源

正文不是编的,逐条对着代码盘过:

| 段落 | 事实来源 |
|---|---|
| 收集的字段 | `MeetPR-backend/db/migrations/` — `0001-init-users` / `0003.5-init-profile-tables` / `0013-init-onboarding-profiles`(29 字段问卷)/ `0029-init-events` / `0030-init-analytics-feedback` / `0045-init-chat` |
| 埋点不含自由文本 | `0029-init-events.sql` 表头注释:`props are ids/enums only — never free text` |
| 使用数据保留 90 天 | `0029-init-events.sql` 注释 + `specs/008-analytics-events/SPEC.md §7`。⚠️ **清理任务尚未实装**,见下方待办 |
| 不接第三方 SDK / 不追踪 | `MeetPR/PrivacyInfo.xcprivacy`:`NSPrivacyTracking=false`、`NSPrivacyTrackingDomains` 空、五类数据全部 `Tracking=false` |
| 权限文案 | `MeetPR/Info.plist` 的四条 `*UsageDescription`(原文照搬,只做了句式统一) |
| 教练看不到手机号 | `src/routes/coach.ts` 学员响应只有 `display_name` 等,无 `phone` |
| 删除账号是级联硬删 | `src/routes/me.ts` `DELETE /me`:`deleteFrom('users')`,17 个 FK 全 `ON DELETE CASCADE`;`requireRole` 只放学员,教练账号删除未实装 |
| 埋点在删号后断开关联而非保留身份 | `0029` / `0030` 的 `user_id ... ON DELETE SET NULL` |
| 视频只走短期签名链接 | `specs/004-attachment-upload/SPEC.md`(presigned URL) |
| 无内购 | iOS 仓全库搜 `StoreKit` / `purchase(` 零命中 |
| HTTPS 已知限制 | `MeetPR/Info.plist` `NSAllowsArbitraryLoads=true`;`Modules/Networking/.../BuildConfig.swift` `productionBackendBaseURL = "http://121.40.160.241:3000"` |

## 上线后的两个跟进项

1. **90 天清理任务没实装**。`events` / `analytics_feedback` 的 90 天保留期目前只写在 spec 注释里,
   没有定时清理。政策一旦发布,这句话就是对外承诺——需要补一个清理任务(cron 或部署侧定时),
   否则政策与实际不一致。
2. **语音转写上线时要改政策**。聊天语音波(阿里云 ISI 录音文件识别)一旦上线,
   §6 就要新增一个第三方处理者,§2 要新增语音消息类别。现在的政策只描述已上线形态。
