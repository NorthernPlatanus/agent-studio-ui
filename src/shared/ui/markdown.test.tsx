/**
 * The markdown grammar, pinned at the two places it deliberately departs from
 * CommonMark and at the one place it must never be permissive: HTML.
 *
 * The parser is exported and tested directly rather than through the rendered
 * output, because what matters about most of these cases is the *shape* the
 * source was read as — a paragraph that was read as a list is wrong even if the
 * words on screen happen to be the same.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Markdown, MarkdownInline, parseBlocks, parseInline } from "./markdown";

describe("inline", () => {
  it("reads a code span, which is the construct the planner actually uses", () => {
    expect(parseInline("set `files_write` first")).toEqual([
      { kind: "text", text: "set " },
      { kind: "code", text: "files_write" },
      { kind: "text", text: " first" },
    ]);
  });

  it("leaves identifiers and globs alone", () => {
    // The reason single `*` and `_` are not emphasis. Under CommonMark this
    // line loses four underscores and an asterisk to italics, silently — in a
    // field an operator reads to decide whether a spec is safe to approve.
    const source = "n_candidates applies to src/**/*.ts and files_write";
    expect(parseInline(source)).toEqual([{ kind: "text", text: source }]);
  });

  it("reads doubled markers as bold, since no path produces a matched pair", () => {
    expect(parseInline("**PUSH-BACK** noted")).toEqual([
      { kind: "strong", children: [{ kind: "text", text: "PUSH-BACK" }] },
      { kind: "text", text: " noted" },
    ]);
  });

  it("keeps a code span intact inside bold", () => {
    expect(parseInline("**see `x.ts`**")).toEqual([
      {
        kind: "strong",
        children: [
          { kind: "text", text: "see " },
          { kind: "code", text: "x.ts" },
        ],
      },
    ]);
  });

  it("does not let bold reach across a code span's backticks", () => {
    // The precedence the hand-written scanner exists for: as one alternating
    // regex, whichever construct started first would win.
    expect(parseInline("`a ** b` c")).toEqual([
      { kind: "code", text: "a ** b" },
      { kind: "text", text: " c" },
    ]);
  });

  it("shows an unmatched marker rather than swallowing the rest of the line", () => {
    expect(parseInline("2 * 3 and `unclosed")).toEqual([
      { kind: "text", text: "2 * 3 and `unclosed" },
    ]);
  });

  it("uses the delimiter run length, so a span can contain a backtick", () => {
    expect(parseInline("``git log -1 `HEAD` `` done")).toEqual([
      { kind: "code", text: "git log -1 `HEAD`" },
      { kind: "text", text: " done" },
    ]);
  });
});

describe("blocks", () => {
  it("joins a hard-wrapped paragraph into one run", () => {
    // These rows render inside `white-space: pre-wrap`, so a preserved newline
    // is a hard break on screen — at whatever width the model's own output
    // happened to wrap at, inside a 68ch measure.
    expect(parseBlocks("the planner wrapped\nthis at eighty columns")).toEqual([
      { kind: "paragraph", text: "the planner wrapped this at eighty columns" },
    ]);
  });

  it("separates paragraphs on a blank line", () => {
    expect(parseBlocks("one\n\ntwo")).toEqual([
      { kind: "paragraph", text: "one" },
      { kind: "paragraph", text: "two" },
    ]);
  });

  it("reads a bullet list, and folds a continuation line into its item", () => {
    expect(parseBlocks("- first\n  still first\n- second")).toEqual([
      { kind: "list", ordered: false, items: ["first still first", "second"] },
    ]);
  });

  it("tells an ordered list from a bulleted one", () => {
    expect(parseBlocks("1. add the field\n2. plumb it")).toEqual([
      { kind: "list", ordered: true, items: ["add the field", "plumb it"] },
    ]);
  });

  it("keeps the newlines inside a fence, where they are content", () => {
    expect(parseBlocks("```ts\nconst a = 1;\nconst b = 2;\n```")).toEqual([
      { kind: "code", text: "const a = 1;\nconst b = 2;" },
    ]);
  });

  it("runs an unterminated fence to the end rather than falling back to prose", () => {
    // What a turn killed mid-stream leaves behind. Showing the contents as code
    // is closer to the truth than showing the operator a stray ``` .
    expect(parseBlocks("```\nhalf a block")).toEqual([{ kind: "code", text: "half a block" }]);
  });

  it("reads a heading as its own block, without its trailing hashes", () => {
    expect(parseBlocks("## Plan ##\nbody")).toEqual([
      { kind: "heading", text: "Plan" },
      { kind: "paragraph", text: "body" },
    ]);
  });
});

describe("rendering", () => {
  it("never produces HTML from the source", () => {
    // The property the whole no-dependency approach exists for. This is LLM
    // output in an operator's control panel: a planner that has just read an
    // untrusted repo is one prompt away from emitting this.
    const { container } = render(
      <Markdown text={'<img src=x onerror="alert(1)"> and <b>bold</b>'} />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
    expect(screen.getByText(/<img src=x onerror="alert\(1\)"> and <b>bold<\/b>/)).toBeVisible();
  });

  it("balances parentheses in a destination", () => {
    // `indexOf(")")` cut this at `alert(1`, which is a scheme check passing on a
    // truncated string — and it mangles honest URLs with a disambiguator too.
    expect(parseInline("[a](javascript:alert(1))")).toEqual([
      { kind: "link", text: "a", href: "javascript:alert(1)" },
    ]);
    expect(parseInline("[b](https://x.test/A_(y))")).toEqual([
      { kind: "link", text: "b", href: "https://x.test/A_(y)" },
    ]);
  });

  it("links only http(s), and keeps the target of anything else visible", () => {
    render(<MarkdownInline text="[docs](https://example.com) and [run](javascript:alert(1))" />);

    const link = screen.getByRole("link", { name: "docs" });
    expect(link).toHaveAttribute("href", "https://example.com");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    // Not an anchor — and the target is still readable rather than dropped.
    expect(screen.queryByRole("link", { name: "run" })).not.toBeInTheDocument();
    expect(screen.getByTitle("javascript:alert(1)")).toHaveTextContent("run");
  });

  it("renders a heading as emphasis, not as a document outline level", () => {
    // These land inside a conversation row that already sits under the panel's
    // heading; a real `<h3>` would inject a level for what the planner meant as
    // a bold line.
    const { container } = render(<Markdown text="### Approach" />);
    expect(container.querySelector("h1, h2, h3, h4, h5, h6")).toBeNull();
    expect(screen.getByText("Approach")).toBeVisible();
  });

  it("puts a paragraph's plain text directly in the paragraph", () => {
    // A `<span>` per text run would push every text node a level below the
    // element that owns it, which is what an accessible name resolves against.
    const { container } = render(<Markdown text="a plain sentence" />);
    const paragraph = container.querySelector("p") as HTMLElement;
    expect([...paragraph.childNodes].some((n) => n.nodeType === Node.TEXT_NODE)).toBe(true);
  });
});
