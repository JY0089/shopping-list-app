import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE_PATH = 'file:///' + path.join(__dirname, 'index.html').replace(/\\/g, '/');

// 테스트 유틸
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function addItem(page, text) {
  await page.fill('#itemInput', text);
  await page.click('button:has-text("추가")');
}

// ─────────────────────────────────────────────
//  테스트 실행
// ─────────────────────────────────────────────
const browser = await chromium.launch({ headless: false, slowMo: 300 });
const context = await browser.newContext();

// localStorage 초기화를 위해 매 테스트마다 새 페이지 사용
async function freshPage() {
  const page = await context.newPage();
  await page.goto(FILE_PATH);
  // localStorage 초기화
  await page.evaluate(() => localStorage.removeItem('shopping-list'));
  await page.reload();
  return page;
}

// ══════════════════════════════════════════════
console.log('\n🧪 쇼핑 리스트 자동 테스트 시작\n');
console.log('=' .repeat(50));

// ── 테스트 1: 아이템 추가 ──────────────────────
console.log('\n📋 [테스트 1] 아이템 추가 기능');
{
  const page = await freshPage();

  // 1-1. 빈 상태 확인
  const emptyVisible = await page.isVisible('#emptyMsg');
  assert(emptyVisible, '초기 상태에서 빈 메시지가 표시됨');

  // 1-2. 아이템 추가 (버튼 클릭)
  await addItem(page, '사과');
  const items1 = await page.locator('li').count();
  assert(items1 === 1, '아이템 1개 추가 후 목록에 1개 표시됨');

  // 1-3. Enter 키로 추가
  await page.fill('#itemInput', '바나나');
  await page.keyboard.press('Enter');
  const items2 = await page.locator('li').count();
  assert(items2 === 2, 'Enter 키로 아이템 추가 후 목록에 2개 표시됨');

  // 1-4. 카운터 확인
  const total = await page.locator('#totalCount').textContent();
  assert(total === '2', `총 카운터가 2로 표시됨 (현재: ${total})`);

  // 1-5. 빈 메시지 숨김 확인
  const emptyHidden = await page.isHidden('#emptyMsg');
  assert(emptyHidden, '아이템 추가 후 빈 메시지가 숨겨짐');

  // 1-6. 빈 입력 추가 방지
  await page.fill('#itemInput', '   ');
  await page.click('button:has-text("추가")');
  const items3 = await page.locator('li').count();
  assert(items3 === 2, '공백만 입력 시 아이템이 추가되지 않음');

  await page.close();
}

// ── 테스트 2: 아이템 체크 기능 ────────────────
console.log('\n✅ [테스트 2] 아이템 체크 기능');
{
  const page = await freshPage();

  await addItem(page, '우유');
  await addItem(page, '계란');

  // 2-1. 체크박스 클릭 → checked 클래스 확인
  const firstCheckbox = page.locator('li').first().locator('.checkbox');
  await firstCheckbox.click();
  const isChecked = await page.locator('li').first().evaluate(el => el.classList.contains('checked'));
  assert(isChecked, '체크박스 클릭 후 아이템에 checked 클래스가 추가됨');

  // 2-2. 텍스트에 line-through 스타일 적용 확인
  const textDecoration = await page.locator('li').first().locator('.item-text').evaluate(el => {
    return window.getComputedStyle(el).textDecorationLine;
  });
  assert(textDecoration.includes('line-through'), `완료 아이템 텍스트에 line-through 스타일 적용됨 (${textDecoration})`);

  // 2-3. 완료 카운터 증가 확인
  const done = await page.locator('#doneCount').textContent();
  assert(done === '1', `완료 카운터가 1로 표시됨 (현재: ${done})`);

  // 2-4. 텍스트 클릭으로도 체크 가능
  const secondText = page.locator('li').nth(1).locator('.item-text');
  await secondText.click();
  const done2 = await page.locator('#doneCount').textContent();
  assert(done2 === '2', `텍스트 클릭으로도 체크 가능 (완료 카운터: ${done2})`);

  // 2-5. 재클릭 → 체크 해제
  await firstCheckbox.click();
  const isUnchecked = await page.locator('li').first().evaluate(el => !el.classList.contains('checked'));
  assert(isUnchecked, '체크된 아이템 재클릭 시 체크 해제됨');

  const done3 = await page.locator('#doneCount').textContent();
  assert(done3 === '1', `체크 해제 후 완료 카운터가 1로 감소됨 (현재: ${done3})`);

  await page.close();
}

