// スモークテスト: HTML構造・埋め込みデータ・計算ロジック・CSP整合を検証
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const headers = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8');
let failed = 0;
const assert = (cond, msg) => {
  if (cond) { console.log('ok:', msg); }
  else { console.error('FAIL:', msg); failed = 1; }
};

assert(html.startsWith('<!DOCTYPE html>'), 'DOCTYPE宣言がある');
assert(html.includes('<html lang="ja">'), 'lang="ja"が指定されている');
assert(html.includes('</body>') && html.includes('</html>'), 'body/htmlが閉じている');
assert(!html.includes('__PREFS__'), 'データプレースホルダが残っていない');

const m = html.match(/^const PREFS = (.*);$/m);
assert(!!m, 'PREFSデータ行がある');
if (m) {
  const prefs = JSON.parse(m[1]);
  const names = Object.keys(prefs);
  assert(names.length === 4, '4都県が存在する');
  const total = Object.values(prefs).reduce((s, c) => s + c.munis.length, 0);
  assert(total === 203, `203自治体（実際: ${total}）`);
  for (const [pref, conf] of Object.entries(prefs)) {
    const bad = conf.munis.filter(d => !d.name || !d.iryoChip || !d.kyushokuChip || !Array.isArray(d.birth) || !Array.isArray(d.bday));
    assert(bad.length === 0, `${pref}: 全自治体に必須フィールドがある${bad.length ? '（欠落: ' + bad.map(d => d.name).join(',') + '）' : ''}`);
  }
  const all = Object.values(prefs).flatMap(c => c.munis);

  // 医療費チップと詳細の既知の矛盾が再発していないこと
  const kyonan = all.find(d => d.name === '鋸南町');
  assert(kyonan && !kyonan.iryoChip.startsWith('18歳'), '鋸南町のチップが中3までになっている');
  const noda = all.find(d => d.name === '野田市');
  assert(noda && noda.iryoChip.includes('500円'), '野田市のチップが基準日時点の500円/回になっている');
  const shibayama = all.find(d => d.name === '芝山町');
  assert(shibayama && shibayama.iryoChip.includes('300円') && shibayama.iryo.includes('300円'), '芝山町の自己負担が300円になっている');

  // データ品質の不変条件
  const httpUrls = all.filter(d => d.url && !d.url.startsWith('https://'));
  assert(httpUrls.length === 0, `公式リンクがすべてHTTPS${httpUrls.length ? '（違反: ' + httpUrls.map(d => d.name).join(',') + '）' : ''}`);
  const unbalanced = all.filter(d => {
    const s = String(d.iryoChip) + String(d.kyushokuChip);
    return (s.match(/（/g) || []).length !== (s.match(/）/g) || []).length;
  });
  assert(unbalanced.length === 0, `チップの括弧が閉じている${unbalanced.length ? '（違反: ' + unbalanced.map(d => d.name).join(',') + '）' : ''}`);
}

// ---- CSP: _headersのスクリプトハッシュが実際のインラインスクリプトと一致すること ----
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
assert(scripts.length === 1, 'インラインスクリプトが1つだけ');
if (scripts.length === 1) {
  const hash = 'sha256-' + createHash('sha256').update(scripts[0][1]).digest('base64');
  assert(headers.includes(`script-src '${hash}'`), `CSPのスクリプトハッシュが一致する（期待: ${hash}）`);
  assert(!/script-src[^;]*'unsafe-inline'/.test(headers), "CSPのscript-srcにunsafe-inlineがない");
}
assert(!/\son[a-z]+\s*=\s*["']/i.test(html.replace(/<script>[\s\S]*?<\/script>/, '')), 'インラインイベントハンドラがない（CSPハッシュ運用の前提）');

// ---- 多子世帯の入力上限: 第5子以降も入力できること ----
const maxKids = html.match(/const MAX_KIDS = (\d+);/);
assert(maxKids && +maxKids[1] >= 10, `MAX_KIDSが10以上（実際: ${maxKids && maxKids[1]}）`);

// ---- 計算ロジック: calcStagesをHTMLから抽出して実行 ----
const calcSrc = html.match(/function calcStages\(d, kids\)\{[\s\S]*?\n\}/);
assert(!!calcSrc, 'calcStages関数を抽出できる');
if (calcSrc) {
  const makeCalc = care => new Function('state', calcSrc[0] + '\nreturn calcStages;')({ care });
  const calc = makeCalc('none');
  const stub = extra => ({ pref: '千葉県', birth: [], bday: [], ...extra });

  // 児童手当: 第3子以降は月3万円、上の子が22歳到達で毎年再判定される
  // [10,8,0]歳: 第3子は12年間3万円→以降1万円。未就学=216万、小中高=96+120+288万
  let r = calc(stub(), [{ age: 10 }, { age: 8 }, { age: 0 }]);
  assert(r.pre === 2_160_000, `児童手当・第3子判定（未就学分）: ${r.pre} === 2160000`);
  assert(r.school === 5_040_000, `児童手当・第3子判定（小中高分）: ${r.school} === 5040000`);

  // [21,20,0]歳: 上2人が順次22歳に到達し、第3子は3万→1.5万→1万と減額される
  r = calc(stub(), [{ age: 21 }, { age: 20 }, { age: 0 }]);
  assert(r.pre === 1_080_000, `児童手当・22歳到達で減額（未就学分）: ${r.pre} === 1080000`);
  assert(r.school === 1_440_000, `児童手当・22歳到達後（小中高分）: ${r.school} === 1440000`);

  // 中学給食費: 残り年数（最大3年）×年6万円で換算される
  r = calc(stub({ chuKyushoku: 'all' }), [{ age: 13 }]);
  assert(r.muni === 120_000, `中学給食費・13歳は残り2年分: ${r.muni} === 120000`);
  r = calc(stub({ chuKyushoku: 'all' }), [{ age: 0 }]);
  assert(r.muni === 180_000, `中学給食費・0歳は上限3年分: ${r.muni} === 180000`);

  // 5人きょうだい: 第3子以降が複数いても各人に月3万円が計上される
  r = calc(stub(), [{ age: 10 }, { age: 8 }, { age: 6 }, { age: 4 }, { age: 0 }]);
  assert(r.pre === 2_880_000, `児童手当・5人きょうだい（未就学分）: ${r.pre} === 2880000`);
  assert(r.school === 14_640_000, `児童手当・5人きょうだい（小中高分）: ${r.school} === 14640000`);

  // 第3子以降のみ無償の自治体では第1・2子に給食費が付かない
  r = calc(stub({ chuKyushoku: 'third' }), [{ age: 10 }, { age: 8 }, { age: 0 }]);
  assert(r.muni === 180_000, `中学給食費・第3子のみ無償: ${r.muni} === 180000`);
}

process.exit(failed);
