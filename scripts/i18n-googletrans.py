#!/usr/bin/env python3
"""Build locale JSON from en.json via googletrans. Preserves id/ja human translations."""
from __future__ import annotations

import json
import re
import sys
import time
from pathlib import Path

from googletrans import Translator

ROOT = Path(__file__).resolve().parent.parent
LOCALES = ROOT / "src/i18n/locales"

TARGETS = {
    "ko": "ko",
    "zh-Hans": "zh-cn",
    "zh-Hant": "zh-tw",
    "ms": "ms",
    "th": "th",
    "vi": "vi",
    "fil": "tl",
    "hi": "hi",
    "ar": "ar",
    "es": "es",
    "fr": "fr",
    "de": "de",
    "pt": "pt",
    "it": "it",
    "ru": "ru",
    "tr": "tr",
    "nl": "nl",
}

BRANDS = ["TomTom", "Google", "MapLibre", "Waze", "Traffic Jakarta"]
PH_RE = re.compile(r"\{\{[^}]+\}\}")


def protect(text: str) -> tuple[str, list[str]]:
    placeholders: list[str] = []

    def repl(m: re.Match[str]) -> str:
        placeholders.append(m.group(0))
        return f"__PH{len(placeholders) - 1}__"

    s = PH_RE.sub(repl, text)
    for b in BRANDS:
        s = s.replace(b, f"__BR_{b.replace(' ', '_')}__")
    return s, placeholders


def unprotect(text: str, placeholders: list[str]) -> str:
    s = text
    for b in BRANDS:
        s = s.replace(f"__BR_{b.replace(' ', '_')}__", b)
        s = re.sub(rf"__\s*BR[_\s]*{re.escape(b.replace(' ', '_'))}\s*__", b, s, flags=re.I)
    for i, p in enumerate(placeholders):
        s = re.sub(rf"__\s*PH\s*{i}\s*__", p, s, flags=re.I)
        s = re.sub(rf"__PH{i}__", p, s, flags=re.I)
        s = re.sub(rf"\{{\{{\s*PH{i}\s*\}}\}}", p, s, flags=re.I)
    return s


def placeholders_ok(source: str, translated: str) -> bool:
    return sorted(PH_RE.findall(source)) == sorted(PH_RE.findall(translated))


def collect_strings(node, out: set[str]) -> None:
    if isinstance(node, dict):
        for v in node.values():
            collect_strings(v, out)
    elif isinstance(node, str):
        out.add(node)


def translate_tree(en_node, preserve_node, lookup):
    if isinstance(en_node, dict):
        out = {}
        pres = preserve_node if isinstance(preserve_node, dict) else {}
        for k, v in en_node.items():
            out[k] = translate_tree(v, pres.get(k), lookup)
        return out
    if isinstance(en_node, str):
        if isinstance(preserve_node, str) and preserve_node != en_node:
            return preserve_node
        return lookup(en_node)
    return en_node


def main() -> None:
    langs = sys.argv[1:] or list(TARGETS.keys())
    en = json.loads((LOCALES / "en.json").read_text(encoding="utf-8"))
    tr = Translator()

    cache: dict[str, dict[str, str]] = {}

    def lookup_factory(dest: str, lang_code: str):
        if dest not in cache:
            cache[dest] = {}

        def lookup(text: str) -> str:
            if text in cache[dest] and cache[dest][text] != text:
                return cache[dest][text]
            protected, ph = protect(text)
            if not protected.strip():
                return text
            for attempt in range(3):
                try:
                    time.sleep(0.06)
                    raw = tr.translate(protected, src="en", dest=dest).text
                    out = unprotect(raw, ph)
                    if placeholders_ok(text, out):
                        cache[dest][text] = out
                        return out
                except Exception:
                    time.sleep(0.5 * (attempt + 1))
            cache[dest][text] = text
            return text

        return lookup

    for lang in langs:
        if lang not in TARGETS:
            print(f"skip unknown {lang}", file=sys.stderr)
            continue
        dest = TARGETS[lang]
        preserve_path = LOCALES / f"{lang}.json"
        preserve = (
            json.loads(preserve_path.read_text(encoding="utf-8"))
            if preserve_path.exists()
            else {}
        )
        print(f"[i18n-googletrans] building {lang} -> {dest}", flush=True)
        lookup = lookup_factory(dest, lang)
        tree = translate_tree(en, preserve, lookup)
        preserve_path.write_text(json.dumps(tree, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"[i18n-googletrans] wrote {lang}.json", flush=True)

    print("[i18n-googletrans] done", flush=True)


if __name__ == "__main__":
    main()