// ── 테스트 3: 아이템 삭제 기능 ────────────────
console.log('\n🗑️  [테스트 3] 아이템 삭제 기능');
{
  const page = await freshPage();

  await addItem(page, '빵');
  await addItem(page, '버터');
  await addItem(page, '잼');

  // 3-1. 개별 삭제
  const delBtn = page.locator('li').first().locator('.delete-btn');
  await delBtn.click();
  const countAfterDelete = await page.locator('li').count();
  assert(countAfterDelete === 2, `개별 삭제 후 목록이 2개로 줄어듦 (현재: ${countAfterDelete})`);

  const total = await page.locator('#totalCount').textContent();
  assert(total === '2', `삭제 후 총 카운터가 2로 감소됨 (현재: ${total})`);

  // 3-2. 모두 삭제하면 빈 메시지 표시
  await page.locator('li').first().locator('.delete-btn').click();
  await page.locator('li').first().locator('.delete-btn').click();
  const emptyVisible = await page.isVisible('#emptyMsg');
  assert(emptyVisible, '모든 아이템 삭제 후 빈 메시지가 다시 표시됨');

  await page.close();
}

// ── 테스트 4: 완료 항목 일괄 삭제 ────────────
console.log('\n🧹 [테스트 4] 완료 항목 일괄 삭제');
{
  const page = await freshPage();

  await addItem(page, '커피');
  await addItem(page, '녹차');
  await addItem(page, '주스');

  // 4-1. 초기 "완료 항목 삭제" 버튼 비활성화 확인
  const btnDisabled = await page.locator('#clearBtn').isDisabled();
  assert(btnDisabled, '완료 항목 없을 때 "완료 항목 삭제" 버튼이 비활성화됨');

  // 4-2. 2개 체크
  await page.locator('li').first().locator('.checkbox').click();
  await page.locator('li').nth(1).locator('.checkbox').click();

  const btnEnabled = await page.locator('#clearBtn').isEnabled();
  assert(btnEnabled, '완료 항목 있을 때 "완료 항목 삭제" 버튼이 활성화됨');

  // 4-3. 일괄 삭제 클릭
  await page.locator('#clearBtn').click();
  const remainCount = await page.locator('li').count();
  assert(remainCount === 1, `완료 항목 삭제 후 미완료 1개만 남음 (현재: ${remainCount})`);

  const done = await page.locator('#doneCount').textContent();
  assert(done === '0', `일괄 삭제 후 완료 카운터가 0으로 초기화됨 (현재: ${done})`);

  await page.close();
}

// ── 테스트 5: localStorage 저장/복원 ──────────
console.log('\n💾 [테스트 5] localStorage 데이터 유지');
{
  const page = await freshPage();

  await addItem(page, '노트');
  await addItem(page, '펜');
  await page.locator('li').first().locator('.checkbox').click();

  // 페이지 새로고침
  await page.reload();

  const countAfterReload = await page.locator('li').count();
  assert(countAfterReload === 2, `새로고침 후 아이템 2개가 유지됨 (현재: ${countAfterReload})`);

  const checkedAfterReload = await page.locator('li').first().evaluate(el => el.classList.contains('checked'));
  assert(checkedAfterReload, '새로고침 후 체크 상태가 유지됨');

  await page.close();
}

// ══════════════════════════════════════════════
console.log('\n' + '='.repeat(50));
console.log(`\n📊 테스트 결과: 총 ${passed + failed}개`);
console.log(`   ✅ 통과: ${passed}개`);
console.log(`   ❌ 실패: ${failed}개`);
if (failed === 0) {
  console.log('\n🎉 모든 테스트를 통과했습니다!\n');
} else {
  console.log('\n⚠️  일부 테스트가 실패했습니다.\n');
}

await browser.close();
process.exit(failed > 0 ? 1 : 0);