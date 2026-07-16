# 引っ越し先の子育て支援くらべ

1都3県203市区町村の子育て支援制度を、ご家族の条件に合わせて比較できるWebアプリ。

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
