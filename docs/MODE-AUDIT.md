# Game mode suitability audit

Date: 2026-10-31. Scope: every rule, prize, forfeit and announcement
**currently dealt or suggested** by the app. Retired rules (`RETIRED_TWISTS`,
`RETIRED_HORRORS`) are never dealt again and are not reviewed.

The question asked: is each mode suitable for **all parties**, meaning young
children, older children, mixed family groups and adult-only groups,
including players with different abilities, before the app is public and
paid for.

Severity: **Change** = fix before public launch. **Add** = add a safeguard or
option. **Note** = acceptable, but worth knowing.

## Summary by mode

| Mode | Suggested label | Verdict |
|---|---|---|
| League + Final | All ages | Suitable as is. |
| Knockout | All ages | Suitable as is. |
| Winner Stays On | All ages | Note: a weaker player can spend a long time in the queue. |
| Garden World Cup | All ages | Suitable as is. |
| Golden Boot Race | All ages | Suitable as is. |
| Last One Standing | All ages (5+) | Note: elimination; the first player out sits out the rest. |
| Penalty Shootout Cup | All ages | Suitable as is. |
| Chaos Cup | All ages; tier 3 skills 8+ | Suitable after **one Change** (headers) and the keeper safety note. |
| Horror | **8+** with the No Mercy tier as **10+ or parent-controlled** | Suitable after **three Changes** (named card-game terms, kneeling wall, open forfeit). Spooky theme should be labelled. |
| Prizes and forfeits | Parent's choice | **Change** a handful of suggestions. |
| Full-time announcements | Optional | **Add** a calm alternative. |

The standard modes have no content of their own beyond scores, so all the
findings below are in Chaos, Horror, the stakes suggestions and the announcer.

## 1. Physical safety

| Sev | Where | Key | Issue | Recommendation |
|---|---|---|---|---|
| **Change** | Chaos | `big-head` | "Headers are worth double." This rewards heading. English grassroots football has removed deliberate heading for younger age groups because of concussion and long-term brain-injury concerns, and limits it in training for older children. | Retire it. If a replacement is wanted: "Chest control: goals after a chest trap count double." |
| **Change** | Horror | `tombstone-wall` | A kneeling wall in front of a free kick puts faces at shot height, close to the ball. | Retire it, or change it to a standing wall with "hands behind your back, turn your back on the shot." |
| **Add** | Chaos | `sitting-keeper`, `statue-keeper`, `one-arm-keeper` | The keeper can't protect their face, and a sitting keeper's head is at shot height. | Add a "How:" line saying "Shots below knee height only" to these rules. |
| **Add** | Horror | `possessed-keeper`, `coffin-keeper` | Arms pinned or sitting: same face-height problem. | Same "below knee height" line. |
| Note | Chaos | `flamingo-keeper`, `double-trouble`, `fence-run` | Mild fall or collision risk, normal for garden play. | Covered by the Terms of Use play-safely disclaimer. |
| Note | Horror | `mummy-wrap`, `ghost-chains`, `hopping-vampire` | Running with an arm tucked in or a dragged foot raises trip risk slightly. | The disclaimer is enough; consider keeping these out of tier 1, which young children get first. |

## 2. Emotional fit and fairness

| Sev | Where | Key | Issue | Recommendation |
|---|---|---|---|---|
| **Change** | Horror | `no-mercy` | "The loser does a forfeit of the winner's choosing." This is open-ended and chosen by one child for another, which is where teasing and humiliation start. Every other forfeit in the app is bounded. | Bound it: "…does a forfeit from the list: 10 star jumps, a goofy dance, or fetch every ball next game." |
| **Add** | Horror | Tier 3 secret fates (`wild-draw-ten` −10, `skip-everyone`, `hand-swap`, `pass-your-hand`) | These can push a young child's total negative, or punish someone who wasn't playing. That's fun for older groups and tears for some 6-year-olds. | Add a setup toggle, "No Mercy cards", **on** for "Easy to hard" only when the group is 10+. Alternatively, cap rule order at tier 2 when the toggle is off. |
| **Add** | Horror | Mode as a whole | Witches, séances, possession and ghosts. It's mild and not gory, but some families avoid occult themes for faith reasons. | Label the mode "Spooky: ghosts, witches and curses" on the setup card. It's already opt-in. |
| **Add** | Announcer | `announce.js` loser lines | Each line names the loser aloud with a gross-out joke ("a seagull pooped on {loser}"). Most children love this, but it can sting a sensitive child or feel off in an adult group. | Add a setting: "Silly" (current) or "Classic" ("{winner} wins it! Well played, {loser}!"). |
| Note | Winner Stays On, Last One Standing | n/a | A long queue or early elimination means sitting out. That's normal sport. | Optionally show "Tip: play Chaos or League with young children so everyone keeps playing." |

## 3. Gambling-style mechanics

| Sev | Where | Key | Issue | Recommendation |
|---|---|---|---|---|
| **Add** | Chaos | `double-nothing` (💸), `jackpot` (🎰) | Casino framing for a children's game. The mechanics are harmless (no money, no app scoring); the imagery is the issue. | Keep the rules, swap the emoji and names ("Double or Bust" ⚡, "Triple Goal" 🎯). |
| **Add** | Horror | `soul-wager` ("bet their magic wands"), `double-draw` (🎰) | Same issue. | Change the wording to "duel" and the emoji. |
| Rule | Payments | n/a | When payments arrive, never sell **randomised** content (mystery rule packs, paid re-deals). That is loot-box design: it's under regulatory scrutiny and is a bad fit for a children's audience. | Sell fixed, fully described packs or a plan only. |

