// Pure public seams: URL filters, score policy, moderation copy and route IDs.
export function buildQuery(filters = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    const target = key === 'name' ? 'q' : key;
    if (!['city','q','province','teaching_mode','sort','limit','offset'].includes(target)) continue;
    if (value != null && String(value).trim()) query.set(target, String(value).trim());
  }
  return query.toString();
}
export function scoreDisplay(count, average) {
  if (Number(count) < 3) return '点评较少';
  return average == null || !Number.isFinite(Number(average)) ? '暂无评分' : Number(average).toFixed(1);
}
export function blockedReason(reason, message) {
  if (message) return message;
  const labels = {phone:'手机号',wechat:'微信号',qq:'QQ 号',link:'网址链接',blocked_word:'辱骂或不允许的词语'};
  return labels[reason] ? `内容里有${labels[reason]}，删掉后再发布。点评里不能留手机号、微信、QQ 或链接。` : '内容未通过检查，请修改后再发布。';
}
export function coachId(search = '', pathname = '') {
  const query = new URLSearchParams(search);
  const id = query.get('id') || query.get('coach');
  if (id?.trim()) return id.trim();
  const match = pathname.match(/\/reviews\/c\/([^/]+)\/?$/);
  if (!match || match[1] === 'index.html') return null;
  try { return decodeURIComponent(match[1]); } catch { return null; }
}
