# 引っ越し先の子育て支援くらべ

1都3県212市区町村（東京都は島しょ部9町村を含む全62区市町村）の子育て支援制度を、ご家族の条件に合わせて比較できるWebアプリ。

- 公開URL: https://kosodate.pint-home.com/
- 妊娠〜出生・未就学・小中高のステージ別に「これから受けられる支援」を概算表示
- 自治体を最大3つえらんで比較表を作成（県またぎ可・行列固定）
- 制度内容は2026年7月時点の各自治体公式サイト・各都県の公表資料に基づく

単一の `index.html`（データ埋め込み・外部依存なし）で構成。

## ローカル開発

```sh
npm ci
cp .dev.vars.example .dev.vars   # devでのhttps強制リダイレクトを抑止（必須）
npx wrangler dev
```

`public/index.html` のインラインスクリプトを変更したら、CSPのハッシュ更新が必要
（`npm test` が期待値を表示するので `public/_headers` に反映する）。

## 運用メモ（重要）

- `public/_headers` の CSP に `script-src` を**入れないこと**。Cloudflare の Web Analytics（自動計測）が HTML にビーコンを注入する際、`script-src` を自社ハッシュに書き換えるため、`'unsafe-inline'` が無効化されてアプリ本体のインラインスクリプトがブロックされる（2026-07 に本番全損の実績あり）。
- 厳格な `script-src` を使いたい場合は、先に Cloudflare ダッシュボードで該当サイトの Web Analytics（RUM 自動セットアップ）を無効化すること。
