// The sale-day protocol, in the order it actually happens.
//
// Sourced from See Tickets' and the Festival's own published guidance for the
// random-queue system introduced in 2025. The rules changed: refreshing used to
// be the strategy and is now actively harmful.

export const BEFORE_THE_DAY = [
  'Every person in the party is registered, and registration closed before you needed to change anything.',
  'You have each person\'s registration number AND their registered postcode, saved somewhere offline.',
  'Card details are saved in the browser, or the physical card is on the desk. Not in another room.',
  'Card has a high enough limit for the full deposit (£100 per person) in one transaction.',
  'Your bank knows a large card payment is coming, so it is not declined for fraud.',
  'You have told your bank\'s app to not require a second device you might not have to hand.',
  'Everyone in the syndicate is on a DIFFERENT network. Not six people on one house wifi.',
  'Priority order is agreed in writing. Who is in the six if only one person gets through?',
  'One nominated person is the decision-maker if something goes wrong. Group votes cost minutes.'
]

export const ON_THE_DAY = [
  'Load the sale page at least 10 minutes early, then leave it alone.',
  'ONE tab. ONE device. Per person, per IP address.',
  'Close every other tab pointed at the sale.',
  'Turn off any VPN. A shared VPN exit IP looks like many people on one address.',
  'Do NOT refresh. You lose your queue place and it reads as bot behaviour.',
  'Do not close the laptop lid, let the machine sleep, or let the phone lock.',
  'Have the paste block open on a second screen or printed out.',
  'Group chat open on a separate device, so nobody touches the queue tab to type.'
]

export const IF_YOU_GET_THROUGH = [
  'Say so in the group chat immediately, so nobody else buys a duplicate.',
  'Enter the party in the agreed priority order. Do not renegotiate now.',
  'Type registration numbers carefully. A typo fails the whole booking.',
  'Complete the payment before you celebrate.',
  'Screenshot the confirmation.',
  'Set a calendar reminder for the balance deadline the moment you are done.'
]

export const DO_NOT = [
  { thing: 'Auto-refresh scripts / bots', why: 'The queue is a random draw. Refreshing forfeits your place and flags you.' },
  { thing: 'Multiple tabs or devices on one IP', why: 'Explicitly warned against — leads to the IP being blocked entirely.' },
  { thing: 'Resale sites / touts', why: 'Tickets carry your photo and are non-transferable. A resale ticket will not get you in.' },
  { thing: 'Paying anyone who "guarantees" tickets', why: 'There is no such thing. It is a scam, every time.' }
]

export function evaluate (config) {
  const results = []
  const party = config.party || []

  results.push({
    ok: party.length > 0,
    label: 'Party list populated',
    detail: `${party.length} people listed`
  })

  const withReg = party.filter(m => m.registrationNumber)
  results.push({
    ok: withReg.length === party.length && party.length > 0,
    label: 'All registration numbers present',
    detail: `${withReg.length}/${party.length}`
  })

  const withPostcode = party.filter(m => m.postcode)
  results.push({
    ok: withPostcode.length === party.length && party.length > 0,
    label: 'All registered postcodes present',
    detail: `${withPostcode.length}/${party.length}`
  })

  const attempting = party.filter(m => m.attempting !== false)
  results.push({
    ok: attempting.length > 0,
    label: 'At least one person attempting',
    detail: `${attempting.length} attempting`
  })

  const networks = new Set(attempting.map(m => (m.network || '').trim().toLowerCase()).filter(Boolean))
  results.push({
    ok: networks.size === attempting.length && attempting.length > 0,
    label: 'Every attempter on a distinct network',
    detail: `${networks.size} distinct networks for ${attempting.length} attempters`
  })

  const prioritised = party.filter(m => typeof m.priority === 'number')
  results.push({
    ok: party.length <= 6 || prioritised.length === party.length,
    label: 'Priority order agreed',
    detail: party.length <= 6 ? 'party fits in one transaction' : `${prioritised.length}/${party.length} have a priority`
  })

  return results
}

/**
 * What to be doing right now, given how long until the sale opens.
 * `gapMs` is positive before the sale and negative once it is open.
 * Extracted from the countdown so the thresholds can be tested directly.
 */
export function phaseAdvice (gapMs) {
  if (gapMs <= 0) {
    return {
      phase: 'open',
      urgency: 'live',
      lines: [
        'Wait in the queue. Do not refresh, whatever it says.',
        'The progress bar moves on its own. Refreshing sends you to the back.'
      ]
    }
  }
  if (gapMs <= 60_000) {
    return {
      phase: 'imminent',
      urgency: 'critical',
      lines: [
        'HANDS OFF THE KEYBOARD.',
        'Do not refresh. The queue assigns you a place automatically.'
      ]
    }
  }
  if (gapMs <= 10 * 60_000) {
    return {
      phase: 'load-now',
      urgency: 'warn',
      lines: [
        'Open the sale page NOW and leave it completely alone.',
        'One tab. Do not refresh. Do not reload.'
      ]
    }
  }
  return {
    phase: 'waiting',
    urgency: 'calm',
    lines: ['Not yet. Open the page 10 minutes before, then do nothing.']
  }
}
