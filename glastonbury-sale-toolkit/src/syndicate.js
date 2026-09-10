// The syndicate method, and the arithmetic behind why it works.
//
// One transaction books up to 6 people. So a group of 6 does not need all six
// members to get through the queue — it needs exactly ONE. Every additional
// registered friend who attempts is another independent draw at the same prize.
//
// This is the single biggest legitimate lever you have, and it is explicitly
// within the rules: See Tickets prohibits one person running multiple tabs or
// devices behind one IP, not several real people each using their own
// connection. The distinction matters, and `warnings()` below enforces it.

import { FACTS } from './schedule.js'

/**
 * Probability that at least one of `attempts` independent tries succeeds.
 * @param {number} perAttempt probability a single person reaches the booking page
 * @param {number} attempts number of distinct people trying
 */
export function groupOdds (perAttempt, attempts) {
  if (perAttempt <= 0 || attempts <= 0) return 0
  if (perAttempt >= 1) return 1
  return 1 - Math.pow(1 - perAttempt, attempts)
}

/** How many attempters you need for a target overall probability. */
export function attemptsNeeded (perAttempt, target) {
  if (perAttempt <= 0 || perAttempt >= 1) return Infinity
  if (target >= 1) return Infinity
  return Math.ceil(Math.log(1 - target) / Math.log(1 - perAttempt))
}

/** A table of overall odds as the syndicate grows. */
export function oddsTable (perAttempt, maxAttempts = 12) {
  const rows = []
  for (let n = 1; n <= maxAttempts; n++) {
    rows.push({ attempters: n, odds: groupOdds(perAttempt, n) })
  }
  return rows
}

/**
 * Checks a syndicate for the patterns that get IP addresses blocked.
 * Returns an array of { level, message }.
 */
export function warnings (members) {
  const out = []

  const attempting = members.filter(m => m.attempting !== false)
  if (attempting.length === 0) {
    out.push({ level: 'error', message: 'Nobody is marked as attempting. At least one person must be on the page.' })
  }

  // Several people behind one router present as one IP running several sessions
  // — indistinguishable from the multi-tab behaviour that triggers a block.
  const networks = new Map()
  for (const m of attempting) {
    const key = (m.network || 'unspecified').trim().toLowerCase()
    networks.set(key, [...(networks.get(key) || []), m.name])
  }
  for (const [network, names] of networks) {
    if (network === 'unspecified') {
      out.push({
        level: 'warn',
        message: `No network set for ${names.join(', ')}. Give each attempter a distinct network so you can spot IP clashes.`
      })
    } else if (names.length > 1) {
      out.push({
        level: 'error',
        message: `${names.join(' and ')} share the network "${network}". That is one IP running multiple sessions — the exact pattern that gets blocked. Move all but one onto mobile data.`
      })
    }
  }

  const unregistered = members.filter(m => !m.registrationNumber)
  if (unregistered.length) {
    out.push({
      level: 'error',
      message: `Missing registration number for ${unregistered.map(m => m.name).join(', ')}. They cannot be added to a booking.`
    })
  }

  const missingPostcode = members.filter(m => m.registrationNumber && !m.postcode)
  if (missingPostcode.length) {
    out.push({
      level: 'error',
      message: `Missing registered postcode for ${missingPostcode.map(m => m.name).join(', ')}. You need it at the booking form.`
    })
  }

  if (members.length > FACTS.maxPerTransaction) {
    out.push({
      level: 'info',
      message: `${members.length} people listed but only ${FACTS.maxPerTransaction} fit in one transaction. Decide the priority order NOW, in writing — not at 9am.`
    })
  }

  return out
}

/** Total payable at the booking form for a given party size. */
export function depositTotal (partySize) {
  return partySize * FACTS.depositPerPerson
}

export function balanceTotal (partySize) {
  return partySize * FACTS.balancePerPerson
}
