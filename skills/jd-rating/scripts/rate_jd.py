"""
rate_jd.py - Generates a scored JD Rating xlsx from a JSON scores payload.

Usage:
    python rate_jd.py <scores_json_path> <output_xlsx_path>
"""
import sys, json, shutil
from pathlib import Path

def main():
    if len(sys.argv) < 3:
        print("Usage: rate_jd.py <scores_json> <output_xlsx>")
        sys.exit(1)

    scores_path, output_path = sys.argv[1], sys.argv[2]

    with open(scores_path) as f:
        data = json.load(f)

    try:
        from openpyxl import load_workbook
    except ImportError:
        import subprocess
        subprocess.run([sys.executable, "-m", "pip", "install", "openpyxl",
                        "--break-system-packages", "-q"], check=True)
        from openpyxl import load_workbook

    template = Path(__file__).parent.parent / "assets" / "JD-Rating-Template.xlsx"
    shutil.copy2(str(template), output_path)

    wb = load_workbook(output_path)
    ws = wb.active

    for cell, value in data.get("scores", {}).items():
        ws[cell] = value

    for cell, note in data.get("notes", {}).items():
        ws[cell] = note

    ws["E37"] = data.get("overall_rating", "Not Approved - Reworked")

    wb.save(output_path)
    print(f"Saved: {output_path}")

if __name__ == "__main__":
    main()
