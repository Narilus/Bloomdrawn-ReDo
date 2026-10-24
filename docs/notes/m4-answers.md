M4 Notes and suggestions:

# Regarding Boss phases, difficulty & UI design.
Adjust this boss's HP upward to a total of 400, then consider the following:
Rather than a mark in the HP bar to indicate phase point, it is common in game and UI design to instead have multiple HP bars - usually with indicators underneath the HP bar to inform the player the total amount of extra bars (often red blips that extinguish as you deplete a bar). So for this boss, you would have the bar and 1 red blip - after defeating the first bar, the blip would turn grey/black and we would move to the second bar whilst triggering phase 2.

So bar one would read 200/200 then be replaced with bar 2 (reducing blip counter) and in this case go to 200/200 again. In Morimens, the bar can be replaced mid player turn. Traditionally it would be immune to damage for the remainder of that player turn as the boss would change intents on phase swap for a form of 'rouse', clearing statuses and powering up for the next phase. Very specific pierce, or stacking instant-death mechanics would allow you to bypass the phase swap immunity. I think this is the approach we could try for now.

Regarding pressure from Fruiting: I think there is room to actually have some bosses have additional phases, or different phases if the Bloom reached max pressure (Fruiting). No neccesarily this current boss, but consider bosses having a 3rd phase or an alternative 2nd phase with different movesets based on Fruiting.

A nice-to-have in that scenario would be to load 'upgraded' art on the Fruiting phase-swap version, a 'Bloomed' version of the boss for example. For example we could have some sort of "Bloom Matriarch" boss in the future that has a normal 2 phase fight. If in Fruited, phase 2 switches to something like "Bloom Matriarch - Ascension" or "Matriarch, Fully Bloomed" etc. There would be room for varying designs and concepts here.

As for generally applying the damage bonus from Fruiting to the boss - I would honestly say no. This is where we could offer difficulty in the form of alternative encounter design instead of a raw damage bonus. It would also get difficult trying to balance numbers if we apply a raw percentage increase to the boss: You could end up with a normal run becoming far too easy because you had to nerf base multipliers to ensure the boosted version wasn't one-shotting the party.

# Banking.
This is mostly fine, considering this is provisional until M5 profile systems exist. Regarding Defeat or Abandon rules - I would be careful with your wording: "1 pull, plus 1 per elite beaten (3 at most). Depth scaling waits for depth tiers (Q8)." - We simply need to ensure there is not a system where a player loads a run and instantly quits to gain 1 pull. Players will optimise the fun out of anything, and that is a common phrase.
I agree with 1 pull per elite but I might be inclined to remove the 3-cap in the future (and instead halve the reward on loss/abandonment - rounded up). For now, we can leave it as written in that regard unless you have a stronger preference for my idea - Again, we want to avoid a situation where players decide to pursue some unfun optimal route that causes burnout (like an Elite-rush).

# Open Questions:
1. Should elites give a card pick as well as the relic pick?
No, Elites should not offer a card service. Relics only.

2. Are the draft reward cards the right kind of thing?
I would give a provisional yes. One thing we have to watch for is that they don't neccesarily erode build identity, but once we expand on the available pool this should be less of an issue as it would become far less deterministic to the player, and more RNG.

3. Can any party member take Unbound's generic card, since Unbound slots into any team? Or only Unbound members?
Unbound cards should always be in the pool as you correctly identified. Regarding ownership, I might also suggest that applicable cards are assigned (randomly) to a valid owner. If a player runs a party of 4x Rapture characters then Rapture and Unbound cards could be assigned to any of slot 1-4 characters rather than just slot 1 for example. Likewise if they run 2x Flesh and 2x Rapture then domain-specific cards can be assigned to only the appropriate characters. Likewise the pools shown should consider the domains available in the player party composition and never show out-of-domain cards as options.

4. Cards in Shops: 2 at 45 Obols, rolled with the stock on first entry?
No cards in shops. We can consider the removal service as a once-per-shop 'sell' option, giving 45 Obols to the player.

5. No card rarities and no card removal in M4: fine, or do you want a removal service now?
No card rarity in M4 is fine. Regarding the removal service - You may implement it as above in this version, or defer if there is a more logical point later.

6. The Hollow Abbess: is the concept and its two phases right? HP 300 and the intent numbers as placeholders?
Concept is fine for now. 400HP and read the initial instructions regarding HP bars/UI, pressure and phases.

7. The Boss scales with the Bloom stage (up to +50% at Fruiting), keeping Fruiting's doubled rewards a real risk?
No damage scaling, see Boss phase/difficulty notes prior for a different approach.

8. Defeat or abandon banks 1 pull plus 1 per elite beaten, at most 3?
See previous notes on Banking.

9. A save the game can't migrate ends as an abandon and banks its share?
Yes, we would rather default to safety and give rewards rather than risk the profile.

10. Save export and import in M4, or later?
If it is logical to implement now, then we can proceed. If it is safer to wait until we have a full player profile system then we can do that to. As the implementer, I will leave this decision to you.