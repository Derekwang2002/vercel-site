import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";
import {
  getAllPostSeriesDocuments,
  getPostSeriesDefinitionByParentPostSlug,
  loadPostSeriesDocumentsFromRoots,
  parsePostSeriesFileName,
  toPostSeriesNavigation
} from "./post-series";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true })));
});

test("loads every repository series document for static route generation", async () => {
  assert.deepEqual(
    (await getAllPostSeriesDocuments("zh")).map((document) => [document.seriesSlug, document.slug]),
    [["calle-agentic-goal", "commit-goal"]]
  );
});

test("discovers the registered series from its migrated landing post", () => {
  assert.deepEqual(getPostSeriesDefinitionByParentPostSlug("calle-agentic-goal"), {
    directoryName: "calle-agentic-goal",
    parentPostSlug: "calle-agentic-goal",
    slug: "calle-agentic-goal"
  });
  assert.equal(getPostSeriesDefinitionByParentPostSlug("agentic-system-overview"), null);
});

test("parses order and public slug from NN-slug.md", () => {
  assert.deepEqual(parsePostSeriesFileName("01-commit-goal.md"), {
    fileName: "01-commit-goal.md",
    order: 1,
    slug: "commit-goal"
  });
  assert.throws(() => parsePostSeriesFileName("commit-goal.md"), /NN-lowercase-kebab-slug/);
});

test("builds deterministic series navigation with exactly one current item", () => {
  const navigation = toPostSeriesNavigation({
    currentSlug: "runner",
    documents: [
      {
        content: "Runner body",
        fileName: "02-runner.md",
        order: 2,
        seriesSlug: "calle-agentic-goal",
        slug: "runner",
        summary: "Runner summary",
        title: "Runner"
      },
      {
        content: "Commit Goal body",
        fileName: "01-commit-goal.md",
        order: 1,
        seriesSlug: "calle-agentic-goal",
        slug: "commit-goal",
        summary: "Commit Goal summary",
        title: "Commit Goal"
      }
    ],
    label: "CALL-E Agentic Goal",
    locale: "en",
    parentHref: "/blog/calle-agentic-goal",
    parentTitle: "Architecture Guide",
    seriesSlug: "calle-agentic-goal"
  });

  assert.deepEqual(
    navigation.items.map(({ current, href, label, order }) => ({ current, href, label, order })),
    [
      {
        current: false,
        href: "/blog/calle-agentic-goal",
        label: "Architecture Guide",
        order: 0
      },
      {
        current: false,
        href: "/blog/calle-agentic-goal/commit-goal",
        label: "Commit Goal",
        order: 1
      },
      {
        current: true,
        href: "/blog/calle-agentic-goal/runner",
        label: "Runner",
        order: 2
      }
    ]
  );
  assert.equal(navigation.items.filter((item) => item.current).length, 1);
});

test("rejects series navigation without exactly one matching current document", () => {
  assert.throws(
    () =>
      toPostSeriesNavigation({
        currentSlug: "missing-document",
        documents: [],
        label: "CALL-E Agentic Goal",
        locale: "en",
        parentHref: "/blog/calle-agentic-goal",
        parentTitle: "Architecture Guide",
        seriesSlug: "calle-agentic-goal"
      }),
    /exactly one document must match current slug/i
  );
});

test("loads ordered canonical documents and exact English mirrors", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "post-series-"));
  temporaryRoots.push(root);
  const canonical = path.join(root, "canonical");
  const english = path.join(root, "english");
  await mkdir(canonical, { recursive: true });
  await mkdir(english, { recursive: true });
  await writeFile(path.join(canonical, "02-runner.md"), "---\ntitle: \"运行器\"\nsummary: \"运行器摘要\"\n---\n\n正文\n");
  await writeFile(path.join(canonical, "01-commit-goal.md"), "---\ntitle: \"提交 Goal\"\nsummary: \"提交摘要\"\n---\n\n正文\n");
  await writeFile(path.join(english, "02-runner.md"), "---\ntitle: \"Runner\"\nsummary: \"Runner summary\"\n---\n\nBody\n");
  await writeFile(path.join(english, "01-commit-goal.md"), "---\ntitle: \"Commit Goal\"\nsummary: \"Commit summary\"\n---\n\nBody\n");

  const documents = await loadPostSeriesDocumentsFromRoots({
    canonicalDirectory: canonical,
    locale: "en",
    localizedDirectory: english,
    seriesSlug: "calle-agentic-goal"
  });

  assert.deepEqual(documents.map(({ order, slug, title }) => ({ order, slug, title })), [
    { order: 1, slug: "commit-goal", title: "Commit Goal" },
    { order: 2, slug: "runner", title: "Runner" }
  ]);
});

test("rejects missing mirrors, orphan mirrors, duplicate order, and empty bodies", async () => {
  async function fixture(canonicalFiles: Record<string, string>, englishFiles: Record<string, string>) {
    const root = await mkdtemp(path.join(os.tmpdir(), "post-series-invalid-"));
    temporaryRoots.push(root);
    const canonicalDirectory = path.join(root, "canonical");
    const localizedDirectory = path.join(root, "english");
    await mkdir(canonicalDirectory, { recursive: true });
    await mkdir(localizedDirectory, { recursive: true });
    await Promise.all(Object.entries(canonicalFiles).map(([name, body]) => writeFile(path.join(canonicalDirectory, name), body)));
    await Promise.all(Object.entries(englishFiles).map(([name, body]) => writeFile(path.join(localizedDirectory, name), body)));
    return { canonicalDirectory, localizedDirectory };
  }

  const validZh = "---\ntitle: \"中文\"\nsummary: \"摘要\"\n---\n\n正文\n";
  const validEn = "---\ntitle: \"English\"\nsummary: \"Summary\"\n---\n\nBody\n";

  const missing = await fixture({ "01-commit-goal.md": validZh }, {});
  await assert.rejects(
    loadPostSeriesDocumentsFromRoots({ ...missing, locale: "en", seriesSlug: "calle-agentic-goal" }),
    /missing en translation.*01-commit-goal\.md/i
  );

  const orphan = await fixture({}, { "01-commit-goal.md": validEn });
  await assert.rejects(
    loadPostSeriesDocumentsFromRoots({ ...orphan, locale: "en", seriesSlug: "calle-agentic-goal" }),
    /orphan en translation.*01-commit-goal\.md/i
  );

  const duplicate = await fixture(
    { "01-first.md": validZh, "01-second.md": validZh },
    { "01-first.md": validEn, "01-second.md": validEn }
  );
  await assert.rejects(
    loadPostSeriesDocumentsFromRoots({ ...duplicate, locale: "zh", seriesSlug: "calle-agentic-goal" }),
    /duplicate order 1/i
  );

  const empty = await fixture(
    { "01-commit-goal.md": "---\ntitle: \"中文\"\nsummary: \"摘要\"\n---\n" },
    { "01-commit-goal.md": validEn }
  );
  await assert.rejects(
    loadPostSeriesDocumentsFromRoots({ ...empty, locale: "zh", seriesSlug: "calle-agentic-goal" }),
    /01-commit-goal\.md.*body is empty/i
  );

  const gap = await fixture(
    { "01-first.md": validZh, "03-third.md": validZh },
    { "01-first.md": validEn, "03-third.md": validEn }
  );
  await assert.rejects(
    loadPostSeriesDocumentsFromRoots({ ...gap, locale: "zh", seriesSlug: "calle-agentic-goal" }),
    /expected order 2.*found 3/i
  );
});
