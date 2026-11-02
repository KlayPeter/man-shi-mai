/* Opt-in live OSS acceptance; synthetic fixtures and a disposable local MongoDB only. */
require('reflect-metadata');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const OSS = require('ali-oss');
const { NestFactory } = require('@nestjs/core');
const { ValidationPipe } = require('@nestjs/common');
const { getConnectionToken } = require('@nestjs/mongoose');
if (
  process.env.RUN_OSS_INTEGRATION !== '1' ||
  process.env.NODE_ENV !== 'test' ||
  process.env.MONGODB_URI !== 'mongodb://127.0.0.1:27028/msm_oss_acceptance'
)
  throw Error('Explicit opt-in and disposable local test database required');
const webBase = process.env.TEST_WEB_BASE;
if (webBase && !['localhost', '127.0.0.1'].includes(new URL(webBase).hostname))
  throw Error('Local test frontend required');
const base = webBase ? `${webBase}/dev-api` : 'http://127.0.0.1:3017';
const keys = new Set();
let app,
  browser,
  master,
  ownerId,
  stage = 'configuration';
const fixture = (extension) =>
  path.join(__dirname, '..', 'interview', 'fixtures', `resume.${extension}`);
async function api(route, token, body, expected = 200) {
  const res = await fetch(base + route, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(45000),
  });
  assert.equal(res.status, expected, route + ' status');
  if (expected >= 400) return;
  const result = await res.json();
  assert.equal(result.code, 200, route + ' envelope');
  return result.data;
}
async function account() {
  const suffix = randomUUID().slice(0, 8);
  const input = {
    username: `oss-${suffix}`,
    email: `oss-${suffix}@example.test`,
    password: `Synthetic-${randomUUID()}`,
  };
  await api('/user/register', null, input, 201);
  return api(
    '/user/login',
    null,
    { email: input.email, password: input.password },
    201,
  );
}
(async () => {
  const values = require('dotenv').parse(
    await fs.readFile(path.join(__dirname, '../../.env.development')),
  );
  for (const name of [
    'OSS_BUCKET',
    'OSS_REGION',
    'OSS_ACCESS_KEY_ID',
    'OSS_ACCESS_KEY_SECRET',
    'OSS_STS_ROLE_ARN',
  ]) {
    assert(Boolean(values[name]), name + ' missing');
    process.env[name] = values[name];
  }
  process.env.RESUME_STORAGE_DRIVER = 'oss';
  master = new OSS({
    bucket: values.OSS_BUCKET,
    region: values.OSS_REGION,
    accessKeyId: values.OSS_ACCESS_KEY_ID,
    accessKeySecret: values.OSS_ACCESS_KEY_SECRET,
    secure: true,
    timeout: 10000,
  });
  stage = 'test server';
  app = await NestFactory.create(
    require('../../dist/src/app.module').AppModule,
    { logger: false },
  );
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(3017, '127.0.0.1');
  const owner = await account();
  const other = await account();
  ownerId = owner.user._id;
  await api('/sts/getStsToken', null, undefined, 401);
  assert.equal(
    (await api('/resume/upload-config', owner.token)).provider,
    'oss',
  );
  const credentials = await api('/sts/getStsToken', owner.token);
  const scoped = new OSS({
    bucket: credentials.bucket,
    region: credentials.region,
    accessKeyId: credentials.accessKeyId,
    accessKeySecret: credentials.accessKeySecret,
    stsToken: credentials.securityToken,
    secure: true,
    timeout: 10000,
  });
  const prefix = `user-resumes/${ownerId}/`;
  await master.delete(prefix + 'cleanup-permission-' + randomUUID());
  for (const ext of ['pdf', 'docx']) {
    stage = 'STS upload and signed parsing: ' + ext;
    const key = prefix + randomUUID() + '.' + ext;
    keys.add(key);
    const bytes = await fs.readFile(fixture(ext));
    const result = await scoped.put(key, bytes);
    const plain = new URL(result.url);
    plain.protocol = 'https:';
    plain.search = '';
    const anonymous = await fetch(plain, {
      signal: AbortSignal.timeout(10000),
    });
    assert.equal(
      anonymous.status,
      403,
      'public access block must reject anonymous file reads',
    );
    await anonymous.body?.cancel();
    const saved = await api(
      '/resume/uploadResume',
      owner.token,
      {
        url: plain.href,
        resumeName: `合成验收.${ext}`,
        uploadTime: new Date().toISOString(),
      },
      201,
    );
    assert(
      saved.plainTextSnapshot.includes('1.8 seconds to 0.9 seconds'),
      'signed download must produce the actual document text',
    );
    assert.equal(saved.status, 'ready');
    const detail = await api('/resume/detail/' + saved._id, owner.token);
    assert(detail.plainTextSnapshot.includes('Frontend engineer'));
    await api('/resume/detail/' + saved._id, other.token, undefined, 404);
    await api(
      '/resume/uploadResume',
      other.token,
      {
        url: plain.href,
        resumeName: 'cross-user.pdf',
        uploadTime: new Date().toISOString(),
      },
      400,
    );
    await api(
      '/resume/deleteResume',
      owner.token,
      { resumeId: saved._id },
      201,
    );
  }
  stage = 'invalid OSS document';
  const badKey = prefix + randomUUID() + '.pdf';
  keys.add(badKey);
  const bad = await scoped.put(badKey, Buffer.from('not a PDF'));
  await api(
    '/resume/uploadResume',
    owner.token,
    {
      url: bad.url,
      resumeName: 'invalid.pdf',
      uploadTime: new Date().toISOString(),
    },
    400,
  );
  assert.equal(
    (await api('/resume/getInterviewResumeList', owner.token)).length,
    0,
    'failed parse must not leave a resume record',
  );
  if (webBase) {
    stage = 'browser CORS upload and extracted text';
    browser =
      await require('../../../web/node_modules/@playwright/test').chromium.launch();
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    });
    await page.addInitScript(
      ({ token, user }) => {
        localStorage.setItem('token', token);
        localStorage.setItem('userInfo', JSON.stringify(user));
      },
      { token: owner.token, user: owner.user },
    );
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (
        request.method() === 'PUT' &&
        url.hostname ===
          `${values.OSS_BUCKET}.${values.OSS_REGION}.aliyuncs.com` &&
        url.pathname.slice(1).startsWith(prefix)
      )
        keys.add(decodeURIComponent(url.pathname.slice(1)));
    });
    await page.goto(webBase + '/resume');
    await page
      .getByRole('button', { name: '上传文件', exact: true })
      .first()
      .click();
    await page.locator('input[type=file]').setInputFiles(fixture('pdf'));
    await page.getByRole('button', { name: '上传', exact: true }).click();
    await page.waitForURL(/\/resume\/[a-f0-9]{24}$/, { timeout: 45000 });
    const text = page.getByRole('region', { name: '简历提取内容' });
    await text.waitFor();
    assert((await text.innerText()).includes('Frontend engineer'));
    await page.setViewportSize({ width: 390, height: 844 });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
  }
  console.log(
    'PASS: real JWT/STS, PDF/DOCX OSS writes, blocked anonymous reads, signed downloads and parsing, saved snapshots, ownership rejection, invalid-file rejection' +
      (webBase ? ', Next proxy and browser CORS upload, mobile display' : '') +
      '. No AI/payment calls.',
  );
})()
  .catch((error) => {
    // SDK errors may contain signed URLs or credentials; report only the stage and safe code.
    console.error(
      'FAIL at ' +
        stage +
        ': ' +
        (/^[A-Za-z0-9_.-]{1,80}$/.test(error.code || '')
          ? error.code
          : error.name),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close();
    let cleanupFailed = false;
    for (const key of keys) {
      if (!key.startsWith(`user-resumes/${ownerId}/`)) {
        cleanupFailed = true;
        continue;
      }
      await master.delete(key).catch(() => {
        cleanupFailed = true;
      });
    }
    if (app) {
      await app.get(getConnectionToken()).dropDatabase();
      await app.close();
    }
    if (cleanupFailed) {
      console.error(
        'Synthetic OSS object cleanup failed; inspect the test user prefix.',
      );
      process.exitCode = 1;
    } else
      console.log(
        'Cleanup complete: synthetic OSS objects and disposable database removed.',
      );
  });
