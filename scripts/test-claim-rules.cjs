/**
 * Self-check for the claimable-time-blocks rules engine.
 *
 *   node scripts/test-claim-rules.cjs
 *
 * Plain assert, no framework, no database, fixed dates. Covers min/max
 * duration, granularity snapping, the bookable window, the daily quota, the
 * weekly quota, capacity, and a claim that spans a DST transition.
 */
const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

const MOD = pathToFileURL(path.join(__dirname, '..', 'src', 'lib', 'scheduleBlocks.js')).href;

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

(async () => {
  const S = await import(MOD);
  const { validateClaim, normalizeBlock, dayKeyFor, weekKeyFor, wallToUtc, claimSlotKeys, peakOverlap, isAdmitted } = S;

  const TZ = 'Asia/Kolkata';
  const NOW = new Date('2026-08-30T00:00:00Z'); // fixed "now" for every case

  const built = normalizeBlock({
    title: 'Claude Code',
    timezone: TZ,
    startDate: '2026-09-01',
    endDate: '2026-09-30',
    window: { days: [1, 2, 3, 4, 5], startTime: '09:00', endTime: '19:00', granularityMinutes: 30 },
    rules: {
      minMinutes: 30, maxMinutes: 300,
      maxMinutesPerDay: 300, maxMinutesPerWeek: 600,
      maxClaimsPerDay: null, capacity: 1, advanceNoticeMinutes: 0, horizonDays: null,
    },
  });
  assert.strictEqual(built.error, undefined, `normalizeBlock rejected the fixture: ${built.error}`);
  const BLOCK = { _id: 'b1', ownerId: 'owner1', ...built.block };

  const RAM = { _id: 'ram', role: 'Member', teamIds: [] };
  const at = (date, hhmm) => wallToUtc(date, hhmm, TZ);
  const claim = (from, to, extra = {}) => validateClaim({
    block: BLOCK, user: RAM, start: at('2026-09-07', from), end: at('2026-09-07', to), now: NOW, ...extra,
  });

  console.log('\nbucket keys');
  check('dayKey is the block-zone calendar date, not the UTC one', () => {
    // 2026-09-07 20:30 UTC is already the 8th in Kolkata (UTC+5:30).
    assert.strictEqual(dayKeyFor(new Date('2026-09-07T20:30:00Z'), TZ), '2026-09-08');
    assert.strictEqual(dayKeyFor(new Date('2026-09-07T20:30:00Z'), 'UTC'), '2026-09-07');
  });
  check('weekKey is the ISO week', () => {
    assert.strictEqual(weekKeyFor(at('2026-09-07', '09:00'), TZ), '2026-W37'); // Monday
    assert.strictEqual(weekKeyFor(at('2026-09-13', '09:00'), TZ), '2026-W37'); // Sunday, same ISO week
    assert.strictEqual(weekKeyFor(at('2026-09-14', '09:00'), TZ), '2026-W38'); // next Monday
    assert.strictEqual(weekKeyFor(at('2027-01-01', '09:00'), TZ), '2026-W53'); // Friday belongs to 2026
  });

  console.log('\nthe happy path — the scenario from the plan');
  check('Ram takes Monday 09:00-14:00', () => {
    const r = claim('09:00', '14:00');
    assert.strictEqual(r.ok, true, r.message);
    assert.strictEqual(r.minutes, 300);
    assert.strictEqual(r.dayKey, '2026-09-07');
    assert.strictEqual(r.weekKey, '2026-W37');
  });
  check('Gita takes Monday 14:00-19:00 beside him — touching is not overlapping', () => {
    const ram = { startTime: at('2026-09-07', '09:00'), endTime: at('2026-09-07', '14:00') };
    const r = validateClaim({
      block: BLOCK, user: { _id: 'gita', role: 'Member', teamIds: [] },
      start: at('2026-09-07', '14:00'), end: at('2026-09-07', '19:00'),
      now: NOW, overlapping: [ram],
    });
    assert.strictEqual(r.ok, true, r.message);
  });

  console.log('\nduration');
  check('under minMinutes is refused', () => {
    // 15 minutes is below both the 30-minute floor and the granularity.
    const r = validateClaim({ block: { ...BLOCK, window: { ...BLOCK.window, granularityMinutes: 15 } }, user: RAM, start: at('2026-09-07', '09:00'), end: at('2026-09-07', '09:15'), now: NOW });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.code, 'too_short');
  });
  check('over maxMinutes is refused', () => {
    const r = claim('09:00', '15:00'); // 6 h against a 5 h cap
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.code, 'too_long');
  });
  check('exactly maxMinutes is allowed', () => {
    assert.strictEqual(claim('09:00', '14:00').ok, true);
  });

  console.log('\ngranularity snapping');
  check('a start off the 30-minute grid is refused', () => {
    const r = claim('09:10', '11:10');
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.code, 'granularity');
  });
  check('an end off the grid is refused', () => {
    const r = claim('09:00', '11:20');
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.code, 'granularity');
  });
  check('the grid is anchored to window.startTime, not to midnight', () => {
    const b = normalizeBlock({ ...BLOCK, window: { ...BLOCK.window, startTime: '09:15', endTime: '18:15', granularityMinutes: 30 }, rules: { ...BLOCK.rules, minMinutes: 30, maxMinutes: 300 } }).block;
    const blk = { ...BLOCK, ...b };
    const good = validateClaim({ block: blk, user: RAM, start: at('2026-09-07', '09:15'), end: at('2026-09-07', '10:15'), now: NOW });
    assert.strictEqual(good.ok, true, good.message);
    const bad = validateClaim({ block: blk, user: RAM, start: at('2026-09-07', '09:30'), end: at('2026-09-07', '10:30'), now: NOW });
    assert.strictEqual(bad.code, 'granularity');
  });

  console.log('\nthe bookable window');
  check('before window.startTime is refused', () => {
    assert.strictEqual(claim('08:00', '10:00').code, 'outside_window');
  });
  check('past window.endTime is refused', () => {
    assert.strictEqual(claim('17:00', '20:00').code, 'outside_window');
  });
  check('a closed weekday is refused', () => {
    // 2026-09-06 is a Sunday; the block is Mon-Fri.
    const r = validateClaim({ block: BLOCK, user: RAM, start: at('2026-09-06', '09:00'), end: at('2026-09-06', '11:00'), now: NOW });
    assert.strictEqual(r.code, 'closed_day');
  });
  check('before the block opens is refused', () => {
    const r = validateClaim({ block: BLOCK, user: RAM, start: at('2026-08-31', '09:00'), end: at('2026-08-31', '11:00'), now: NOW });
    assert.strictEqual(r.code, 'before_start');
  });
  check('after the block ends is refused', () => {
    const r = validateClaim({ block: BLOCK, user: RAM, start: at('2026-10-05', '09:00'), end: at('2026-10-05', '11:00'), now: NOW });
    assert.strictEqual(r.code, 'after_end');
  });
  check('a paused block refuses everything', () => {
    const r = validateClaim({ block: { ...BLOCK, status: 'paused' }, user: RAM, start: at('2026-09-07', '09:00'), end: at('2026-09-07', '11:00'), now: NOW });
    assert.strictEqual(r.code, 'block_closed');
  });
  check('notice and horizon', () => {
    const soon = validateClaim({ block: BLOCK, user: RAM, start: at('2026-09-07', '09:00'), end: at('2026-09-07', '11:00'), now: at('2026-09-07', '08:30') });
    assert.strictEqual(soon.ok, true, soon.message);
    const tooSoon = validateClaim({ block: { ...BLOCK, rules: { ...BLOCK.rules, advanceNoticeMinutes: 120 } }, user: RAM, start: at('2026-09-07', '09:00'), end: at('2026-09-07', '11:00'), now: at('2026-09-07', '08:30') });
    assert.strictEqual(tooSoon.code, 'too_soon');
    const tooFar = validateClaim({ block: { ...BLOCK, rules: { ...BLOCK.rules, horizonDays: 3 } }, user: RAM, start: at('2026-09-07', '09:00'), end: at('2026-09-07', '11:00'), now: NOW });
    assert.strictEqual(tooFar.code, 'too_far');
  });

  console.log('\naccess');
  check('deny beats every allow, including admin', () => {
    const b = { ...BLOCK, access: { visibility: 'restricted', allowRoles: ['Member'], allowTeams: [], allowUserIds: ['ram'], denyUserIds: ['ram'] } };
    assert.strictEqual(isAdmitted(b, RAM), false);
    assert.strictEqual(isAdmitted(b, { _id: 'ram', role: 'Console admin', teamIds: [] }), false);
  });
  check('a restricted block admits by role, team, id — and admins', () => {
    const b = { ...BLOCK, access: { visibility: 'restricted', allowRoles: ['Intern'], allowTeams: ['t9'], allowUserIds: ['zed'], denyUserIds: [] } };
    assert.strictEqual(isAdmitted(b, RAM), false);
    assert.strictEqual(isAdmitted(b, { _id: 'x', role: 'Intern', teamIds: [] }), true);
    assert.strictEqual(isAdmitted(b, { _id: 'y', role: 'Member', teamIds: ['t9'] }), true);
    assert.strictEqual(isAdmitted(b, { _id: 'zed', role: 'Member', teamIds: [] }), true);
    assert.strictEqual(isAdmitted(b, { _id: 'a', role: 'Admin', teamIds: [] }), true);
    const r = validateClaim({ block: b, user: RAM, start: at('2026-09-07', '09:00'), end: at('2026-09-07', '11:00'), now: NOW });
    assert.strictEqual(r.code, 'not_admitted');
  });

  console.log('\ncapacity');
  check('capacity 1: an overlapping confirmed claim refuses', () => {
    const held = { startTime: at('2026-09-07', '10:00'), endTime: at('2026-09-07', '12:00') };
    const r = claim('09:00', '14:00', { overlapping: [held] });
    assert.strictEqual(r.code, 'taken');
  });
  check('capacity 2: one holder is fine, two at the same instant is not', () => {
    const b = { ...BLOCK, rules: { ...BLOCK.rules, capacity: 2 } };
    const one = [{ startTime: at('2026-09-07', '10:00'), endTime: at('2026-09-07', '12:00') }];
    const two = [...one, { startTime: at('2026-09-07', '11:00'), endTime: at('2026-09-07', '13:00') }];
    assert.strictEqual(validateClaim({ block: b, user: RAM, start: at('2026-09-07', '09:00'), end: at('2026-09-07', '14:00'), now: NOW, overlapping: one }).ok, true);
    assert.strictEqual(validateClaim({ block: b, user: RAM, start: at('2026-09-07', '09:00'), end: at('2026-09-07', '14:00'), now: NOW, overlapping: two }).code, 'taken');
  });
  check('peakOverlap counts depth, not claims, and clips to the range', () => {
    const a = { startTime: at('2026-09-07', '09:00'), endTime: at('2026-09-07', '10:00') };
    const b = { startTime: at('2026-09-07', '10:00'), endTime: at('2026-09-07', '11:00') };
    // Two back-to-back claims are depth 1, not 2.
    assert.strictEqual(peakOverlap([a, b], at('2026-09-07', '09:00'), at('2026-09-07', '11:00')), 1);
    // A claim entirely outside the range does not count.
    assert.strictEqual(peakOverlap([a], at('2026-09-07', '11:00'), at('2026-09-07', '12:00')), 0);
  });

  console.log('\nquota');
  check('daily quota: 5 h taken leaves nothing on a 5 h/day cap', () => {
    const r = claim('14:00', '15:00', { usage: { dayMinutes: 300 } });
    assert.strictEqual(r.code, 'over_day_quota');
  });
  check('daily quota: the remainder exactly fits', () => {
    const r = claim('14:00', '16:00', { usage: { dayMinutes: 180 } });
    assert.strictEqual(r.ok, true, r.message);
    assert.strictEqual(validateClaim({ block: BLOCK, user: RAM, start: at('2026-09-07', '14:00'), end: at('2026-09-07', '16:30'), now: NOW, usage: { dayMinutes: 180 } }).code, 'over_day_quota');
  });
  check('weekly quota refuses even when the day is free', () => {
    const r = claim('09:00', '14:00', { usage: { dayMinutes: 0, weekMinutes: 540 } });
    assert.strictEqual(r.code, 'over_week_quota');
  });
  check('maxClaimsPerDay', () => {
    const b = { ...BLOCK, rules: { ...BLOCK.rules, maxClaimsPerDay: 2 } };
    const r = validateClaim({ block: b, user: RAM, start: at('2026-09-07', '09:00'), end: at('2026-09-07', '10:00'), now: NOW, usage: { dayClaims: 2 } });
    assert.strictEqual(r.code, 'over_claim_count');
  });
  check('null quotas mean no cap', () => {
    const b = { ...BLOCK, rules: { ...BLOCK.rules, maxMinutesPerDay: null, maxMinutesPerWeek: null } };
    const r = validateClaim({ block: b, user: RAM, start: at('2026-09-07', '09:00'), end: at('2026-09-07', '14:00'), now: NOW, usage: { dayMinutes: 99999, weekMinutes: 99999 } });
    assert.strictEqual(r.ok, true, r.message);
  });

  console.log('\nDST — a wall-clock range is not always the same number of real minutes');
  check('spring forward: 01:00-06:00 wall in New York is 4 real hours', () => {
    // 2026-03-08 02:00 EST -> 03:00 EDT. The 02:00 hour does not exist.
    const NY = 'America/New_York';
    const dst = normalizeBlock({
      title: 'DST', timezone: NY, startDate: '2026-03-01', endDate: null,
      window: { days: [0, 1, 2, 3, 4, 5, 6], startTime: '00:00', endTime: '23:30', granularityMinutes: 60 },
      rules: { minMinutes: 60, maxMinutes: 300, maxMinutesPerDay: 300, maxMinutesPerWeek: 600, capacity: 1 },
    });
    assert.strictEqual(dst.error, undefined, dst.error);
    const b = { ...dst.block, _id: 'dst', ownerId: 'o' };
    const start = wallToUtc('2026-03-08', '01:00', NY);
    const end = wallToUtc('2026-03-08', '06:00', NY);
    assert.strictEqual((end - start) / 3600000, 4, 'the missing hour should be gone from the real duration');

    const r = validateClaim({ block: b, user: RAM, start, end, now: new Date('2026-03-01T00:00:00Z') });
    assert.strictEqual(r.ok, true, r.message);
    assert.strictEqual(r.minutes, 240, 'quotas count real minutes, not wall-clock minutes');
    assert.strictEqual(r.dayKey, '2026-03-08');

    // And the slot expansion covers real time, so it produces 4 slots, not 5.
    const keys = claimSlotKeys('dst', start, end, 60);
    assert.strictEqual(keys.length, 4);
    assert.strictEqual(new Set(keys.map((k) => k.slotKey)).size, 4, 'slot keys must be unique');

    // The same wall-clock range on a normal day really is 5 hours.
    const normStart = wallToUtc('2026-03-15', '01:00', NY);
    const normEnd = wallToUtc('2026-03-15', '06:00', NY);
    assert.strictEqual((normEnd - normStart) / 3600000, 5);
    assert.strictEqual(validateClaim({ block: b, user: RAM, start: normStart, end: normEnd, now: new Date('2026-03-01T00:00:00Z') }).minutes, 300);
  });
  check('fall back: 01:00-04:00 wall in New York is 4 real hours and 4 slots', () => {
    const NY = 'America/New_York';
    const start = wallToUtc('2026-11-01', '01:00', NY);
    const end = wallToUtc('2026-11-01', '04:00', NY);
    assert.strictEqual((end - start) / 3600000, 4, 'the repeated hour should be in the real duration');
    assert.strictEqual(claimSlotKeys('x', start, end, 60).length, 4);
  });

  console.log('\nslot expansion (the race fix)');
  check('a 5 h claim at 30-minute granularity writes 10 distinct slot rows', () => {
    const keys = claimSlotKeys('b1', at('2026-09-07', '09:00'), at('2026-09-07', '14:00'), 30);
    assert.strictEqual(keys.length, 10);
    assert.strictEqual(new Set(keys.map((k) => k.slotKey)).size, 10);
  });
  check('two overlapping claims share at least one slot key — which the unique index refuses', () => {
    const ram = claimSlotKeys('b1', at('2026-09-07', '09:00'), at('2026-09-07', '14:00'), 30).map((k) => k.slotKey);
    const late = claimSlotKeys('b1', at('2026-09-07', '10:00'), at('2026-09-07', '12:00'), 30).map((k) => k.slotKey);
    const shared = late.filter((k) => ram.includes(k));
    assert.strictEqual(shared.length, 4, 'a claim starting inside another must collide on the index');
    // A single {blockId, startTime} index would NOT have caught this:
    assert.notStrictEqual(ram[0], late[0]);
  });
  check('back-to-back claims share no slot key', () => {
    const ram = claimSlotKeys('b1', at('2026-09-07', '09:00'), at('2026-09-07', '14:00'), 30).map((k) => k.slotKey);
    const gita = claimSlotKeys('b1', at('2026-09-07', '14:00'), at('2026-09-07', '19:00'), 30).map((k) => k.slotKey);
    assert.strictEqual(gita.filter((k) => ram.includes(k)).length, 0);
  });
  check('slot keys are namespaced per block', () => {
    const a = claimSlotKeys('b1', at('2026-09-07', '09:00'), at('2026-09-07', '10:00'), 30).map((k) => k.slotKey);
    const b = claimSlotKeys('b2', at('2026-09-07', '09:00'), at('2026-09-07', '10:00'), 30).map((k) => k.slotKey);
    assert.strictEqual(a.filter((k) => b.includes(k)).length, 0);
  });

  console.log('\nnormalizeBlock guards');
  check('granularity floor, window sanity and quota shape', () => {
    assert.match(normalizeBlock({ title: 'x', startDate: '2026-09-01', window: { granularityMinutes: 5 } }).error, /at least 15/);
    assert.match(normalizeBlock({ title: '', startDate: '2026-09-01' }).error, /Title/);
    assert.match(normalizeBlock({ title: 'x', startDate: 'nope' }).error, /startDate/);
    assert.match(normalizeBlock({ title: 'x', startDate: '2026-09-02', endDate: '2026-09-01' }).error, /before startDate/);
    assert.match(normalizeBlock({ title: 'x', startDate: '2026-09-01', window: { startTime: '19:00', endTime: '09:00' } }).error, /after startTime/);
    assert.match(normalizeBlock({ title: 'x', startDate: '2026-09-01', timezone: 'Mars/Olympus' }).error, /Unknown timezone/);
    assert.match(normalizeBlock({ title: 'x', startDate: '2026-09-01', rules: { minMinutes: 45 } }).error, /multiples of the slot granularity/);
    assert.match(normalizeBlock({ title: 'x', startDate: '2026-09-01', window: { days: [] } }).error, /at least one weekday/);
  });

  check('a partial edit keeps the rules it did not mention', () => {
    const next = normalizeBlock({ rules: { maxMinutes: 240 } }, BLOCK);
    assert.strictEqual(next.error, undefined, next.error);
    assert.strictEqual(next.block.rules.maxMinutes, 240);
    assert.strictEqual(next.block.rules.maxMinutesPerWeek, 600, 'the weekly cap must survive a partial PUT');
    assert.strictEqual(next.block.window.granularityMinutes, 30);
    assert.strictEqual(next.block.title, 'Claude Code');
    assert.strictEqual(next.block._id, undefined, 'normalizeBlock must never echo back an _id');
  });

  /* ── a window that runs to midnight ──────────────────────────────────
   *
   * The reported bug: a 00:00–23:59 block with a five-hour minimum could not
   * be claimed past the early evening. 23:59 is not on a slot boundary, so the
   * last whole slot ended at 23:00 and the last five-hour claim had to start
   * at 18:00 — the end of the day was unreachable with nothing explaining why.
   * 24:00 is the fix, and these pin it.
   */
  console.log('\nwindows that run to midnight');

  check('parseHHMM accepts 24:00 as end-of-day, and only 24:00', () => {
    assert.strictEqual(S.parseHHMM('24:00'), 1440);
    assert.strictEqual(S.parseHHMM('23:59'), 1439);
    assert.strictEqual(S.parseHHMM('24:30'), null, '24:30 is a typo, not a time');
    assert.strictEqual(S.parseHHMM('25:00'), null);
  });

  check('a 24:00 window is accepted and normalises to 1440 minutes long', () => {
    const built24 = normalizeBlock({
      title: 'All day', timezone: TZ, startDate: '2026-09-01',
      window: { days: [1, 2, 3, 4, 5], startTime: '00:00', endTime: '24:00', granularityMinutes: 60 },
      rules: { minMinutes: 300, maxMinutes: 300, capacity: 1 },
    });
    assert.strictEqual(built24.error, undefined, built24.error);
    assert.strictEqual(built24.block.window.endTime, '24:00');
  });

  check('wallToUtc maps 24:00 onto the following midnight', () => {
    const endOfDay = wallToUtc('2026-09-01', '24:00', TZ);
    const nextMidnight = wallToUtc('2026-09-02', '00:00', TZ);
    assert.strictEqual(endOfDay.getTime(), nextMidnight.getTime());
  });

  check('the last five hours of the day can be claimed', () => {
    const built24 = normalizeBlock({
      title: 'All day', timezone: TZ, startDate: '2026-09-01', endDate: '2026-09-30',
      window: { days: [1, 2, 3, 4, 5], startTime: '00:00', endTime: '24:00', granularityMinutes: 60 },
      rules: {
        minMinutes: 300, maxMinutes: 300, maxMinutesPerDay: null,
        maxMinutesPerWeek: null, maxClaimsPerDay: null, capacity: 1,
        advanceNoticeMinutes: 0, horizonDays: null,
      },
    });
    const B = { _id: 'b24', ownerId: 'owner1', ...built24.block };

    // 19:00 → 24:00 on Tuesday 1 September. This is the exact range the bug
    // made unreachable.
    const start = wallToUtc('2026-09-01', '19:00', TZ);
    const end = wallToUtc('2026-09-01', '24:00', TZ);
    const res = validateClaim({ block: B, user: RAM, start, end, now: NOW });
    assert.ok(res.ok, `the evening claim was refused: ${res.code} ${res.message}`);
    assert.strictEqual(res.minutes, 300);
  });

  check('a claim ending at midnight is not treated as straddling it', () => {
    const built24 = normalizeBlock({
      title: 'All day', timezone: TZ, startDate: '2026-09-01', endDate: '2026-09-30',
      window: { days: [1, 2, 3, 4, 5], startTime: '00:00', endTime: '24:00', granularityMinutes: 60 },
      rules: { minMinutes: 60, maxMinutes: 300, capacity: 1 },
    });
    const B = { _id: 'b24b', ownerId: 'owner1', ...built24.block };
    const res = validateClaim({
      block: B,
      user: RAM,
      start: wallToUtc('2026-09-01', '23:00', TZ),
      end: wallToUtc('2026-09-01', '24:00', TZ),
      now: NOW,
    });
    assert.ok(res.ok, `the last hour was refused: ${res.code} ${res.message}`);
  });

  check('one minute past midnight is still refused', () => {
    const built24 = normalizeBlock({
      title: 'All day', timezone: TZ, startDate: '2026-09-01', endDate: '2026-09-30',
      window: { days: [1, 2, 3, 4, 5], startTime: '00:00', endTime: '24:00', granularityMinutes: 60 },
      rules: { minMinutes: 60, maxMinutes: 300, capacity: 1 },
    });
    const B = { _id: 'b24c', ownerId: 'owner1', ...built24.block };
    const res = validateClaim({
      block: B,
      user: RAM,
      start: wallToUtc('2026-09-01', '23:00', TZ),
      // 01:00 the next day — genuinely across midnight, and still not allowed.
      end: wallToUtc('2026-09-02', '01:00', TZ),
      now: NOW,
    });
    assert.ok(!res.ok, 'a claim crossing midnight must still be refused');
  });

  console.log(`\n${passed} checks passed.`);
})().catch((e) => {
  console.error('\nFAILED:', e.message);
  console.error(e.stack);
  process.exit(1);
});
