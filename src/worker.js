// http→https 強制リダイレクト＋静的アセット配信
// 注: wrangler dev では custom_domain 設定により request.url が本番ドメインの
// http:// に見えるため、.dev.vars の DEV フラグでリダイレクトを抑止する
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const isLocal = env.DEV || url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (url.protocol === 'http:' && !isLocal) {
      url.protocol = 'https:';
      return Response.redirect(url.toString(), 301);
    }
    return env.ASSETS.fetch(request);
  },
};
