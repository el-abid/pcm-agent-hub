from pathlib import Path

from pypdf import PdfReader

DOWNLOADS = Path(r"C:\Users\PC\Downloads")
OUT = Path("docs/sources")
OUT.mkdir(parents=True, exist_ok=True)

KEYWORDS = ["galet", "pièce", "piece", "référence", "reference", "ascenseur", "porte palière", "porte paliere", "catalogue", "fournisseur"]

for pdf in sorted(DOWNLOADS.glob("*.pdf")):
    if not any(token in pdf.name.lower() for token in ("pcm", "proc-pal", "proc-trm", "porte", "distributeur")):
        continue
    try:
        reader = PdfReader(str(pdf))
        text = "\n".join((page.extract_text() or "") for page in reader.pages)
    except Exception as exc:  # noqa: BLE001
        print(f"FAIL {pdf.name}: {exc}")
        continue

    target = OUT / f"{pdf.stem}.txt"
    target.write_text(text, encoding="utf-8")
    print(f"FILE {pdf.name} pages={len(reader.pages)} chars={len(text)} -> {target}")

    lowered = text.lower()
    for keyword in KEYWORDS:
        index = lowered.find(keyword.lower())
        if index >= 0:
            snippet = text[max(0, index - 120) : index + 220].replace("\n", " ")
            print(f"  {keyword}: ...{snippet}...")
