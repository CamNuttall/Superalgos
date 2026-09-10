// Key dates for the Glastonbury 2027 ticket sale.
//
// All times are stored as UTC instants so there is no daylight-saving ambiguity.
// The published times are BST (UTC+1); BST does not end until 25 Oct 2026, so
// every October date below is BST and sits one hour behind its UTC value.
//
// Always re-verify against https://www.glastonburyfestivals.co.uk/information/tickets/
// before relying on these. Sales have been postponed before (2024).

export const MILESTONES = [
  {
    id: 'registration-closes',
    label: 'Registration closes',
    utc: '2026-09-25T16:00:00Z',
    localLabel: '5pm BST, Friday 25 September 2026',
    critical: true,
    note: 'No new or amended registrations after this. Miss it and you cannot buy in October, full stop.'
  },
  {
    id: 'coach-sale',
    label: 'Coach + ticket packages on sale',
    utc: '2026-10-01T17:00:00Z',
    localLabel: '6pm BST, Thursday 1 October 2026',
    critical: true,
    note: 'Smaller pool than general sale but far fewer people try. A genuinely better per-person chance if you can travel by coach.'
  },
  {
    id: 'general-sale',
    label: 'General admission tickets on sale',
    utc: '2026-10-04T08:00:00Z',
    localLabel: '9am BST, Sunday 4 October 2026',
    critical: true,
    note: 'The big one. Be on the page and idle several minutes early.'
  },
  {
    id: 'balance-opens',
    label: 'Balance payment window opens',
    utc: '2027-04-01T08:00:00Z',
    localLabel: '9am BST, Thursday 1 April 2027',
    note: 'Remaining balance per ticket becomes payable.'
  },
  {
    id: 'balance-closes',
    label: 'Balance payment deadline',
    utc: '2027-04-07T22:59:00Z',
    localLabel: '11.59pm BST, Wednesday 7 April 2027',
    critical: true,
    note: 'Miss this and the tickets are cancelled and resold. Put it in your calendar now.'
  },
  {
    id: 'festival',
    label: 'Glastonbury 2027 opens',
    utc: '2027-06-23T07:00:00Z',
    localLabel: 'Wednesday 23 June 2027',
    note: 'Gates open.'
  }
]

export const FACTS = {
  ticketPrice: 408,
  bookingFeeIncluded: 5,
  depositPerPerson: 100,
  balancePerPerson: 308,
  maxPerTransaction: 6,
  registrationUrl: 'https://glastonburyregistration.seetickets.com',
  saleUrl: 'https://glastonbury.seetickets.com',
  infoUrl: 'https://www.glastonburyfestivals.co.uk/information/tickets/'
}

/** Milestones still in the future, relative to a corrected timestamp (ms). */
export function upcoming (nowMs = Date.now()) {
  return MILESTONES
    .map(m => ({ ...m, at: Date.parse(m.utc) }))
    .filter(m => m.at > nowMs)
    .sort((a, b) => a.at - b.at)
}

/** The next milestone, or null once everything has passed. */
export function next (nowMs = Date.now()) {
  return upcoming(nowMs)[0] || null
}

export function findMilestone (id) {
  const m = MILESTONES.find(x => x.id === id)
  return m ? { ...m, at: Date.parse(m.utc) } : null
}

/** "2d 4h 11m 09s" — omits leading units that are zero. */
export function formatGap (ms) {
  if (ms < 0) return '-' + formatGap(-ms)
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const parts = []
  if (d) parts.push(d + 'd')
  if (d || h) parts.push(h + 'h')
  if (d || h || m) parts.push(m + 'm')
  parts.push(String(sec).padStart(2, '0') + 's')
  return parts.join(' ')
}
