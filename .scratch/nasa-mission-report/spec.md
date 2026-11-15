# Spec: NASA-based mission report and credits

**Status:** ready-for-agent (local ticket; no issue tracker is configured for this repo, so this follows the existing `.scratch/<feature>/` convention)

## Problem Statement

Our NASA Space Apps submission must use NASA data or resources, and the challenge asks the game to explain *why* a mission succeeds or fails, not only whether it did. Today the NASA resources we listed in the submission (Design and Develop Science Missions, Concept Maturity Levels, Mission Design Lab, CubeSat 101, the Webb telescope game) shape the design only in our heads. A player and a judge cannot see them anywhere in the game, and the end-of-flight screen is a score with no explanation in real mission-design terms.

## Solution

After every flight the player sees a short **Mission Report** that breaks the flight into NASA's four mission segments (launch, space, ground, user) using numbers the game already tracks. After a successful flight the player also sees one line naming a **real mission like theirs** and why it is similar, in the style of NASA's Webb telescope game. Flight School gains a **NASA resources and credits** page that names each source and what we took from it. Nothing about the physics, scoring, rewards, saves or balance changes: this is explanation and framing only.

## User Stories

1. As a player who just finished a flight, I want a mission report split into launch, space, ground and user segments, so that I understand how a real mission is organised, not only my score.
2. As a player, I want the launch segment to show what my rocket cost and how high it went, so that I can connect my build choices to the launch.
3. As a player, I want the space segment to show my payload and whether its objective was finished, so that I see what the spacecraft was for.
4. As a player, I want the ground segment to show how many problems I solved and how many went wrong, so that I see the role of mission control in handling surprises.
5. As a player, I want the user segment to show what my flight earned, so that I see the payoff for the people who use a mission's results.
6. As a player whose flight failed, I want the same report to appear, so that I learn which segment went wrong instead of only seeing a failure banner.
7. As a player who finished a satellite mission, I want a line naming the Lunar Reconnaissance Orbiter and why it is similar, so that I connect my game to a real lunar orbiter.
8. As a player who finished a rover mission, I want a line naming a real lunar rover and why it is similar, so that I connect my game to real Moon exploration.
9. As a player who landed the crew, I want a line naming Apollo 11 and why it is similar, so that I connect my landing to real history.
10. As a player who did not finish the objective, I want no "real mission" claim, so that the game never says I matched a mission I did not complete.
11. As a player, I want the real-mission line to be one short sentence plus one reason, so that it fits the result panel without crowding it.
12. As a beginner with no space background, I want every segment explained in plain words, so that I do not need to know the jargon.
13. As a player, I want the new report to read clearly next to the existing result panel (stars, payout, buttons), so that the screen does not feel cluttered.
14. As a player, I want the existing buttons (fly again, retry phase, builder) to work and sit where they were, so that I can keep playing quickly.
15. As a player replaying often, I want the report not to slow down getting back to the pad, so that the extra text never feels like a delay.
16. As a player, I want a NASA resources and credits page inside Flight School, so that I can see what real NASA material the game is based on.
17. As a player, I want each credit to say in one line what we took from that source, so that the credits are meaningful and not a bare link list.
18. As a player, I want to reach the credits page from the main menu with the same keys and mouse as the rest of Flight School, so that I do not need to learn a new control.
19. As a player, I want the satellite and its battery days explained in plain language (based on CubeSat 101) in Flight School, so that I understand why deployed satellites help later flights.
20. As a player, I want the Moon network panel to carry a short "why batteries matter" hint, so that I understand the days-of-battery numbers.
21. As a player, I want the mission ladder tiers named after real design stages (concept, trade study, point design), so that progress feels like a real design process.
22. As a judge, I want a one-line NASA credit visible on the result panel, so that I can see NASA material used in the running game without reading the submission form.
23. As a judge, I want the credits page to match the resource list on the submission form exactly, so that the claim in the form is true.
24. As a judge, I want the segment names to match NASA's own wording, so that the link to the source document is clear.
25. As a judge watching a 30-second video, I want the mission report to be readable on screen in one glance, so that the NASA connection is obvious in the demo.
26. As a teammate on the builder side, I want none of my lab files changed, so that parallel work does not collide.
27. As a developer, I want all new wording in one data module, so that I can fix a fact or a typo in one place.
28. As a developer, I want a test that every payload has a real-mission entry and every entry has a reason, so that adding a payload later cannot leave the report blank.
29. As a developer, I want the report to be built from existing flight results, so that no new tracking code is needed in the flight simulator.
30. As a developer, I want the existing tests and typecheck to stay green, so that the build is never broken.
31. As a player with a saved game, I want my saves and mission progress to load unchanged, so that I lose nothing.
32. As a player using the pause menu, I want the report not to interfere with pausing, restarting a phase or quitting, so that flow control stays the same.

