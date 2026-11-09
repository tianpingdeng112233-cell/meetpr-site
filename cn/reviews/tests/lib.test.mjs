import test from 'node:test';
import assert from 'node:assert/strict';
import * as lib from '../assets/lib.js';

test('search combines exact city, name, province, mode and sort without blank filters', () => {
  const query = new URLSearchParams(lib.buildQuery({city:' 深圳 ',name:'老王 & 王',province:'广东',teaching_mode:'线上+线下',sort:'newest',empty:''}));
  assert.deepEqual(Object.fromEntries(query), {city:'深圳',q:'老王 & 王',province:'广东',teaching_mode:'线上+线下',sort:'newest'});
  assert.equal(lib.buildQuery({city:' ',name:''}), '');
});
test('scores stay hidden below three reviews, otherwise show one decimal', () => {
  assert.equal(lib.scoreDisplay(2, 4.9), '点评较少');
  assert.equal(lib.scoreDisplay(0, null), '点评较少');
  assert.equal(lib.scoreDisplay(3, 4), '4.0');
  assert.equal(lib.scoreDisplay(36, 4.66), '4.7');
  assert.equal(lib.scoreDisplay(3, null), '暂无评分');
});
test('blocked reasons explain the rejected content and preserve unknown backend copy', () => {
  for (const [reason, word] of [['phone','手机号'],['wechat','微信号'],['qq','QQ'],['link','链接'],['blocked_word','辱骂']]) {
    assert.ok(lib.blockedReason(reason).includes(word));
  }
  assert.equal(lib.blockedReason('new_rule', '后端具体原因'), '后端具体原因');
});
test('coach IDs support query parameters and rewritten path segments', () => {
  assert.equal(lib.coachId('?id=abc', '/reviews/c/'), 'abc');
  assert.equal(lib.coachId('?coach=def', '/reviews/write/'), 'def');
  assert.equal(lib.coachId('', '/reviews/c/abc/'), 'abc');
  assert.equal(lib.coachId('', '/cn/reviews/c/abc'), 'abc');
  assert.equal(lib.coachId('', '/cn/reviews/c/index.html'), null);
  assert.equal(lib.coachId('', '/reviews/c/'), null);
  assert.equal(lib.coachId('', '/reviews/c/%E0%A4%A'), null);
});
