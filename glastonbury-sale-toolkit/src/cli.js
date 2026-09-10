#!/usr/bin/env node
// Glastonbury sale-day toolkit.
//
// This tool never contacts See Tickets and never automates any part of the
// purchase. It syncs your clock, checks your paperwork, does the syndicate
// arithmetic and counts you down. The clicking is yours.

import { MILESTONES, FACTS, next, findMilestone, formatGap } from './schedule.js'
import { measureOffset, describeOffset } from './timesync.js'
import { loadConfig, configExists, pasteBlock, bookingOrder } from './party.js'
import { attemptsNeeded, oddsTable, warnings, depositTotal, balanceTotal } from './syndicate.js'
import { BEFORE_THE_DAY, ON_THE_DAY, IF_YOU_GET_THROUGH, DO_NOT, evaluate, phaseAdvice } from './checklist.js'

const useColour = process.stdout.isTTY && !process.env.NO_COLOR
const c = (code, s) => useColour ? `\x1b[${code}m${s}\x1b[0m` : s
const bold = s => c('1', s)
const dim = s => c('2', s)
const red = s => c('31', s)
const green = s => c('32', s)
const yellow = s => c('33', s)
const cyan = s => c('36', s)

const rule = () => console.log(dim('-'.repeat(64)))
const heading = s => { console.log(); console.log(bold(s)); rule() }

function pct (x) { return (x * 100).toFixed(1) + '%' }

function tryConfig () {
  try { return loadConfig() } catch { return null }
}

// -- commands ---------------------------------------------------------------

async function cmdPlan () {
  const { offsetMs, ok } = await measureOffset({ rounds: 2 })
  const now = Date.now() + offsetMs

  console.log()
  console.log(bold('  GLASTONBURY 2027 - SALE PLAN'))
  console.log(dim('  ' + (ok ? 'clock synced' : 'offline, using local clock')))

  heading('KEY DATES')
  for (const m of MILESTONES) {
    const at = Date.parse(m.utc)
    const passed = at <= now
    const mark = passed ? dim('[x]') : (m.critical ? red(' ! ') : cyan(' o '))
    const when = passed ? dim('passed') : formatGap(at - now)
    console.log(`  ${mark} ${m.label.padEnd(38)} ${when}`)
    console.log(`      ${dim(m.localLabel)}`)
  }

  const n = next(now)
  if (n) {
    heading('NEXT UP')
    console.log(`  ${bold(n.label)} in ${bold(formatGap(n.at - now))}`)
    console.log(`  ${dim(n.localLabel)}`)
    console.log()
    console.log('  ' + n.note)
  }

  heading('MONEY')
  console.log(`  Ticket             GBP ${FACTS.ticketPrice} (includes GBP ${FACTS.bookingFeeIncluded} booking fee)`)
  console.log(`  Deposit on the day GBP ${FACTS.depositPerPerson} per person`)
  console.log(`  Balance in April   GBP ${FACTS.balancePerPerson} per person`)

  const config = tryConfig()
  if (config) {
    const size = Math.min(config.party.length, FACTS.maxPerTransaction)
    console.log()
    console.log(`  For your party of ${size}: ${bold('GBP ' + depositTotal(size))} on the day, GBP ${balanceTotal(size)} in April.`)
  } else {
    console.log()
    console.log(dim('  No config.json yet - run `glasto init` to set up your party.'))
  }

  console.log()
  console.log(dim(`  Verify everything: ${FACTS.infoUrl}`))
  console.log()
}