## Implementation Decisions

- **One data module** holds all NASA-derived wording: the four segment names with a plain one-line meaning each, the real-mission entries per payload (name, one-line similarity, one-line reason), the design-stage names, the credits list with "what we took" lines, and the short CubeSat-based hints. It is plain data plus small pure functions, with no engine dependencies, so it can be tested without launching the game.
- **A pure report builder** takes the existing end-of-flight context (what the rocket cost, altitude reached, payload, whether the objective finished, problems solved and failed, reward earned) and returns a structured four-segment report. It adds no new tracking to the flight simulator; every number already exists.
- **Segment mapping:**
  - Launch segment: rocket cost and highest altitude.
  - Space segment: payload and whether its objective finished.
  - Ground segment: problems solved versus failed, framed as mission control handling surprises. This is an analogy, because the game has no ground station.
  - User segment: reward earned, framed as the value delivered to the people who use a mission's results.
- **Real-mission pairing**, shown only when the payload's own objective finished:
  - Satellite pairs with the Lunar Reconnaissance Orbiter, a NASA lunar orbiter.
  - Crew pairs with Apollo 11.
  - Rover must **not** pair with Mars Pathfinder, because the game lands on the Moon. It pairs with a lunar rover instead. Recommended: VIPER, NASA's planned polar lunar rover, described as a planned mission. The Apollo Lunar Roving Vehicle is the fallback but it carried astronauts, so it fits less well. All three facts must be verified against NASA sources before they ship.
- **Result panel:** gains the report block and the real-mission line. Existing stars, payout, retry/fly-again/builder buttons and timing keep their behaviour. A one-line NASA credit sits on the panel. Layout must fit at the game's resolution without overlapping the existing animation of the satellite, rover or crew.
- **Flight School:** gains a "NASA resources and credits" page. The list matches the submission form exactly: Design and Develop Science Missions, Concept Maturity Levels (JPL), Mission Design Lab, CubeSat 101, and the Webb telescope game. It also lists the non-NASA items from the form (Phaser, Press Start 2P, VT323, Piskel) under a separate heading. The satellite explanation based on CubeSat 101 lives here.
- **Moon network panel:** gains a short hint about batteries. No change to its numbers or layout beyond one line of text.
- **Mission ladder:** only if cheap. Rename tier titles with design-stage wording. Order, goals, rewards and ids stay the same so saved progress still matches. Per the user's decision this is **not** being done now (see Out of Scope).
- **Domain boundaries:** all work is in the flight and game-rules side. The lab and its part definitions are not touched; CubeSat text goes in Flight School and the network panel instead of payload cards.
- **Facts rule:** a real mission is named only where we are confident of the facts, and each reason is one plain sentence. Wording that is uncertain is cut rather than guessed.

## Testing Decisions

- **A good test** checks external behaviour: given a finished flight, the report has the right numbers in the right segments, and the real-mission line appears only for a finished objective of the matching payload. It does not check layout pixels or private helpers.
- **Single seam:** the pure report builder plus the data module, tested together. This is the highest seam available and needs no game engine.
- **Cases:**
  - Each payload with a finished objective returns its own real-mission entry.
  - A flight whose objective did not finish returns the report with no real-mission line.
  - Segment numbers match the inputs (cost, altitude, problems solved and failed, reward).
  - Every payload kind has an entry with non-empty name, similarity and reason, so a new payload fails the test until it gets wording.
  - The credits list contains exactly the five NASA resources and the four other items from the submission form.
- **Prior art:** the existing pure-logic tests for missions, phases and the Moon network, which build a context object and assert on what comes back.
- **Not unit-tested:** the on-screen layout of the result panel and the Flight School page. These are checked by playing in the headless browser the repo's scripts already use, and by eye.
- `npm test` and `npm run typecheck` must both stay green.

## Out of Scope

- Any change to physics, scoring, rewards, difficulty or saved-game format.
- Renaming the mission ladder tiers (the user said no to this).
- Power, data or communications as new resources; this is future scope for a slide, not for this work.
- A four-player or team mode.
- Integrating GMAT or NASA Mission Viz; they are cited only in the presentation as what real mission teams use.
- Any change to the lab, part cards or part definitions.
- New sounds or animations.
- Translating the text into other languages.

## Further Notes

- The user rejected the Mars Pathfinder pairing for the rover because the game lands on the Moon. That is why the rover pairing is now a lunar rover and why the facts need verifying.
- The submission form already lists the NASA resources; this work makes that claim true inside the game. If a resource is later dropped from the game, it should be removed from the form as well.
- The 30-second demo video should include the result panel with the mission report on screen so judges see the NASA link directly.
- Leave a short note on the AGENTS.md board when work starts, saying the lab was not touched.
