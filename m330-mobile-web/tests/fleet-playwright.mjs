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
  await page.locator('#sim-building').selectOption('myeonhak');
  await page.locator('#sim-floor').selectOption('5');
  await page.locator('#sim-svg [data-zone="stairs-west"]').waitFor({timeout:20000});
  assert.equal(await page.locator('#sim-svg [data-zone^="stairs-"]').count(),2);
  assert.equal(await page.locator('#sim-svg [data-zone^="corridor-"]').count(),3);
  await page.waitForFunction(() => document.querySelectorAll('#sim-robot option').length===1,null,{timeout:12000});
  await page.locator('#sim-mode').selectOption('vacuum_mop');
  await page.locator('#sim-suction').selectOption('quiet');
  await page.locator('#sim-speed').selectOption('1');
  await page.locator('#sim-stop').click();
  await page.waitForFunction(() => document.querySelector('#sim-warning')?.textContent?.includes('대기'),null,{timeout:12000});
  await page.locator('#sim-zone').selectOption('corridor-center');
  await page.locator('#sim-real-speed').fill('0.1');
  await page.locator('#sim-set-real-speed').click();
  await page.waitForFunction(() => document.getElementById('sim-stats')?.textContent?.includes('0.100m/s'),null,{timeout:15000});
  const beforeMotion=await page.evaluate(async()=>{const j=await (await fetch('/api/sim/state?floor_id=myeonhak-5')).json();return j.robots[0].pose;});
  await page.locator('#sim-svg').screenshot({path:'sim-before.png'});
  await page.locator('#sim-start').click();
  await page.waitForFunction(() => document.querySelector('#sim-warning')?.textContent?.includes('청소 중'),null,{timeout:12000});
  await page.waitForFunction(async start=>{
   const j=await (await fetch('/api/sim/state?floor_id=myeonhak-5')).json();
   const r=j.robots[0];
   return Math.hypot(r.pose.x-start.x,r.pose.y-start.y)>20&&r.cleaned_cells>0&&r.distance_m>0.8;
  },beforeMotion,{timeout:20000});
  await page.locator('#sim-svg').screenshot({path:'sim-after.png'});
  const afterMotion=await page.evaluate(async()=>{const j=await (await fetch('/api/sim/state?floor_id=myeonhak-5')).json();return j.robots[0];});
  assert.ok(Math.hypot(afterMotion.pose.x-beforeMotion.x,afterMotion.pose.y-beforeMotion.y)>20,'robot must visibly move by more than 20 SVG pixels');
  assert.ok(afterMotion.cleaned_area_m2>0,'green cleaning area must represent real travelled coverage');
  assert.match(await page.locator('#sim-stats').textContent(),/청소속도|청소 시간/);
  await page.waitForTimeout(1200);
  assert.match(await page.locator('#sim-stats').textContent(),/실제 경로 커버리지/);
  await page.locator('#sim-pause').click();
  await page.waitForFunction(() => document.querySelector('#sim-warning')?.textContent?.includes('일시정지'),null,{timeout:12000});
  await page.locator('#sim-resume').click();
  await page.waitForFunction(() => document.querySelector('#sim-warning')?.textContent?.includes('청소 중'),null,{timeout:12000});
  await page.locator('#sim-dock').click();
  await page.waitForFunction(() => /복귀|충전/.test(document.querySelector('#sim-warning')?.textContent||''),null,{timeout:12000});

  assert.deepEqual(pageErrors,[],'no uncaught browser JS errors');
  console.log('PASS fleet & M330 motion twin Chromium: 20px+ physical movement, visible coverage, real metre scale, live control, pause/resume/dock, JS errors');
} finally {
 await context.close();
 await browser.close();
}
