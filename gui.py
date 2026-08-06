"""
Gradio Web GUI for Judging Anime By Its Cover.

Launch:
    python gui.py
Then open http://localhost:7860 in your browser.
"""

import os
import math
import traceback

import gradio as gr
from PIL import Image

# ── Import the existing pipeline ──────────────────────────────────────────────
from input_parser import auto_parse, get_all_raw_titles
from preference_encoder import EncodedPreference
from recommender import recommend, Recommendation
from rapidfuzz import fuzz

# ── Helpers ───────────────────────────────────────────────────────────────────

def _build_gallery(results: list[Recommendation]) -> list[tuple]:
    """Return a list of (PIL.Image, caption) tuples for the Gradio Gallery."""
    items = []
    for r in results:
        caption = f"#{r.rank}  {r.title}  ·  ★{r.score:.2f}  ·  {r.genres}"
        if r.local_image_path and os.path.exists(r.local_image_path):
            try:
                img = Image.open(r.local_image_path).convert("RGB")
                img = img.resize((200, 280), Image.LANCZOS)
                items.append((img, caption))
                continue
            except Exception:
                pass
        # Fallback: grey placeholder
        placeholder = Image.new("RGB", (200, 280), color=(40, 40, 50))
        items.append((placeholder, caption))
    return items


def _build_table_md(results: list[Recommendation]) -> str:
    """Render results as a markdown table."""
    header = "| # | Title | Score | Members | Genres | Visual Sim | Plot Sim |\n"
    header += "|---|---|---|---|---|---|---|\n"
    rows = []
    for r in results:
        members = f"{r.members:,}"
        genres = r.genres or "—"
        plot_sim_str = f"{r.plot_similarity:.3f}" if r.plot_similarity is not None else "—"
        rows.append(
            f"| {r.rank} | **{r.title}** | ★ {r.score:.2f} | {members} | {genres} | {r.similarity:.3f} | {plot_sim_str} |"
        )
    return header + "\n".join(rows)


# ── Core function called by Gradio ────────────────────────────────────────────

def run_recommendations(
    anime_input: str,
    csv_file,
    preference: str,
    plot_preference: str,
    top_n: int,
    preferred_year: int | None = None,
) -> tuple:
    """
    Returns: (gallery_items, table_markdown, status_message)
    """
    # Determine the raw input: CSV file takes precedence over text field
    if csv_file is not None:
        raw = csv_file.name  # path to uploaded temp file
    elif anime_input.strip():
        raw = anime_input.strip()
    else:
        return [], "", "⚠️ Please enter anime titles or upload a CSV file."

    # ── Parse liked anime ─────────────────────────────────────────────────────
    try:
        liked_anime = auto_parse(raw)
    except Exception as e:
        return [], "", f"❌ Failed to parse input: {e}"

    if not liked_anime:
        return [], "", "❌ Could not resolve any anime from your input. Check titles or CSV format."

    status_lines = [f"✅ Resolved **{len(liked_anime)}** anime from input."]

    # ── Encode preference ─────────────────────────────────────────────────────
    pref_text = preference.strip() if preference else ""
    text_embedding = None
    genre_filter = None
    era_year = None

    if pref_text:
        try:
            enc = EncodedPreference(pref_text)
            text_embedding = enc.text_embedding
            genre_filter = enc.genres if enc.genres else None
            era_year = enc.era_year
        except Exception as e:
            return [], "", f"❌ Preference encoding failed: {e}"

        if genre_filter:
            status_lines.append(f"🎯 Detected genres: **{', '.join(sorted(genre_filter))}**")
        if era_year:
            status_lines.append(f"📅 Era preference: **{era_year}**")

    # Manual year input overrides everything (highest priority)
    if preferred_year and int(preferred_year) > 1900:
        era_year = int(preferred_year)
        status_lines.append(f"📅 Era year (manual override): **{era_year}**")

    # ── Get recommendations ───────────────────────────────────────────────────
    try:
        n_candidates = max(top_n * 5, 150) + (len(genre_filter) * 50 if genre_filter else 0)
        # Over-fetch so the post-filter still leaves enough results
        fetch_n = top_n + len(liked_anime) + 50
        
        plot_pref_text = plot_preference.strip() if plot_preference else None
        
        results = recommend(
            liked_anime=liked_anime,
            preference_text_embed=text_embedding,
            plot_preference_text=plot_pref_text,
            genre_filter=genre_filter,
            era_year=era_year,
            top_n=fetch_n,
            n_candidates=n_candidates,
        )
    except Exception as e:
        traceback.print_exc()
        return [], "", f"❌ Recommendation failed: {e}"

    if not results:
        return [], "", "😔 No recommendations found. Try a different preference or input."

    # ── Post-filter: remove anime already in the user's input list ───────────────────
    EXCLUSION_THRESHOLD = 78
    raw_input_titles = get_all_raw_titles(raw)

    def _is_watched(rec: Recommendation) -> bool:
        candidates = [
            rec.title.lower() if rec.title else "",
            rec.title_english.lower() if rec.title_english else "",
        ]
        for raw_title in raw_input_titles:
            if not raw_title or raw_title.isdigit() or len(raw_title) <= 2:
                continue
            for cand in candidates:
                if cand and fuzz.WRatio(raw_title, cand) >= EXCLUSION_THRESHOLD:
                    return True
        return False

    filtered = [r for r in results if not _is_watched(r)]
    skipped = len(results) - len(filtered)
    results = filtered[:top_n]
    # Re-number ranks
    results = [r._replace(rank=i + 1) for i, r in enumerate(results)]

    if skipped:
        status_lines.append(f"ℹ️ Removed **{skipped}** result(s) already in your watchlist.")

    if not results:
        return [], "", "😢 All candidates were already in your watchlist. Try a smaller input list."

    # ── Build outputs ─────────────────────────────────────────────────────────
    gallery = _build_gallery(results)
    table = _build_table_md(results)
    status = "\n\n".join(status_lines)
    return gallery, table, status


