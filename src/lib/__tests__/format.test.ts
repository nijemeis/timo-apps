import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  dayKey, dayPart, firstName, formatDateLong, formatDayHeader, formatDuration, formatHours, formatRange, formatRanged,
  formatTime, formatTimer, groupByDay, initials, maskTime, monthLabel, parseHHMM, periodRange, shortUuid, startOfWeek,
  validateCorrection, zonedTime,
} from '../format.js';

const TZ = 'Europe/Amsterdam';

test('formatDuration uses h/u and pads minutes', () => {
  assert.equal(formatDuration(8 * 3600e3 + 12 * 60e3, 'en'), '8h 12m');
  assert.equal(formatDuration(8 * 3600e3 + 12 * 60e3, 'nl'), '8u 12m');
  assert.equal(formatDuration(54 * 60e3 + 16e3, 'en'), '0h 54m');
  assert.equal(formatDuration(54 * 60e3 + 32e3, 'en'), '0h 55m');
  assert.equal(formatDuration(-5000, 'en'), '0h 00m');
});

test('formatTimer', () => {
  assert.equal(formatTimer(54 * 60e3 + 16e3), '00:54:16');
  assert.equal(formatTimer(10 * 3600e3 + 999), '10:00:00');
});

test('formatHours localises the decimal separator', () => {
  assert.equal(formatHours(40, 'en'), '40');
  assert.equal(formatHours(32.5, 'en'), '32.5');
  assert.equal(formatHours(32.5, 'nl'), '32,5');
});

test('times are shown in the registration time zone', () => {
  const inAt = '2026-09-24T05:58:00.000Z'; // 07:58 CEST
  assert.equal(formatTime(inAt, TZ), '07:58');
  assert.equal(formatTime(inAt, 'Europe/London'), '06:58');
  assert.equal(formatRange(inAt, '2026-09-24T15:20:00.000Z', TZ, 'running'), '07:58 – 17:20');
  assert.equal(formatRange(inAt, null, TZ, 'running'), '07:58 – running');
});

test('zonedTime and week/period ranges respect DST', () => {
  assert.equal(zonedTime(2026, 9, 24, 7, 58, TZ).toISOString(), '2026-09-24T05:58:00.000Z');
  assert.equal(zonedTime(2026, 1, 5, 7, 58, TZ).toISOString(), '2026-01-05T06:58:00.000Z');
  const now = new Date('2026-09-24T06:52:00.000Z'); // Thursday
  assert.equal(startOfWeek(now, TZ).toISOString(), '2026-09-20T22:00:00.000Z'); // Mon 21 Sep 00:00
  const [wf, wt] = periodRange('week', now, TZ);
  assert.equal(wf.toISOString(), '2026-09-20T22:00:00.000Z');
  assert.equal(wt.toISOString(), '2026-09-27T22:00:00.000Z');
  const [lf, lt] = periodRange('last', now, TZ);
  assert.equal(lf.toISOString(), '2026-09-13T22:00:00.000Z');
  assert.equal(lt.toISOString(), wf.toISOString());
  const [mf, mt] = periodRange('month', now, TZ);
  assert.equal(mf.toISOString(), '2026-08-31T22:00:00.000Z');
  assert.equal(mt.toISOString(), '2026-09-30T22:00:00.000Z');
  // Week spanning the October DST switch (Sun 25 Oct 2026)
  const [of, ot] = periodRange('week', new Date('2026-10-22T10:00:00Z'), TZ);
  assert.equal(of.toISOString(), '2026-10-18T22:00:00.000Z');
  assert.equal(ot.toISOString(), '2026-10-25T23:00:00.000Z');
});

test('dayKey uses the local day', () => {
  assert.equal(dayKey('2026-09-23T22:30:00.000Z', TZ), '2026-09-24');
  assert.equal(dayKey('2026-09-23T22:30:00.000Z', 'UTC'), '2026-09-23');
});

test('dates in en-GB and nl-NL', () => {
  const d = '2026-09-24T06:52:00.000Z';
  assert.equal(formatDateLong(d, 'en', TZ), 'Thursday 24 September');
  assert.equal(formatDateLong(d, 'nl', TZ), 'donderdag 24 september');
  assert.match(formatDayHeader(d, 'en', TZ), /^Thursday 24 Sep/);
  assert.equal(monthLabel(d, 'en', TZ), 'September');
  assert.equal(monthLabel(d, 'nl', TZ), 'September');
});

test('greeting day parts switch at 12:00 and 18:00', () => {
  assert.equal(dayPart(11), 'morning');
  assert.equal(dayPart(12), 'afternoon');
  assert.equal(dayPart(17), 'afternoon');
  assert.equal(dayPart(18), 'evening');
});

test('names', () => {
  assert.equal(firstName('Sanne de Vries'), 'Sanne');
  assert.equal(firstName(''), '');
  assert.equal(initials('Sanne de Vries'), 'SV');
  assert.equal(initials('Joost'), 'JO');
  assert.equal(initials('', 'kim@x.nl'), 'KI');
});

test('beacons', () => {
  assert.equal(shortUuid('5A4B0C1E-7F3D-4E2A-9B61-0D8C2E4F7A10'), '5A4B0C1E-7F3D…');
  assert.equal(formatRanged({ major: 1042, minor: 1, rssi: -61 }), '1042/1 · −61 dBm');
});

test('time input mask and parsing', () => {
  assert.equal(maskTime('0758'), '07:58');
  assert.equal(maskTime('07:5'), '07:5');
  assert.equal(maskTime('1'), '1');
  assert.equal(maskTime('17:300'), '17:30');
  assert.equal(parseHHMM('7:58'), 478);
  assert.equal(parseHHMM('24:00'), null);
  assert.equal(parseHHMM('12:60'), null);
});

test('correction validation', () => {
  assert.equal(validateCorrection('07:58', '17:30'), null);
  assert.equal(validateCorrection('07:58', '07:58'), 'out_before_in');
  assert.equal(validateCorrection('17:30', '07:58'), 'out_before_in');
  assert.equal(validateCorrection('06:00', '22:30'), 'too_long');
  assert.equal(validateCorrection('06:00', '22:00'), null);
  assert.equal(validateCorrection('7', '17:30'), 'time');
});

test('groupByDay keeps order and groups by local day', () => {
  const regs = [
    { id: 'a', checkInAt: '2026-09-24T05:58:00Z', timezone: TZ },
    { id: 'b', checkInAt: '2026-09-23T11:02:00Z', timezone: TZ },
    { id: 'c', checkInAt: '2026-09-23T06:03:00Z', timezone: TZ },
  ];
  const g = groupByDay(regs);
  assert.deepEqual(g.map((x) => [x.key, x.items.map((i) => i.id)]), [['2026-09-24', ['a']], ['2026-09-23', ['b', 'c']]]);
});
