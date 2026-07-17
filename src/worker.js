// http→https 強制リダイレクト＋制度データAPI＋静的アセット配信
// 注: wrangler dev では custom_domain 設定により request.url が本番ドメインの
// http:// に見えるため、.dev.vars の DEV フラグでリダイレクトを抑止する
import PREFS from './prefs.json' with { type: 'json' };

const PREFS_BODY = JSON.stringify(PREFS);
const ALLOWED_ORIGINS = ['https://kosodate.pint-home.com'];

// サイト内からのfetchのみ許可する簡易チェック。
// Sec-Fetch-Site（モダンブラウザ）を優先し、なければReferer/Originで判定。
// ヘッダ偽装での取得は防げないが、HTML保存・別サイトからの直接埋め込みを弾く。
function isSameSiteRequest(request, isLocal) {
  if (isLocal) return true;
  const sfs = request.headers.get('sec-fetch-site');
  if (sfs) return sfs === 'same-origin';
  const ref = request.headers.get('referer') || request.headers.get('origin') || '';
  return ALLOWED_ORIGINS.some(o => ref === o || ref.startsWith(o + '/'));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const isLocal = env.DEV || url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (url.protocol === 'http:' && !isLocal) {
      url.protocol = 'https:';
      return Response.redirect(url.toString(), 301);
    }
    if (url.pathname === '/api/prefs') {
      if (!isSameSiteRequest(request, isLocal)) {
        return new Response('Forbidden', { status: 403 });
      }
      return new Response(PREFS_BODY, {
        headers: {
          'content-type': 'application/json; charset=utf-8',
          // ブラウザには1時間キャッシュさせ、共有キャッシュ（CDN等）には載せない
          'cache-control': 'private, max-age=3600',
          'x-robots-tag': 'noindex',
        },
      });
    }
    return env.ASSETS.fetch(request);
  },
};
