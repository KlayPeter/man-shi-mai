/* Run only against a server started with a dedicated test database. No external AI calls. */
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const base = process.env.TEST_API_BASE;
if (!base || !['localhost', '127.0.0.1'].includes(new URL(base).hostname) || process.env.RUN_LOCAL_INTEGRATION !== '1') {
  throw new Error('Set RUN_LOCAL_INTEGRATION=1 and local TEST_API_BASE; the server must use a dedicated test database.');
}
async function api(path, { token, body, method = body ? 'POST' : 'GET' } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
  const result = await response.json();
  return { status: response.status, ...result };
}
async function account() {
  const id = randomUUID().slice(0, 8);
  const input = { username: `p1-${id}`, email: `phase1-${id}@example.test`, password: 'Local-only-123!' };
  const registered = await api('/user/register', { body: input });
  assert.equal(registered.code, 200);
  assert.equal(registered.data.password, undefined);
  const login = await api('/user/login', { body: { email: input.email, password: input.password } });
  assert.equal(login.code, 200);
  assert.equal(login.data.user.password, undefined);
  return login.data;
}
(async () => {
  assert.equal((await api('/user/info')).status, 401);
  const owner = await account();
  const other = await account();
  const updated = await api('/user/update', { token: owner.token, body: { username: `改名-${randomUUID().slice(0, 6)}`, maiCoinBalance: 999, password: 'forbidden' } });
  assert.equal(updated.code, 200);
  assert.equal(updated.data.password, undefined);
  assert.equal(updated.data.maiCoinBalance, 0);
  const info = await api('/user/info', { token: owner.token });
  assert.equal(info.data.username, updated.data.username);
  const created = await api('/resume/create-empty', { token: owner.token, body: { resumeName: '集成测试简历' } });
  assert.equal(created.code, 200);
  const resumeId = created.data._id;
  const rename = await api('/resume/updateResumeName', { token: owner.token, body: { resumeId, resumeName: ' 已重命名 ' } });
  assert.equal(rename.code, 200);
  assert.equal(rename.data.resumeName, '已重命名');
  const content = { editorData: { basics: { name: '合成测试候选人' } }, plainTextSnapshot: '合成经历，无真实个人资料' };
  assert.equal((await api(`/resume/content/${resumeId}`, { method: 'PUT', token: owner.token, body: content })).code, 200);
  assert.equal((await api(`/resume/detail/${resumeId}`, { token: owner.token })).data.plainTextSnapshot, content.plainTextSnapshot);
  assert.equal((await api(`/resume/detail/${resumeId}`, { token: other.token })).status, 404);
  assert.equal((await api('/resume/updateResumeName', { token: other.token, body: { resumeId, resumeName: '越权改名' } })).status, 404);
  assert.equal((await api('/resume/deleteResume', { token: other.token, body: { resumeId } })).status, 404);
  assert.equal((await api('/resume/updateResumeName', { token: owner.token, body: { resumeId, resumeName: ' ' } })).status, 400);
  assert.equal((await api('/resume/deleteResume', { token: owner.token, body: { resumeId } })).code, 200);
  assert.equal((await api(`/resume/detail/${resumeId}`, { token: owner.token })).status, 404);
  console.log('PASS: real HTTP login/profile/resume CRUD, validation, and ownership; no model/payment/OSS calls.');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