# ── Gradio Interface ──────────────────────────────────────────────────────────

_CSS = """
#title-block { text-align: center; margin-bottom: 8px; }
#run-btn { background: linear-gradient(135deg, #7c3aed, #3b82f6) !important;
           color: white !important; font-size: 1.1em !important;
           border-radius: 8px !important; padding: 10px 28px !important; }
#run-btn:hover { opacity: 0.88 !important; }
.gr-gallery-item img { border-radius: 8px; }
"""

with gr.Blocks(
    title="🎌 Judging Anime By Its Cover",
) as demo:

    gr.Markdown(
        """
        # 🎌 Judging Anime By Its Cover
        **Multimodal anime recommendations** — visual cover style + genre preference  
        *Powered by CLIP ViT-Large/14 + MAL co-occurrence genre correlation*
        """,
        elem_id="title-block",
    )

    with gr.Row():
        # ── Left panel: inputs ─────────────────────────────────────────────
        with gr.Column(scale=1):
            gr.Markdown("### 📋 Your Anime List")
            anime_input = gr.Textbox(
                label="Anime titles (comma-separated)",
                placeholder="Death Note, Code Geass, Monster, Attack on Titan",
                lines=4,
                info="Or upload a CSV file below — CSV takes priority over this field.",
            )
            csv_file = gr.File(
                label="Upload watchlist CSV / Excel",
                file_types=[".csv", ".xlsx", ".xls"],
            )

            gr.Markdown("### 🎯 Preference")
            preference = gr.Textbox(
                label="Mood / genre preference (free text)",
                placeholder="dark psychological thriller  /  romance isekai  /  mind games",
                lines=2,
            )
            plot_preference = gr.Textbox(
                label="Plot / Synopsis preference (optional)",
                placeholder="relaxing slice of life about camping",
                lines=2,
            )
            top_n = gr.Slider(
                minimum=3,
                maximum=20,
                step=1,
                value=6,
                label="Number of recommendations",
            )
            preferred_year_input = gr.Number(
                label="Preferred release year (optional)",
                value=None,
                minimum=1960,
                maximum=2026,
                step=1,
                info="Leave blank to auto-infer from your watchlist. "
                     "Examples: 1995 = classics, 2005 = early 2000s, 2023 = recent.",
            )

            run_btn = gr.Button("✨ Get Recommendations", variant="primary", elem_id="run-btn")

            status_box = gr.Markdown("", label="Status")

        # ── Right panel: outputs ───────────────────────────────────────────
        with gr.Column(scale=2):
            gr.Markdown("### 🖼️ Cover Gallery")
            gallery = gr.Gallery(
                label="Recommendations",
                columns=3,
                rows=2,
                object_fit="cover",
                height=560,
                show_label=False,
            )
            gr.Markdown("### 📊 Results Table")
            table = gr.Markdown("")

    # ── Examples ──────────────────────────────────────────────────────────────
    gr.Examples(
        examples=[
            ["Death Note, Code Geass, Monster", None, "dark psychological thriller", "", 6, None],
            ["Attack on Titan, Demon Slayer, Jujutsu Kaisen", None, "action shounen", "", 8, None],
            ["Clannad, Toradora, Your Lie in April", None, "romance drama", "", 6, None],
            ["Sword Art Online, Re:Zero, Overlord", None, "Isekai action", "", 6, None],
            ["Steins;Gate, Ergo Proxy, Psycho-Pass", None, "sci-fi psychological", "", 8, None],
            ["Cowboy Bebop, Trigun, Rurouni Kenshin", None, "action adventure", "", 6, 1998],
            ["Death Note", None, "", "relaxing slice of life", 6, None],
        ],
        inputs=[anime_input, csv_file, preference, plot_preference, top_n, preferred_year_input],
        label="Quick examples",
    )

    # ── Wire up ───────────────────────────────────────────────────────────────
    run_btn.click(
        fn=run_recommendations,
        inputs=[anime_input, csv_file, preference, plot_preference, top_n, preferred_year_input],
        outputs=[gallery, table, status_box],
    )


if __name__ == "__main__":
    demo.launch(
        server_name="0.0.0.0",
        server_port=7860,
        share=False,
        show_error=True,
        theme=gr.themes.Soft(primary_hue="violet", secondary_hue="blue"),
        css=_CSS,
    )
