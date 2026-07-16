// スモークテスト: HTML構造・埋め込みデータ・計算前提の不変条件を検証
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
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
  // 医療費チップと詳細の既知の矛盾が再発していないこと
  const all = Object.values(prefs).flatMap(c => c.munis);
  const kyonan = all.find(d => d.name === '鋸南町');
  assert(kyonan && !kyonan.iryoChip.startsWith('18歳'), '鋸南町のチップが中3までになっている');
}

assert(html.includes("elders >= 2 ? 30000"), '児童手当の第3子判定（年次シミュレーション）が実装されている');
assert(html.includes('Math.min(15 - aEff, 3)'), '中学給食費が残り年数で換算されている');
assert(html.includes('function openModal'), 'モーダルのフォーカス制御がある');

process.exit(failed);
