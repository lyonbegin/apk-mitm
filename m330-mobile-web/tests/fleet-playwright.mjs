import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const BASE = process.env.M330_BASE || 'https://m330-web-github-production.up.railway.app/';
const browser = await chromium.launch({headless:true, args:['--no-sandbox']});
const context = await browser.newContext({viewport:{width:390,height:844}});
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(error.message));
page.on('dialog', dialog => dialog.accept());
try {
  await page.goto(BASE, {waitUntil:'domcontentloaded', timeout:30000});
  await page.waitForFunction(() => document.querySelectorAll('#robot-select option').length>0, null, {timeout:20000});
  const firstId = Number(await page.locator('#robot-select').inputValue());
  assert.ok(firstId>0, 'default robot must exist');
  assert.equal(await page.locator('#fleet-cards .fleetcard').count(),1);
  await page.locator('#fleet-manager summary').click();
  await page.locator('#new-robot-name').fill('브라우저 검증 2호기');
  await page.locator('#new-robot-floor').selectOption('gyeongae-2');
  await page.locator('#fleet-manager button.save').first().click();
  await page.waitForFunction(() => document.querySelectorAll('#fleet-cards .fleetcard').length===2, {timeout:25000});
  const secondId=Number(await page.locator('#robot-select').inputValue());
  assert.notEqual(firstId,secondId,'new robot should be selected');
  await page.locator('#fleet-checkall').check();
  await page.locator('button.batchstart').click();
  await page.waitForFunction(() => document.getElementById('status')?.textContent?.includes('청소 중'), {timeout:15000});
  assert.match(await page.locator('#fleet-count').textContent(), /2대 등록/);
  await page.locator('[data-nav="tasks"]').click();
  await page.locator('#task-time').fill('10:15');
  await page.getByRole('button',{name:'＋ 일정 등록'}).click();
  await page.waitForFunction(() => document.getElementById('task-list')?.textContent?.includes('10:15'), {timeout:10000});
  await page.locator('[data-nav="home"]').click();
  await page.locator('#robot-select').selectOption(String(firstId));
  await page.waitForFunction(() => document.getElementById('robot-label')?.textContent?.includes('로봇 01'), {timeout:10000});
  await page.locator('[data-nav="tasks"]').click();
  await page.waitForFunction(() => !document.getElementById('task-list')?.textContent?.includes('10:15'),null,{timeout:12000});
  assert.ok(!(await page.locator('#task-list').textContent()).includes('10:15'),'schedule must remain isolated to second robot');
  await page.locator('[data-nav="home"]').click();
  await page.locator('#robot-select').selectOption(String(secondId));
  await page.locator('#fleet-manager summary').click(); // reopen if closed; Playwright supports hidden details
  await page.locator('#fleet-manager summary').click(); // restore open for controls
  await page.locator('#fleet-manager button.danger').click();
  await page.waitForFunction(() => document.querySelectorAll('#fleet-cards .fleetcard').length===1, {timeout:10000});

  await page.locator('[data-nav="map"]').click();
  await page.locator('#twin-svg [data-zone="stairs-west"]').waitFor({timeout:20000});
  assert.equal(await page.locator('#twin-svg [data-zone^="stairs-"]').count(),2);
  assert.equal(await page.locator('#twin-svg [data-zone^="corridor-"]').count(),3);
  await page.locator('#twin-svg [data-zone="stairs-west"]').click();
  await page.locator('#twin-manual-toggle').click();
  await page.waitForFunction(() => document.getElementById('twin-work')?.textContent?.includes('수동 작업: 완료'), {timeout:12000});
  await page.locator('#twin-floor').selectOption('4');
  await page.waitForFunction(() => document.getElementById('twin-work')?.textContent?.includes('선택 구역'),{timeout:12000});
  assert.equal(await page.locator('#twin-svg [data-zone^="stairs-"]').count(),2);
  await page.locator('#twin-floor').selectOption('5');
  await page.locator('#twin-svg [data-zone="stairs-west"]').waitFor({timeout:12000});
  await page.locator('#twin-svg [data-zone="stairs-west"]').click();
  await page.waitForFunction(() => document.getElementById('twin-work')?.textContent?.includes('수동 작업: 완료'),{timeout:12000});
  await page.locator('#twin-manual-toggle').click();
  await page.waitForFunction(() => document.getElementById('twin-work')?.textContent?.includes('수동 작업: 미완료'),{timeout:12000});
  await page.locator('#twin-svg [data-zone="corridor-center"]').click();
  await page.locator('#twin-start').click();
  await page.waitForFunction(() => document.getElementById('twin-work')?.textContent?.includes('running'),{timeout:12000});
  await page.locator('#twin-pause').click();
  await page.waitForFunction(() => document.getElementById('twin-work')?.textContent?.includes('paused'),{timeout:12000});
  await page.locator('#twin-reset').click();
  await page.waitForFunction(() => document.getElementById('twin-work')?.textContent?.includes('수행 중인 가상 청소 없음'),{timeout:12000});

  assert.deepEqual(pageErrors,[],'no uncaught browser JS errors');
  console.log('PASS fleet & digital twin Playwright: robots, common-area SVG stairwells, manual cleaning, simulated travel, JS errors');
} finally {
 await context.close();
 await browser.close();
}
