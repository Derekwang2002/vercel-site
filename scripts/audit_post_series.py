#!/usr/bin/env python3
"""Audit nested post-series Markdown and its English mirrors."""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path


FILE_NAME = re.compile(r"^\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*\.md$")
FRONTMATTER = re.compile(
    r"^---[ \t]*\n(?P<meta>.*?)\n---[ \t]*(?:\n|$)(?P<body>.*)$",
    re.DOTALL,
)
FIELD = re.compile(r"^(?P<key>[A-Za-z][A-Za-z0-9_-]*):\s*(?P<value>.*)$")
FENCE = re.compile(r"^ {0,3}(?P<marker>`{3,}|~{3,})(?P<rest>.*)$")
CJK = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff]")


@dataclass(frozen=True)
class Document:
    body: str
    fields: dict[str, str]
    path: Path


def parse_document(path: Path, errors: list[str]) -> Document | None:
    try:
        source = path.read_text(encoding="utf-8-sig").replace("\r\n", "\n")
    except (OSError, UnicodeError) as error:
        errors.append(f"{path}: cannot read UTF-8 Markdown: {error}")
        return None

    match = FRONTMATTER.match(source)
    if not match:
        errors.append(f"{path}: missing or invalid frontmatter")
        return None

    fields: dict[str, str] = {}
    for line in match.group("meta").splitlines():
        field = FIELD.match(line)
        if field:
            fields[field.group("key")] = unquote(field.group("value").strip()).strip()

    for key in ("title", "summary"):
        if not fields.get(key):
            errors.append(f"{path}: {key} is empty or missing")

    body = match.group("body").strip()
    if not body:
        errors.append(f"{path}: body is empty")

    return Document(body=body, fields=fields, path=path)


def unquote(value: str) -> str:
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
        return value[1:-1]
    return value


def strip_fenced_code(body: str) -> tuple[str, int]:
    prose_lines: list[str] = []
    active_fence: tuple[str, int] | None = None
    fence_count = 0

    for line in body.splitlines():
        fence = FENCE.match(line)
        if active_fence is None:
            if fence is None:
                prose_lines.append(line)
                continue

            marker = fence.group("marker")
            if marker[0] == "`" and "`" in fence.group("rest"):
                prose_lines.append(line)
                continue

            active_fence = (marker[0], len(marker))
            fence_count += 1
            continue

        if fence is None:
            continue

        marker = fence.group("marker")
        if (
            marker[0] == active_fence[0]
            and len(marker) >= active_fence[1]
            and not fence.group("rest").strip()
        ):
            active_fence = None
            fence_count += 1

    return "\n".join(prose_lines), fence_count


def markdown_fence_count(body: str) -> int:
    return strip_fenced_code(body)[1]


def delimiter_is_escaped(text: str, delimiter_start: int) -> bool:
    backslashes = 0
    cursor = delimiter_start - 1
    while cursor >= 0 and text[cursor] == "\\":
        backslashes += 1
        cursor -= 1
    return backslashes % 2 == 1


def strip_inline_code_line(line: str) -> str:
    prose: list[str] = []
    cursor = 0

    while cursor < len(line):
        opening = line.find("`", cursor)
        if opening < 0:
            prose.append(line[cursor:])
            break

        opening_end = opening
        while opening_end < len(line) and line[opening_end] == "`":
            opening_end += 1

        if delimiter_is_escaped(line, opening):
            prose.append(line[cursor:opening_end])
            cursor = opening_end
            continue

        delimiter_length = opening_end - opening
        closing = opening_end
        closing_end = opening_end
        while closing < len(line):
            closing = line.find("`", closing)
            if closing < 0:
                break
            closing_end = closing
            while closing_end < len(line) and line[closing_end] == "`":
                closing_end += 1
            if closing_end - closing == delimiter_length:
                break
            closing = closing_end

        prose.append(line[cursor:opening])
        if closing < 0:
            prose.append(line[opening:])
            break
        cursor = closing_end

    return "".join(prose)


def strip_markdown_code(body: str) -> str:
    prose, _ = strip_fenced_code(body)
    return "\n".join(strip_inline_code_line(line) for line in prose.splitlines())


def collect_files(
    root: Path,
    locale_name: str,
    errors: list[str],
) -> dict[Path, Path]:
    files: dict[Path, Path] = {}
    if not root.is_dir():
        errors.append(f"{root}: {locale_name} post-series directory not found")
        return files

    for entry in sorted(root.iterdir()):
        if not entry.is_dir():
            errors.append(f"{entry}: expected a post-series directory")
            continue

        for candidate in sorted(entry.iterdir()):
            if not candidate.is_file():
                errors.append(f"{candidate}: nested directories are not allowed")
                continue

            relative_path = candidate.relative_to(root)
            files[relative_path] = candidate
            if not FILE_NAME.fullmatch(candidate.name):
                errors.append(f"{candidate}: expected NN-lowercase-kebab-slug.md")

    return files


def audit(repo: Path) -> tuple[int, list[str], list[str]]:
    canonical_root = repo / "content" / "post-series"
    english_root = repo / "content" / "translations" / "en" / "post-series"
    errors: list[str] = []
    warnings: list[str] = []
    canonical_files = collect_files(canonical_root, "canonical", errors)
    english_files = collect_files(english_root, "English", errors)

    for relative_path, canonical_path in sorted(canonical_files.items()):
        canonical = parse_document(canonical_path, errors)
        english_path = english_files.get(relative_path)
        if english_path is None:
            errors.append(
                f"{english_root / relative_path}: missing English translation for {relative_path}"
            )
            continue

        english = parse_document(english_path, errors)
        if canonical is None or english is None:
            continue

        canonical_fences = markdown_fence_count(canonical.body)
        english_fences = markdown_fence_count(english.body)
        if canonical_fences != english_fences:
            errors.append(
                f"{english.path}: Markdown fence count {english_fences} does not match "
                f"canonical count {canonical_fences}"
            )

        english_prose = "\n".join(
            (
                strip_inline_code_line(english.fields.get("title", "")),
                strip_inline_code_line(english.fields.get("summary", "")),
                strip_markdown_code(english.body),
            )
        )
        if CJK.search(english_prose):
            errors.append(f"{english.path}: English prose contains CJK text")

    for relative_path, english_path in sorted(english_files.items()):
        if relative_path not in canonical_files:
            errors.append(
                f"{english_path}: orphan English translation without canonical document"
            )

    return len(canonical_files), errors, warnings


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--repo",
        type=Path,
        default=Path(__file__).resolve().parents[1],
        help="repository root (defaults to the parent of scripts/)",
    )
    args = parser.parse_args()

    document_count, errors, warnings = audit(args.repo.resolve())
    for warning in warnings:
        print(f"WARNING: {warning}")
    for error in errors:
        print(f"ERROR: {error}")
    print(
        f"Audited {document_count} post-series documents across 2 locales: "
        f"{len(errors)} errors, {len(warnings)} warnings"
    )
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
