# Usage:
#   pip install sentence-transformers numpy
#   python embed_lore.py path\to\lore.txt  (writes ../src/rag/lore.json)
import sys, os, json
from sentence_transformers import SentenceTransformer


def chunk_text(text, chunk_words=600):
    words = text.split()
    for i in range(0, len(words), chunk_words):
        yield " ".join(words[i:i+chunk_words])


def main():
    if len(sys.argv) < 2:
        print("Usage: python embed_lore.py <lore_text_file>")
        sys.exit(1)
    src = sys.argv[1]
    with open(src, 'r', encoding='utf-8') as f:
        raw = f.read()

    chunks = [c for c in chunk_text(raw, 600) if c.strip()]
    print(f"[embed] chunks: {len(chunks)}")
    model = SentenceTransformer('all-MiniLM-L6-v2')
    vecs = model.encode(chunks, show_progress_bar=True)

    out = []
    for i, (txt, emb) in enumerate(zip(chunks, vecs)):
        out.append({
            "id": f"chunk_{i}",
            "text": txt,
            "embedding": [float(x) for x in emb.tolist()]
        })

    out_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src', 'rag'))
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, 'lore.json')
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False)
    print(f"[embed] wrote {out_path}")


if __name__ == "__main__":
    main()
