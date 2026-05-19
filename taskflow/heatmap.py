"""Routine heatmap visualizer — generates HTML and opens in the default browser"""

import json
import webbrowser
import tempfile
from datetime import date, timedelta
from pathlib import Path
from typing import List, Set, Tuple


def _calculate_streaks(completion_set: Set[str], today: date) -> Tuple[int, int]:
    if not completion_set:
        return 0, 0

    # Current streak: from today (or yesterday if today not done yet)
    current = 0
    d = today if today.isoformat() in completion_set else today - timedelta(days=1)
    while d.isoformat() in completion_set:
        current += 1
        d -= timedelta(days=1)

    # Longest streak
    sorted_dates = sorted(date.fromisoformat(s) for s in completion_set)
    longest = run = 1
    for i in range(1, len(sorted_dates)):
        if (sorted_dates[i] - sorted_dates[i - 1]).days == 1:
            run += 1
            longest = max(longest, run)
        else:
            run = 1

    return current, longest


def open_heatmap(data_dir: str = "data") -> None:
    """Generate and open the routine heatmap in the default browser."""
    routines_file = Path(data_dir) / "routines.json"

    if not routines_file.exists():
        print("No routines file found.")
        return

    with open(routines_file, "r", encoding="utf-8") as f:
        raw: List[dict] = json.load(f)

    today = date.today()
    routines_json = []

    for r in raw:
        history: List[str] = list(r.get("completion_history", []))
        last = r.get("last_completed_date")
        if last and last not in history:
            history.append(last)

        completion_set: Set[str] = set(history)
        current_streak, longest_streak = _calculate_streaks(completion_set, today)

        created_str = r.get("created_at", today.isoformat())[:10]
        created_date = date.fromisoformat(created_str)
        days_since = (today - created_date).days + 1
        total = len(completion_set)
        rate = round(total / max(1, days_since) * 100, 1)

        routines_json.append({
            "title": r["title"],
            "completions": sorted(completion_set),
            "created": created_str,
            "stats": {
                "total": total,
                "rate": rate,
                "current_streak": current_streak,
                "longest_streak": longest_streak,
            },
        })

    html = _generate_html(routines_json, today.isoformat())

    tmp = tempfile.NamedTemporaryFile(
        mode="w", suffix=".html", delete=False,
        encoding="utf-8", prefix="taskflow_heatmap_"
    )
    tmp.write(html)
    tmp.close()
    webbrowser.open(f"file:///{tmp.name}")


