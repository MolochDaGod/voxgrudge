# UI asset rules (Craftpix / Kenney) — no double text

## The bug we keep shipping

Craftpix `login_big_btn*.png` has the word **LOGIN** painted in the image.  
Craftpix `tgb_button_play*.png` has **PLAY** painted in the image.

If you set that as `background` and also put HTML text (`Z-BRAWL`, `MELEE`, `FACE THE NIGHT`), players see **two labels on one control**. That is not a “layout opinion” — it is an asset discipline failure.

## Hard rules

| Asset class | Examples | Allowed content |
|-------------|----------|-----------------|
| **Blank chrome** | `menu_button*.png`, `button_small*.png`, `item_slot*.png`, paper/window 9-slice | HTML/CSS text, icons |
| **Labeled art** | `login_big_btn*` (LOGIN), `tgb_button_play*` (PLAY) | **Image only** — `aria-label` / `title` / tooltip, **no child text** |
| **Icons** | fist, heart, swords | Image only; labels go *beside* or in tooltips |

## CSS tokens (craftpix-rpg-ui.css)

- `--cpx-btn` / `--cpx-btn-menu` → **blank** menu chrome (safe for labels)
- `--cpx-btn-login*` → LOGIN art → class `.cpx-btn--login-art` / `.kpx-btn--login-art` only
- `--cpx-btn-play*` → PLAY art → class `.cpx-btn--play-art` / `.kpx-btn--play-art` only

## Layout checklist before ship

1. Read the PNG (or open in image viewer). Does it already contain words?
2. If yes → zero HTML text inside that element; use `aria-label`.
3. If no → put text in a flex center with padding that stays inside the 9-slice safe area.
4. Measure: title, buttons, slots are separate boxes — do not reuse login CTA art for titles.

## Z-Brawl fixed (2026-07-24)

- Title `Z-BRAWL` uses paper frame, not login button.
- CTA / MELEE / HEAL use blank menu chrome + HTML labels.
