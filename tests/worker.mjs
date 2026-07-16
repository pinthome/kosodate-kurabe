// Workerテスト: fetchハンドラを直接実行し、リダイレクトとAssets委譲を検証
import worker from '../src/worker.js';

let failed = 0;
const assert = (cond, msg) => {
  if (cond) { console.log('ok:', msg); }
  else { console.error('FAIL:', msg); failed = 1; }
};

const makeEnv = dev => {
  const calls = [];
  const env = {
    ASSETS: { fetch: req => { calls.push(req.url); return Promise.resolve(new Response('asset-body')); } },
  };
  if (dev !== undefined) env.DEV = dev;
  return { env, calls };
};

// 本番: httpはhttpsへ301（パス・クエリを維持）し、Assetsには委譲しない
{
  const { env, calls } = makeEnv();
  const res = await worker.fetch(new Request('http://kosodate.pint-home.com/foo?a=1'), env);
  assert(res.status === 301, `本番http: 301リダイレクト（実際: ${res.status}）`);
  assert(res.headers.get('location') === 'https://kosodate.pint-home.com/foo?a=1', `本番http: Locationがhttps＋パス維持（実際: ${res.headers.get('location')}）`);
  assert(calls.length === 0, '本番http: Assetsに委譲しない');
}

// 本番: httpsはそのままAssetsに委譲する
{
  const { env, calls } = makeEnv();
  const res = await worker.fetch(new Request('https://kosodate.pint-home.com/'), env);
  assert(res.status === 200 && await res.text() === 'asset-body', '本番https: Assetsのレスポンスを返す');
  assert(calls.length === 1, '本番https: Assetsに1回委譲する');
}

// wrangler dev: request.urlが本番ドメインのhttpに見えてもDEVフラグでリダイレクトしない（無限リダイレクト再発防止）
{
  const { env, calls } = makeEnv('true');
  const res = await worker.fetch(new Request('http://kosodate.pint-home.com/'), env);
  assert(res.status === 200 && calls.length === 1, 'DEV時: httpでもリダイレクトせずAssetsに委譲する');
}

// localhost/127.0.0.1のhttpはDEVフラグなしでもリダイレクトしない
for (const host of ['localhost:8787', '127.0.0.1:8787']) {
  const { env, calls } = makeEnv();
  const res = await worker.fetch(new Request(`http://${host}/`), env);
  assert(res.status === 200 && calls.length === 1, `${host}: httpでもリダイレクトしない`);
}

process.exit(failed);
