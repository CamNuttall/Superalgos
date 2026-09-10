// Loads your party details and prints them in the order the booking form asks
// for them.
//
// The booking form gives you a limited window to enter a registration number
// and registered postcode for every person before the session times out.
// Hunting through WhatsApp for a friend's postcode at that moment is how groups
// lose tickets they had already won. This prints one clean block to keep open
// on a second screen.

import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CONFIG_PATH = join(ROOT, 'config.json')
const EXAMPLE_PATH = join(ROOT, 'config.example.json')

export function configExists () {
  return existsSync(CONFIG_PATH)
}

export function loadConfig () {
  if (!existsSync(CONFIG_PATH)) {
    throw new Error(
      'No config.json found.\n' +
      `Copy the example and fill it in:\n\n  cp ${EXAMPLE_PATH} ${CONFIG_PATH}\n`
    )
  }
  let raw
  try {
    raw = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'))
  } catch (err) {
    throw new Error(`config.json is not valid JSON: ${err.message}`)
  }

  const party = Array.isArray(raw.party) ? raw.party : []
  if (party.length === 0) throw new Error('config.json has an empty "party" list.')

  for (const [i, member] of party.entries()) {
    if (!member.name) throw new Error(`Party member ${i + 1} has no "name".`)
  }

  return {
    perAttemptOdds: typeof raw.perAttemptOdds === 'number' ? raw.perAttemptOdds : 0.08,
    party
  }
}

/** Party in the order you intend to book them, respecting explicit priority. */
export function bookingOrder (party) {
  return [...party].sort((a, b) => {
    const pa = a.priority ?? Number.MAX_SAFE_INTEGER
    const pb = b.priority ?? Number.MAX_SAFE_INTEGER
    if (pa !== pb) return pa - pb
    return a.name.localeCompare(b.name)
  })
}

/** Plain-text block to keep open on a second screen while booking. */
export function pasteBlock (party) {
  const ordered = bookingOrder(party)
  const MISSING = '** MISSING **'

  const rows = ordered.map((m, i) => ({
    index: String(i + 1).padStart(2) + '.',
    name: m.name,
    reg: m.registrationNumber || MISSING,
    postcode: m.postcode || MISSING
  }))

  // Width each column to its widest value, so a MISSING placeholder does not
  // shunt the rest of the row out of alignment.
  const widthOf = (key, header) =>
    Math.max(header.length, ...rows.map(r => r[key].length))
  const nameW = widthOf('name', 'NAME')
  const regW = widthOf('reg', 'REG NUMBER')
  const postW = widthOf('postcode', 'POSTCODE')

  const line = (a, b, c, d) =>
    `${a.padEnd(4)}${b.padEnd(nameW + 3)}${c.padEnd(regW + 3)}${d}`

  const header = line('', 'NAME', 'REG NUMBER', 'POSTCODE')
  const divider = '-'.repeat(header.length + postW - 'POSTCODE'.length)

  return [
    header,
    divider,
    ...rows.map(r => line(r.index, r.name, r.reg, r.postcode))
  ].join('\n')
}