async function cmdSync () {
  console.log()
  console.log(bold('  CLOCK SYNC'))
  rule()
  const result = await measureOffset({ rounds: 4 })

  if (!result.ok) {
    console.log(red('  Could not reach any time source.'))
    console.log(dim('  Check your connection and try again before sale day.'))
    console.log()
    return
  }

  const { offsetMs, uncertaintyMs, samples } = result
  console.log(`  Measured from ${samples.length} samples across ${new Set(samples.map(s => s.source)).size} sources.`)
  console.log()
  console.log(`  Offset       ${bold((offsetMs > 0 ? '+' : '') + offsetMs + 'ms')}  ${dim('(add to your clock for real time)')}`)
  console.log(`  Uncertainty  +/-${uncertaintyMs}ms`)
  console.log()

  const abs = Math.abs(offsetMs)
  if (abs < 1000) {
    console.log('  ' + green('OK  ' + describeOffset(offsetMs)) + ' - good enough.')
  } else if (abs < 5000) {
    console.log('  ' + yellow('!   ' + describeOffset(offsetMs)))
    console.log(dim('      Enable automatic time sync in your OS settings.'))
  } else {
    console.log('  ' + red('BAD ' + describeOffset(offsetMs)))
    console.log(red('      Fix this before sale day. You could miss the draw entirely.'))
  }
  console.log()
  console.log(dim('  Sources: ' + samples.map(s => `${s.source} ${s.rtt}ms`).join(', ')))
  console.log()
}

async function cmdParty () {
  const config = loadConfig()
  console.log()
  console.log(bold('  BOOKING DETAILS - keep this open on a second screen'))
  rule()
  console.log()
  console.log(pasteBlock(config.party))
  console.log()

  const issues = warnings(config.party)
  if (issues.length) {
    heading('PROBLEMS')
    for (const w of issues) {
      const tag = w.level === 'error' ? red('[!]') : w.level === 'warn' ? yellow('[?]') : cyan('[i]')
      console.log(`  ${tag} ${w.message}`)
    }
  }

  if (config.party.length > FACTS.maxPerTransaction) {
    heading('IF ONLY ONE PERSON GETS THROUGH')
    const first = bookingOrder(config.party).slice(0, FACTS.maxPerTransaction)
    console.log('  These ' + FACTS.maxPerTransaction + ' get booked, in this order:')
    for (const [i, m] of first.entries()) console.log(`    ${i + 1}. ${m.name}`)
    console.log()
    console.log(dim('  Agree this now. Do not renegotiate at 9am.'))
  }
  console.log()
}

async function cmdOdds (args) {
  const config = tryConfig()
  const flagOdds = Number(args.find(a => a.startsWith('--p='))?.slice(4))
  const perAttempt = Number.isFinite(flagOdds) ? flagOdds : (config?.perAttemptOdds ?? 0.08)

  console.log()
  console.log(bold('  SYNDICATE ODDS'))
  rule()
  console.log(`  Assuming each person has a ${bold(pct(perAttempt))} chance of reaching the booking page.`)
  console.log(dim('  Override with --p=0.05. This is a rough public estimate, not a published figure.'))
  console.log()
  console.log('  ' + dim('One transaction covers 6 people, so you need ONE of you to get through.'))
  console.log()

  const attempting = config ? config.party.filter(m => m.attempting !== false).length : 0
  for (const row of oddsTable(perAttempt, 12)) {
    const bar = '#'.repeat(Math.round(row.odds * 40))
    const mark = row.attempters === attempting ? cyan('  <- you') : ''
    console.log(`  ${String(row.attempters).padStart(2)} trying   ${pct(row.odds).padStart(6)}  ${dim(bar)}${mark}`)
  }

  console.log()
  for (const target of [0.5, 0.75, 0.9]) {
    console.log(`  For a ${pct(target)} chance you need ${bold(attemptsNeeded(perAttempt, target) + ' people')} trying.`)
  }
  console.log()
  console.log(yellow('  Each must be a real, separately registered person on their own network.'))
  console.log(yellow('  Six tabs on your own wifi is not six attempts - it is one IP ban.'))
  console.log()
}

async function cmdCheck () {
  console.log()
  console.log(bold('  PRE-FLIGHT CHECK'))
  rule()

  const config = tryConfig()
  if (config) {
    for (const r of evaluate(config)) {
      const mark = r.ok ? green('[x]') : red('[ ]')
      console.log(`  ${mark} ${r.label.padEnd(42)} ${dim(r.detail)}`)
    }
  } else {
    console.log(dim('  No config.json - showing the generic checklist only.'))
  }

  heading('BEFORE THE DAY')
  for (const item of BEFORE_THE_DAY) console.log(`  [ ] ${item}`)

  heading('ON THE DAY')
  for (const item of ON_THE_DAY) console.log(`  [ ] ${item}`)

  heading('IF YOU GET THROUGH')
  for (const item of IF_YOU_GET_THROUGH) console.log(`  [ ] ${item}`)

  heading('DO NOT')
  for (const d of DO_NOT) {
    console.log(`  ${red('X')} ${bold(d.thing)}`)
    console.log(`    ${dim(d.why)}`)
  }
  console.log()
}

