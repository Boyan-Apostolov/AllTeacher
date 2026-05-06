"""PDF export service — builds a curriculum study guide PDF with fpdf2.

Generates a clean, printable document containing:
  - Cover: curriculum goal, domain/level/language metadata
  - Week-by-week plan: each week's title, objective, and modules
  - Flashcard terms: key concepts extracted from flashcard exercises
    (front → back pairs the student can use for self-quizzing)

Returns raw bytes so the route can stream it directly to the client.
"""
from __future__ import annotations

import io
from typing import Any

from fpdf import FPDF, XPos, YPos


# ── Palette ────────────────────────────────────────────────────────────────────
# Neo-brutalist brand colours converted to RGB tuples.

INK    = (26,  20,  16)
BRAND  = (255, 107,  61)   # #FF6B3D
PAPER  = (255, 248, 240)
RULE   = (200, 190, 180)   # subtle separator
WHITE  = (255, 255, 255)


# ── PDF subclass ───────────────────────────────────────────────────────────────

class CurriculumPDF(FPDF):
    def __init__(self, title: str) -> None:
        super().__init__(orientation="P", unit="mm", format="A4")
        self._doc_title = title
        self.set_auto_page_break(auto=True, margin=18)
        self.set_margins(20, 20, 20)

    # ── header / footer ────────────────────────────────────────────────────────

    def header(self) -> None:
        if self.page_no() == 1:
            return          # cover page has its own header
        self.set_font("Helvetica", "B", 8)
        self.set_text_color(*BRAND)
        self.cell(0, 6, "AllTeacher — Study Guide", align="L",
                  new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_draw_color(*RULE)
        self.set_line_width(0.3)
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.ln(3)

    def footer(self) -> None:
        self.set_y(-14)
        self.set_font("Helvetica", "", 8)
        self.set_text_color(*RULE)
        self.cell(0, 6, f"Page {self.page_no()}", align="C")

    # ── helpers ────────────────────────────────────────────────────────────────

    def _rule(self, color: tuple = RULE) -> None:
        self.set_draw_color(*color)
        self.set_line_width(0.3)
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.ln(3)

    def _section_title(self, text: str) -> None:
        self.ln(4)
        self.set_font("Helvetica", "B", 13)
        self.set_text_color(*INK)
        self.cell(0, 8, text, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self._rule(BRAND)

    def _body(self, text: str, size: int = 10) -> None:
        self.set_font("Helvetica", "", size)
        self.set_text_color(*INK)
        self.multi_cell(0, 5.5, text or "—")
        self.ln(1)

    def _label(self, text: str) -> None:
        self.set_font("Helvetica", "B", 8)
        self.set_text_color(*BRAND)
        self.cell(0, 5, text.upper(), new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    def _kv(self, key: str, value: str) -> None:
        self.set_font("Helvetica", "B", 10)
        self.set_text_color(*INK)
        self.cell(42, 6, key + ":")
        self.set_font("Helvetica", "", 10)
        self.set_text_color(60, 50, 45)
        self.cell(0, 6, value or "—", new_x=XPos.LMARGIN, new_y=YPos.NEXT)


# ── public entry point ─────────────────────────────────────────────────────────

def build_pdf(
    curriculum: dict[str, Any],
    weeks: list[dict[str, Any]],
    flashcards: list[dict[str, Any]],
) -> bytes:
    """Build and return the PDF as raw bytes.

    Args:
        curriculum: The curricula row from Supabase (goal, domain, level, …).
        weeks:      List of curriculum_weeks rows, each with a plan_json field.
        flashcards: List of flashcard content_json dicts (front/back pairs)
                    extracted from the user's exercises.
    """
    goal   = (curriculum.get("goal") or curriculum.get("topic") or "Curriculum").strip()
    domain = (curriculum.get("domain") or "").capitalize()
    level  = (curriculum.get("level") or "").upper()
    native = curriculum.get("native_language_name") or curriculum.get("native_language") or ""
    target = curriculum.get("target_language") or ""

    pdf = CurriculumPDF(goal)
    pdf.add_page()

    # ── Cover ────────────────────────────────────────────────────────────────

    # Brand bar
    pdf.set_fill_color(*BRAND)
    pdf.rect(0, 0, pdf.w, 22, style="F")
    pdf.set_font("Helvetica", "B", 14)
    pdf.set_text_color(*WHITE)
    pdf.set_xy(pdf.l_margin, 6)
    pdf.cell(0, 10, "AllTeacher — Study Guide")

    pdf.ln(22)

    # Goal headline
    pdf.ln(8)
    pdf.set_font("Helvetica", "B", 26)
    pdf.set_text_color(*INK)
    pdf.multi_cell(0, 12, goal, align="L")
    pdf.ln(4)

    # Metadata
    pdf._rule(BRAND)
    pdf.ln(2)
    if domain:
        pdf._kv("Subject", domain)
    if level:
        pdf._kv("Level", level)
    if target:
        pdf._kv("Target language", target)
    if native:
        pdf._kv("Study language", native)
    pdf._kv("Weeks", str(len(weeks)))
    pdf.ln(6)

    # Summary bullets from plan overview (if present)
    plan_overview = curriculum.get("plan_json") or {}
    summary_bullets: list[str] = plan_overview.get("summary_bullets") or []
    if summary_bullets:
        pdf._section_title("About this curriculum")
        for b in summary_bullets:
            pdf.set_font("Helvetica", "", 10)
            pdf.set_text_color(*INK)
            pdf.cell(6, 5.5, "•")
            pdf.multi_cell(0, 5.5, b)

    # ── Week-by-week plan ─────────────────────────────────────────────────────

    pdf.add_page()
    pdf._section_title("Study plan")

    for week_row in weeks:
        plan: dict[str, Any] = week_row.get("plan_json") or {}
        week_num = week_row.get("week_number") or plan.get("week_number", "")
        week_title = plan.get("title") or f"Week {week_num}"
        objective  = plan.get("objective") or ""
        modules: list[dict[str, Any]] = plan.get("modules") or []
        milestone  = plan.get("milestone") or ""

        pdf.ln(5)
        # Week heading with filled accent bar
        pdf.set_fill_color(*BRAND)
        pdf.set_text_color(*WHITE)
        pdf.set_font("Helvetica", "B", 11)
        pdf.cell(0, 8, f"  Week {week_num} — {week_title}", fill=True,
                 new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.ln(2)

        if objective:
            pdf._label("Objective")
            pdf._body(objective)

        if modules:
            pdf._label("Modules")
            for mod in modules:
                mod_title = mod.get("title") or ""
                mod_desc  = mod.get("description") or ""
                if mod_title:
                    pdf.set_font("Helvetica", "B", 10)
                    pdf.set_text_color(*INK)
                    pdf.cell(5, 5.5, "")
                    pdf.cell(0, 5.5, f"• {mod_title}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
                if mod_desc:
                    pdf.set_font("Helvetica", "", 9)
                    pdf.set_text_color(80, 70, 65)
                    pdf.cell(10, 5, "")
                    pdf.multi_cell(0, 5, mod_desc)

        if milestone:
            pdf.ln(2)
            pdf._label("Milestone")
            pdf._body(f"✓ {milestone}")

    # ── Flashcard key concepts ────────────────────────────────────────────────

    if flashcards:
        pdf.add_page()
        pdf._section_title(f"Key concepts ({len(flashcards)} cards)")
        pdf._body(
            "Use these flashcards for self-quizzing. Cover the right column "
            "and try to recall the answer from the term alone.", size=9
        )
        pdf.ln(3)

        # Table header
        col_w = (pdf.w - pdf.l_margin - pdf.r_margin) / 2 - 2
        pdf.set_fill_color(*BRAND)
        pdf.set_text_color(*WHITE)
        pdf.set_font("Helvetica", "B", 9)
        pdf.cell(col_w, 7, "  Term / Front", fill=True)
        pdf.cell(4, 7, "")
        pdf.cell(col_w, 7, "  Answer / Back", fill=True,
                 new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.ln(1)

        for i, card in enumerate(flashcards):
            front = (card.get("front") or "").strip()
            back  = (card.get("back")  or "").strip()
            if not front:
                continue
            fill = i % 2 == 0
            bg = (245, 240, 235) if fill else WHITE
            pdf.set_fill_color(*bg)
            pdf.set_text_color(*INK)
            pdf.set_font("Helvetica", "", 9)

            # Measure cell heights so both columns match
            pdf.cell(col_w, 6.5, f"  {front}", fill=fill)
            pdf.cell(4, 6.5, "", fill=fill)
            pdf.cell(col_w, 6.5, f"  {back}", fill=fill,
                     new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    # ── Done ─────────────────────────────────────────────────────────────────

    buf = io.BytesIO()
    pdf.output(buf)
    return buf.getvalue()
