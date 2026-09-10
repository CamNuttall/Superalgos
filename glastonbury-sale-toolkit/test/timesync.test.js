// Unit tests for the time-source parsers. These run without network access,
// which matters because the sub-second sources are exactly the ones a
// restrictive network blocks — so they would otherwise go untested.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SOURCES } from '../src/timesync.js'

const byName = name => SOURCES.find(s => s.name === name)

test('cloudflare trace body parses to sub-second epoch millis', () => {
  const body = 'fl=123abc\nh=cloudflare.com\nip=1.2.3.4\nts=1790000000.456\nvisit_scheme=https\n'
  assert.equal(byName('cloudflare').parse(body), 1790000000456)
})

test('cloudflare parser returns null when ts is absent', () => {
  assert.equal(byName('cloudflare').parse('fl=123abc\nh=cloudflare.com\n'), null)
})

test('cloudflare parser returns null on a non-numeric ts', () => {
  assert.equal(byName('cloudflare').parse('ts=not-a-number\n'), null)
})

test('worldtimeapi body parses its ISO datetime', () => {
  const body = JSON.stringify({ datetime: '2026-10-04T08:00:00.250+00:00', unixtime: 1791100800 })
  assert.equal(byName('worldtimeapi').parse(body), Date.parse('2026-10-04T08:00:00.250Z'))
})

test('worldtimeapi parser returns null on malformed JSON', () => {
  assert.equal(byName('worldtimeapi').parse('<html>502 Bad Gateway</html>'), null)
})

test('sub-second sources are preferred over Date-header sources', () => {
  const precise = SOURCES.filter(s => s.resolutionMs <= 1).map(s => s.name)
  const coarse = SOURCES.filter(s => s.resolutionMs > 1).map(s => s.name)
  assert.ok(precise.length > 0, 'expected at least one sub-second source')
  assert.ok(coarse.length > 0, 'expected at least one fallback source')
})
