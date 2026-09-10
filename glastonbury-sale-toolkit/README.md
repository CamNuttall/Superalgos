# Glastonbury Sale-Day Toolkit

Preparation tooling for the Glastonbury 2027 ticket sale.

**This does not automate the ticket sale.** It never contacts See Tickets, never
fills a form and never refreshes anything. It handles the parts you *can*
control: your clock, your paperwork, your syndicate, and knowing exactly what to
do at 08:59 on a Sunday morning.

## Why there is no refresh bot in here

Glastonbury replaced the refresh-scramble with a **random queue** in 2025.
Everyone already on the page when the sale opens is assigned a random queue
position. Refresh speed is worth precisely nothing, and See Tickets' own guidance
is explicit:

> Do not refresh your page once you are in the queue — you may lose your place
> and this could harm your chances by appearing as suspicious bot behaviour.

> Running multiple devices or tabs simultaneously to attempt to access the
> website may lead to your IP address being blocked, preventing you from buying
> a ticket.

So an auto-refresher takes a fair random draw and converts it into a likely IP
ban. It makes your odds worse, not better. (Separately, the UK's *Breaching of
Limits on Ticket Sales Regulations 2018* makes it a criminal offence to use
automated software to buy above an event's purchase limits.)

The things that genuinely improve your chances are all in this toolkit.

## Install

Node 18 or newer. No dependencies.

```bash
cd glastonbury-sale-toolkit
node src/cli.js plan
```

Optionally link it as `glasto`:

```bash
npm link
glasto plan
```

## Setup

```bash
node src/cli.js init      # creates config.json from the example
```

Then edit `config.json` with everyone's details:

```json
{
  "perAttemptOdds": 0.08,
  "party": [
    {
      "name": "Cam",
      "registrationNumber": "1234567",
      "postcode": "BA10 0AA",
      "attempting": true,
      "network": "home broadband",
      "priority": 1
    }
  ]
}
```

| Field | Meaning |
| --- | --- |
| `registrationNumber` | Their Glastonbury registration number. Required to book. |
| `postcode` | The postcode **on their registration**, not their current address. |
| `attempting` | Whether they will be sat at the sale trying. |
| `network` | Their internet connection. Used to detect shared-IP clashes. |
| `priority` | Booking order if more than 6 people are listed. |

`config.json` is gitignored — it holds personal data and never gets committed.

## Commands

| Command | What it does |
| --- | --- |
| `glasto plan` | Key dates, live countdowns, and what you will pay |
| `glasto sync` | How far your machine's clock is from real time |
| `glasto check` | Pre-flight checklist run against your config |
| `glasto party` | Paste-ready booking details for the form |
| `glasto odds` | Syndicate arithmetic |
| `glasto go` | Live synced countdown for sale day |

### `sync` — the one people skip

The queue draw happens at a specific instant. If your laptop clock is 40 seconds
fast you will think you have time when the draw has already happened; if it is
slow you will still be typing the URL. `sync` measures your offset against
several HTTPS time sources, compensating for round-trip latency the way NTP does:

```
offset = serverTime - (t0 + t1) / 2
```

It prefers sources that report sub-second time, falls back to `Date` headers when
those are blocked, and discards any non-2xx response — a captive portal or
corporate proxy will happily serve an error page with its own wrong `Date`
header, and trusting that would be worse than not syncing at all.

### `odds` — why the syndicate is the whole game

One transaction books up to **6 people**. So a group of 6 does not need all six
members to get through — it needs exactly **one**. Every extra registered friend
who tries is another independent draw at the same prize:

```
P(at least one succeeds) = 1 - (1 - p)^n
```

At a rough 8% per person, 1 person is 8%, 6 people is 39%, 12 people is 63%.

**This only works with real, separately registered people on separate networks.**
Six tabs on your own wifi is not six attempts — it is one IP address running six
sessions, which is exactly the pattern that gets blocked. `glasto check` and
`glasto party` both flag it when two attempters share a `network` value.

## Key dates

| What | When |
| --- | --- |
| Registration closes | 5pm BST, Fri 25 Sep 2026 |
| Coach + ticket packages | 6pm BST, Thu 1 Oct 2026 |
| General admission | 9am BST, Sun 4 Oct 2026 |
| Balance payable | 1–7 Apr 2027 |
| Festival opens | Wed 23 Jun 2027 |

£408 per ticket (incl. £5 booking fee) — £100 deposit per person on the day, £308
balance in April. Up to 6 tickets per transaction.

Dates live in `src/schedule.js` as UTC instants. **Verify them against
[the official ticket page](https://www.glastonburyfestivals.co.uk/information/tickets/)
before relying on them** — the 2024 sale was postponed at short notice.

## Tests

```bash
npm test
```

Covers the time-source parsers (which the network usually blocks, so they would
otherwise go untested), the countdown's phase thresholds, and the syndicate
arithmetic.

## The short version

1. Register everyone **before 25 September**. Nothing else matters if you miss it.
2. Get as many separately-registered friends on separate networks as you can.
3. Agree the priority six in writing, beforehand.
4. Sync your clock.
5. Load the page ten minutes early, on one tab.
6. Then sit on your hands. Do not refresh.