def _generate_html(routines: list, today: str) -> str:
    data_json = json.dumps(routines, ensure_ascii=False)

    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Routine Heatmap — TaskFlow</title>
  <style>
    *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}

    body {{
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f6f8fa;
      color: #24292e;
      min-height: 100vh;
      padding: 2.5rem 2rem;
    }}

    header {{ margin-bottom: 2rem; }}
    header h1 {{ font-size: 1.3rem; font-weight: 700; color: #24292e; }}
    header p {{ font-size: 0.82rem; color: #586069; margin-top: 0.2rem; }}

    .card {{
      background: #fff;
      border: 1px solid #e1e4e8;
      border-radius: 8px;
      padding: 1.25rem 1.5rem 1rem;
      margin-bottom: 1.25rem;
    }}

    .routine-title {{
      font-size: 0.95rem;
      font-weight: 600;
      color: #24292e;
      margin-bottom: 0.9rem;
    }}

    .heatmap-scroll {{ overflow-x: auto; margin-bottom: 0.6rem; }}

    .heatmap-outer {{ width: fit-content; }}

    .month-row {{
      display: flex;
      gap: 3px;
      margin-bottom: 4px;
    }}

    .month-cell {{
      width: 13px;
      height: 12px;
      font-size: 0.6rem;
      color: #586069;
      text-align: left;
      white-space: nowrap;
      overflow: visible;
    }}

    .heatmap-grid {{
      display: flex;
      gap: 3px;
    }}

    .heatmap-col {{
      display: flex;
      flex-direction: column;
      gap: 3px;
    }}

    .cell {{
      width: 13px;
      height: 13px;
      border-radius: 2px;
      background: #ebedf0;
    }}

    .cell.empty   {{ background: transparent; }}
    .cell.done    {{ background: #40c463; }}
    .cell.today   {{ outline: 2px solid #555; outline-offset: -1px; }}
    .cell:not(.empty):hover {{ opacity: 0.75; cursor: default; }}

    .stats {{
      display: flex;
      flex-wrap: wrap;
      gap: 1.25rem;
      font-size: 0.8rem;
      color: #586069;
      border-top: 1px solid #f0f0f0;
      padding-top: 0.7rem;
    }}

    .val {{ color: #40c463; font-weight: 600; }}

    .empty-state {{
      text-align: center;
      padding: 3rem;
      color: #586069;
      font-size: 0.9rem;
    }}
  </style>
</head>
<body>
  <header>
    <h1>Routine Heatmap</h1>
    <p>Histórico de conclusão das suas rotinas</p>
  </header>
  <div id="app"></div>

  <script>
    const ROUTINES = {data_json};
    const TODAY = '{today}';

    const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

    function isoToDate(s) {{ return new Date(s + 'T00:00:00'); }}

    function buildWeeks(completionSet, todayStr, createdStr) {{
      const today   = isoToDate(todayStr);
      const created = isoToDate(createdStr);

      // Sunday of the week that is 52 full weeks before the current Sunday
      const anchor = new Date(today);
      anchor.setDate(anchor.getDate() - anchor.getDay()); // this Sunday
      anchor.setDate(anchor.getDate() - 51 * 7);          // 51 weeks back

      const weeks = [];
      const cur = new Date(anchor);

      while (cur <= today) {{
        const week = [];
        for (let d = 0; d < 7; d++) {{
          const iso = cur.toISOString().split('T')[0];
          week.push({{
            date:      iso,
            done:      completionSet.has(iso),
            before:    cur < created,
            isToday:   iso === todayStr,
            isFuture:  cur > today,
          }});
          cur.setDate(cur.getDate() + 1);
        }}
        weeks.push(week);
      }}
      return weeks;
    }}

    function monthLabels(weeks) {{
      const labels = new Array(weeks.length).fill('');
      let last = -1;
      weeks.forEach((week, i) => {{
        const first = week.find(d => !d.before && !d.isFuture);
        if (!first) return;
        const m = isoToDate(first.date).getMonth();
        if (m !== last) {{ labels[i] = MONTHS[m]; last = m; }}
      }});
      return labels;
    }}

    function renderCard(r) {{
      const set = new Set(r.completions);
      const weeks = buildWeeks(set, TODAY, r.created);
      const labels = monthLabels(weeks);
      const s = r.stats;

      const card = document.createElement('div');
      card.className = 'card';

      // Title
      const h = document.createElement('div');
      h.className = 'routine-title';
      h.textContent = r.title;
      card.appendChild(h);

      const scroll = document.createElement('div');
      scroll.className = 'heatmap-scroll';

      const outer = document.createElement('div');
      outer.className = 'heatmap-outer';

      // Month labels row
      const mrow = document.createElement('div');
      mrow.className = 'month-row';
      labels.forEach(label => {{
        const mc = document.createElement('div');
        mc.className = 'month-cell';
        mc.textContent = label;
        mrow.appendChild(mc);
      }});
      outer.appendChild(mrow);

      // Grid
      const grid = document.createElement('div');
      grid.className = 'heatmap-grid';

      weeks.forEach(week => {{
        const col = document.createElement('div');
        col.className = 'heatmap-col';
        week.forEach(day => {{
          const cell = document.createElement('div');
          cell.className = 'cell';
          if (day.before || day.isFuture) {{
            cell.classList.add('empty');
          }} else if (day.done) {{
            cell.classList.add('done');
          }}
          if (day.isToday) cell.classList.add('today');
          if (!day.before && !day.isFuture) {{
            cell.title = day.date + (day.done ? ' ✓' : '');
          }}
          col.appendChild(cell);
        }});
        grid.appendChild(col);
      }});

      outer.appendChild(grid);
      scroll.appendChild(outer);
      card.appendChild(scroll);

      // Stats
      const stats = document.createElement('div');
      stats.className = 'stats';
      const pluralDia = n => n === 1 ? 'dia' : 'dias';
      stats.innerHTML =
        `<span>Dias concluídos: <span class="val">${{s.total}} ${{pluralDia(s.total)}}</span></span>` +
        `<span>Taxa de conclusão: <span class="val">${{s.rate}}%</span></span>` +
        `<span>Maior sequência: <span class="val">${{s.longest_streak}} ${{pluralDia(s.longest_streak)}}</span></span>` +
        `<span>Sequência atual: <span class="val">${{s.current_streak}} ${{pluralDia(s.current_streak)}}</span></span>`;
      card.appendChild(stats);

      return card;
    }}

    (function render() {{
      const app = document.getElementById('app');
      if (!ROUTINES.length) {{
        app.innerHTML = '<div class="empty-state">Nenhuma rotina encontrada.</div>';
        return;
      }}
      ROUTINES.forEach(r => app.appendChild(renderCard(r)));
    }})();
  </script>
</body>
</html>"""
