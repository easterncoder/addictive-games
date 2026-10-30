# Addictive Games

Nine tiny browser games built with plain HTML, CSS, and JavaScript. No installs, no accounts, no build step. Open the hub and pick one.

## Run locally

From this directory:

```bash
python3 -m http.server 8001
```

Then open `http://localhost:8001`.

## Games

| Game | Folder | Goal | Controls |
| --- | --- | --- | --- |
| Stack Tower | `stack-tower/` | Stack moving blocks. Perfect drops keep your width; misses shrink it until nothing is left. | Click, tap, or `Space` / `Enter` / `ArrowDown` |
| Color Match | `color-match/` | Tap the ink color, not the word. Wrong taps cost 3 seconds. 60 second timer. | Click, tap, or keys `1` to `4` |
| One-Button Runner | `one-button-runner/` | Hold to fly, release to fall. Thread the gaps as speed builds. | Hold pointer, `Space`, `ArrowUp`, or `Enter` |
| Knife Hit | `knife-hit/` | Throw knives into a spinning log without hitting a blade already stuck there. | Click, tap, or `Space` / `Enter` |
| Odd One Out | `odd-one-out/` | Find the tile with the slightly different shade before the grid grows too dense. | Click or tap the odd tile |
| Merge Drop | `merge-drop/` | Drop numbered orbs, merge matching values, and keep the pile below the danger line. | Click or tap to drop, arrow keys to aim, `Space` / `Enter` to drop |
| Word Hunt | `word-hunt/` | Find six hidden words across, down, and diagonally on a 10x10 grid in 90 seconds. | Drag letters or tap the first and last letter |
| Mine Vault | `mine-vault/` | Reveal safe tiles to grow your bank, then cash out before a mine takes it all. | Click or tap tiles, press Cash Out to bank |
| Echo | `echo/` | Watch the pads light up, then repeat the sequence. One wrong tap ends the run. | Click or tap the pads |

## Scoring and persistence

Each game stores its best score in `localStorage`:

`stack-tower-best`, `color-match-best`, `one-button-runner-best`, `knife-hit-best`, `odd-one-out-best`, `merge-drop-best`, `word-hunt-best`, `mine-vault-best`, `echo-best`.

Echo also stores its sound preference under `echo-sound`.

## Project structure

```text
.
├── index.html          Hub
├── style.css           Hub styles and card art
├── stack-tower/
│   ├── index.html
│   ├── style.css
│   └── script.js
├── color-match/
├── one-button-runner/
├── knife-hit/
├── odd-one-out/
├── merge-drop/
├── word-hunt/
├── mine-vault/
└── echo/
```

Every game folder is self contained and uses the same three files: `index.html`, `style.css`, and `script.js`.

## Technical notes

- No frameworks, dependencies, or build step.
- Canvas games use a fixed `360 x 560` logical resolution and scale for device pixel ratio.
- DOM based games use CSS grid and pointer events.
- Layouts are tested down to `320 x 568`.
- Echo uses the Web Audio API, which requires a user gesture before sound can play.

## Adding a game

1. Create a new folder with `index.html`, `style.css`, and `script.js`.
2. Follow the overlay pattern used by the existing games.
3. Add a card to the root `index.html`.
4. Add card art styles to the root `style.css`.
5. Update the hub eyebrow count and this README.