async function cmdGo (args) {
  const target = args.find(a => !a.startsWith('-')) || 'general-sale'
  const milestone = findMilestone(target)
  if (!milestone) {
    console.error(red(`Unknown milestone "${target}".`))
    console.error('Try one of: ' + MILESTONES.map(m => m.id).join(', '))
    process.exitCode = 1
    return
  }

  process.stdout.write('Syncing clock... ')
  const { offsetMs, uncertaintyMs, ok } = await measureOffset({ rounds: 3 })
  console.log(ok ? green('done') : yellow('offline, using local clock'))

  const config = tryConfig()
  const paste = config ? pasteBlock(config.party) : null

  const render = () => {
    const now = Date.now() + offsetMs
    const gap = milestone.at - now
    console.clear()
    console.log()
    console.log('  ' + bold(milestone.label.toUpperCase()))
    console.log('  ' + dim(milestone.localLabel))
    console.log()

    const advice = phaseAdvice(gap)
    if (gap > 0) {
      console.log('  ' + bold(cyan(formatGap(gap))))
    } else {
      console.log('  ' + bold(green('SALE IS OPEN')) + dim('  (' + formatGap(-gap) + ' ago)'))
    }
    console.log()

    const paint = { calm: dim, warn: yellow, critical: s => red(bold(s)), live: s => s }[advice.urgency]
    for (const line of advice.lines) console.log('  ' + paint(line))

    console.log()
    console.log(dim('  clock offset ' + (offsetMs > 0 ? '+' : '') + offsetMs + 'ms' +
      (uncertaintyMs !== null ? ' +/-' + uncertaintyMs + 'ms' : '')))

    if (paste) {
      console.log()
      rule()
      console.log(paste)
    }
    console.log()
    console.log(dim('  Ctrl-C to exit.'))
  }

  render()
  const timer = setInterval(render, 250)
  process.on('SIGINT', () => { clearInterval(timer); console.log(); process.exit(0) })
}

async function cmdInit () {
  const { copyFileSync } = await import('node:fs')
  const { join, dirname } = await import('node:path')
  const { fileURLToPath } = await import('node:url')
  const root = join(dirname(fileURLToPath(import.meta.url)), '..')

  if (configExists()) {
    console.log(yellow('config.json already exists - leaving it alone.'))
    return
  }
  copyFileSync(join(root, 'config.example.json'), join(root, 'config.json'))
  console.log(green('Created config.json.'))
  console.log("Fill in each person's registration number, postcode and network, then run:")
  console.log('  glasto check')
}

function usage () {
  console.log(`
${bold('glasto')} - Glastonbury 2027 sale-day toolkit

  ${bold('plan')}            Key dates, countdowns and what you will pay
  ${bold('sync')}            Check how far your clock is from real time
  ${bold('check')}           Pre-flight checklist against your config
  ${bold('party')}           Paste-ready booking details for the form
  ${bold('odds')} [--p=0.08] Syndicate arithmetic
  ${bold('go')} [milestone]  Live synced countdown for sale day
  ${bold('init')}            Create config.json from the example

${dim('Milestones: ' + MILESTONES.map(m => m.id).join(', '))}

${dim('This tool does not contact See Tickets and does not automate any purchase.')}
`)
}

const COMMANDS = { plan: cmdPlan, sync: cmdSync, party: cmdParty, odds: cmdOdds, check: cmdCheck, go: cmdGo, init: cmdInit }

const [, , command = 'plan', ...args] = process.argv
if (command === 'help' || command === '--help' || command === '-h') {
  usage()
} else if (COMMANDS[command]) {
  try {
    await COMMANDS[command](args)
  } catch (err) {
    console.error()
    console.error(red(err.message))
    console.error()
    process.exitCode = 1
  }
} else {
  console.error(red(`Unknown command "${command}"`))
  usage()
  process.exitCode = 1
}