## 4. Borrowed names (intellectual property)

Not a children's issue, but it matters once the app charges money. This is
not legal advice; get it checked.

| Sev | Where | Key | Issue | Recommendation |
|---|---|---|---|---|
| **Change** | Horror | `wild-draw-six`, `stacked-draw`, `wild-draw-ten`, `skip-everyone`, `hand-swap` ("A seven was played"), `pass-your-hand` ("A zero was played"), `reverse-card`, `double-draw`, `draw-four`, `stacking-plus-two`, `draw-until-you-play`, `discard-all`, `wild-card`, `skipped`, `no-mercy`, `wipeout` ("Show No Mercy") | The README says this set is "borrowed from the card game". Names such as *Wild Draw Six*, *Draw Four*, *Reverse Card* and *No Mercy*, and the "seven"/"zero" swap rules, closely track a specific trademarked commercial card game. Game mechanics generally aren't protected; distinctive names and branding can be. | Keep the mechanics; rename them into the spooky theme ("Wild Draw Six" → "Six Curses", "Reverse Card" → "Cursed Mirror", "Hand Swap" → "Body Swap", "No Mercy" → "Show No Pity"). Keys stay the same (saved tournaments depend on them); only `label` and `detail` change. |
| **Change** | Horror | `weeping-angel` | "Weeping Angel" is a character from a well-known TV series. | Rename it "Statue Ghost" with the same rule. |
| Note | Horror | `monkeys-paw`, `headless-horseman` | Public-domain stories. | Fine. |

## 5. Prizes and forfeits (`src/engine/stakes.js`)

These are suggestions a parent taps; the free-text box remains. They are
judged as things a public app is seen to recommend to children.

| Sev | Item(s) | Issue | Recommendation |
|---|---|---|---|
| **Change** | Forfeits: "Extra reading for 20 minutes", "Extra homework practice" | They present reading and learning as punishment. Schools and parents generally won't like seeing that from an app. | Remove. |
| **Change** | Forfeits: "No sweets today", "No pudding tonight". Prizes: "A sweet treat", "An ice cream", "Hot chocolate with marshmallows" | Food as reward or punishment is discouraged in child-health guidance. One or two treats are fine; five food items sends a message. | Remove the two food forfeits. Keep at most one food prize ("Pizza night" or "A takeaway night"). |
| **Change** | Prize: "Front seat in the car" | Children's front-seat travel depends on age, height and the car seat, and an app shouldn't be offering it as a prize. | Replace with "Pick the car music" (one already exists, so just remove it). |
| **Add** | Forfeits: "Bed 30 minutes early"; prize: "No homework tonight" | They undermine sleep and school routines, and a public app shouldn't suggest them. | Remove, or move them to a "House rules" group shown only after the parent taps "More ideas". |
| Note | Workout forfeits ("10 press-ups", "3 laps") | Exercise as punishment is discouraged in youth coaching, but these are light and playful. | Rename the group to "Get moving" and keep them. |

## 6. Accessibility and mixed ability

| Sev | Issue | Recommendation |
|---|---|---|
| **Add** | Some rules need abilities not every player has: balance (`flamingo-keeper`, `hopping-vampire`), speech (`count-touches`, `call-your-corner`, `commentator`), sight (`finger-count`), fast running (`fence-run`, `colour-roulette`). A deck dealt at random can hand a player a rule they physically can't do. | Tag each rule with `needs: ["balance" \| "voice" \| "sight" \| "running"]` and add a setup option, "Skip rules that need…", that filters them out. It's a small data change; dealing already filters by tier. |
| Note | Teams (two people as one side) and handicap-style rules (`comeback`) already help mixed-age groups. | Mention in the mode description: "Tip: pair a younger and an older player as a team." |

## 7. Free text typed by users

There is no user-made content in modes. The only free text is player and team
names and the prize and forfeit boxes. They stay private to the account and
are never published. If the share card (launch plan, phase 5) is built, it
must default to showing what the user sees, offer an initials-only switch, and
**never** include the prize or forfeit text.

## Change checklist (for the PR)

- [ ] Chaos: retire `big-head`; add "below knee height" to three keeper rules; rename `double-nothing` and `jackpot`.
- [ ] Horror: retire or reshape `tombstone-wall`; bound `no-mercy`'s forfeit; add "below knee height" to two keeper rules; rename card-game-derived labels and `weeping-angel`; reword `soul-wager` and the `double-draw` emoji.
- [ ] Horror setup: "No Mercy cards" toggle; spooky-theme label; age label.
- [ ] Stakes: remove the reading, homework, food-forfeit and front-seat items; reduce food prizes to one.
- [ ] Announcer: "Silly" / "Classic" setting.
- [ ] Rules: `needs` tags and a "Skip rules that need…" filter.
- [ ] Age labels on every mode card.
- [ ] Tests: deck parity tests updated (no key renamed, retired keys still resolve).
