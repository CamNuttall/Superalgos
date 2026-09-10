// The countdown's phase thresholds encode the advice that actually matters on
// sale day, and the wrong message at the wrong moment is the whole ballgame.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { phaseAdvice, DO_NOT, ON_THE_DAY } from '../src/checklist.js'

const MIN = 60_000

test('well before the sale, advice is to do nothing yet', () => {
  assert.equal(phaseAdvice(60 * MIN).phase, 'waiting')
  assert.equal(phaseAdvice(10 * MIN + 1).phase, 'waiting')
})

test('inside ten minutes, advice is to load the page and stop touching it', () => {
  assert.equal(phaseAdvice(10 * MIN).phase, 'load-now')
  assert.equal(phaseAdvice(MIN + 1).phase, 'load-now')
})

test('inside the final minute, advice is hands off', () => {
  assert.equal(phaseAdvice(MIN).phase, 'imminent')
  assert.equal(phaseAdvice(1).phase, 'imminent')
})

test('at and after the sale opening, advice is to wait in the queue', () => {
  assert.equal(phaseAdvice(0).phase, 'open')
  assert.equal(phaseAdvice(-5 * MIN).phase, 'open')
})

test('every phase tells you not to refresh, or not to touch anything', () => {
  for (const gap of [30 * MIN, 5 * MIN, 30_000, -MIN]) {
    const text = phaseAdvice(gap).lines.join(' ').toLowerCase()
    const safe = text.includes('refresh') || text.includes('do nothing') || text.includes('hands off')
    assert.ok(safe, `phase at gap ${gap} gave no restraint instruction: ${text}`)
  }
})

test('the do-not list leads with auto-refresh bots', () => {
  assert.match(DO_NOT[0].thing.toLowerCase(), /refresh|bot/)
})

test('on-the-day list warns about one tab per IP', () => {
  const joined = ON_THE_DAY.join(' ').toLowerCase()
  assert.ok(joined.includes('one tab'))
  assert.ok(joined.includes('ip address'))
})
