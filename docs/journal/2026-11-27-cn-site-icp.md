# 2026-11-27 meetpr.cn 首页主体与 ICP 备案更新

基线为 `feat/cn-site-icp` 上的 `adf6d62`。首页运营主体及版权改为竹越科技（杭州）有限公司，页脚的浙ICP备2026105140号-1 链接到工信部备案网站。联系邮箱更新为 `privacy@meetpr.cn`，隐私政策旁新增用户服务协议，配套 App 说明更新为 iOS / 安卓。

GitHub Pages 配置已排除 `cn/`。README 末尾记录了 nginx 的四项文件映射，以及协议正文更新后的双站部署要求。

| 验收项 | 改前输出 | 改后输出 |
| --- | --- | --- |
| 新备案号匹配行数 | `0` | `1` |
| 旧资料匹配行 | 3 行（主体、邮箱、备案号各一行） | 无输出，grep 退出码 1 |
| `href="/terms"` 匹配行数 | `0` | `1` |
| Python HTMLParser 读取首页 | 无输出，退出码 0 | 无输出，退出码 0 |
| `git diff origin/master -- index.html privacy terms` | 无输出 | 无输出 |
