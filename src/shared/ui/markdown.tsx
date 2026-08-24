/**
 * The planner writes markdown. This renders it.
 *
 * Until now it did not: every planner-authored string on the planner page was
 * dropped into a text node verbatim, so the operator read the source. An
 * `assumption` row, in the register the planner actually writes in:
 *
 *   PUSH-BACK, recorded rather than asked: `capture_fixtures` reads and writes
 *   inside `public/`, so the 12 MB fixture bundle must stay there and Vite will
 *   copy BOTH files into `dist/` — roughly +12 MB of dead weight …
 *
 * Six backticks in two sentences, and the page whose entire subject is reading
 * what the planner said was showing them. The prompt (`config/prompts/planner.md`)
 * is itself markdown and is full of `**bold**` and code spans, so the model
 * writes in kind — this is the planner's normal register, not an edge case.
 *
 * **No dependency, and no `dangerouslySetInnerHTML`.** The input is LLM output
 * rendered inside an operator's control panel, which is the exact shape of an
 * injection sink: a planner that has just read an untrusted repo is one prompt
 * away from emitting `<img onerror=…>`. Nothing here ever produces HTML — the
 * parser emits React nodes, so an angle bracket in the source is a character in
 * a text node and can never be a tag. That property is worth more than the
 * ~40KB and the transitive surface of a markdown-plus-sanitiser pair, given how
 * small the grammar below is.
 *
 * ─── what is deliberately NOT supported ────────────────────────────────────
 *
 * **Single-`*` and `_` emphasis.** This is the one real judgement call in the
 * file, and it goes against CommonMark on purpose. The planner's prose is dense
 * with globs and identifiers — `src/**\/*.ts`, `files_write`, `n_candidates`,
 * `T-131a_b`, `snake_case` — and an emphasis rule that fires on a lone `*` or
 * `_` eats them: `files_write` and `n_candidates` in one sentence become
 * "fileswrite … ncandidates" in italics, silently, with the underscores gone.
 * That is data loss in a field an operator is reading to decide whether to
 * approve a spec. `**bold**` needs a matched pair of *doubled* markers, which
 * no path or identifier produces by accident, so it stays.
 *
 * **Raw HTML, tables, images, blockquotes, footnotes, setext headings.** The
 * planner emits none of them into these fields. Anything unrecognised stays
 * literal, which is the honest failure mode: an operator sees the source
 * character rather than a silently dropped sentence.
 */

import type React from "react";
import { Fragment } from "react";
import { cn } from "@/shared/lib/utils";

/* ────────────────────────────── inline ──────────────────────────────────── */

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "code"; text: string }
  | { kind: "strong"; children: Inline[] }
  | { kind: "link"; text: string; href: string };

/** Only these are turned into a real anchor — see `renderInline`. */
const SAFE_HREF = /^https?:\/\//i;

/**
 * Splits a run of text into inline spans.
 *
 * A hand-written scanner rather than one master regex, because the three
 * constructs have different precedence and one of them (a code span) suppresses
 * the other two inside it. Expressed as alternation in a single pattern, the
 * code span would only win when it happened to start first — so `**a `b**` c`
 * would bold across a backtick.
 *
 * Every branch that cannot complete falls through to "this is an ordinary
 * character", which is what keeps an unmatched marker visible instead of
 * swallowing the rest of the line.
 */
export function parseInline(source: string): Inline[] {
  const out: Inline[] = [];
  let text = "";
  let i = 0;

  const flush = () => {
    if (text !== "") {
      out.push({ kind: "text", text });
      text = "";
    }
  };

  while (i < source.length) {
    const ch = source[i];

    // A code span, delimited by a run of N backticks and closed by the next run
    // of exactly the same length. The run length matters: it is how a span
    // containing a backtick is written (``a ` b``), and the planner does write
    // those when it quotes shell.
    if (ch === "`") {
      let n = 0;
      while (source[i + n] === "`") n += 1;
      const fence = "`".repeat(n);
      const end = source.indexOf(fence, i + n);
      if (end !== -1) {
        flush();
        // Trimmed by one space at each end, per CommonMark: the padding in
        // `` `a` `` exists to disambiguate the delimiter, not as content.
        out.push({ kind: "code", text: source.slice(i + n, end).replace(/^ | $/g, "") });
        i = end + n;
        continue;
      }
    }

    if (ch === "*" && source[i + 1] === "*") {
      const end = source.indexOf("**", i + 2);
      // `end > i + 2` rejects `****`, which is a horizontal rule fragment rather
      // than emphasis around nothing.
      if (end > i + 2) {
        flush();
        // Recursive, so a code span inside bold survives. It terminates because
        // the slice is strictly shorter than the input on every call.
        out.push({ kind: "strong", children: parseInline(source.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }

    if (ch === "[") {
      const close = source.indexOf("]", i + 1);
      if (close !== -1 && source[close + 1] === "(") {
        // The closing paren is found by *balancing*, not by `indexOf`. A first
        // cut used the next `)` and cut `javascript:alert(1)` down to
        // `javascript:alert(1` — which would have been a scheme check passing on
        // a truncated string, and it is just as wrong on an honest destination:
        // half of every Wikipedia URL with a disambiguator in it.
        let depth = 1;
        let end = close + 2;
        while (end < source.length && depth > 0) {
          const c = source[end];
          if (c === "\n") break;
          if (c === "(") depth += 1;
          else if (c === ")") depth -= 1;
          if (depth === 0) break;
          end += 1;
        }
        if (depth === 0) {
          flush();
          out.push({
            kind: "link",
            text: source.slice(i + 1, close),
            href: source.slice(close + 2, end).trim(),
          });
          i = end + 1;
          continue;
        }
      }
    }

    text += ch;
    i += 1;
  }

  flush();
  return out;
}

/**
 * Inline code.
 *
 * Full `text-foreground` inside a paragraph that is usually `text-muted-
 * foreground`, which is the right way round: the code span is the load-bearing
 * part of the sentence (a path, a field name), and lifting it clears the 4.5:1
 * floor by a wide margin rather than stacking a tint under already-muted ink.
 * `0.92em` rather than a fixed size so it tracks whatever row it lands in — the
 * same component renders inside a 13px question and a 12px spec description.
 */
const CODE = "rounded bg-foreground/[0.06] px-1 py-px font-mono text-[0.92em] text-foreground";

/**
 * One inline node.
 *
 * Split out of the `map` below only so the switch can be exhaustive *and*
 * end in a statement — `node satisfies never` is what makes adding an `Inline`
 * variant without a branch here a type error, and the lint rule on iterable
 * callbacks wants a return on every path that a bare exhaustive switch does not
 * syntactically have.
 */
function renderInlineNode(node: Inline, key: string): React.ReactNode {
  switch (node.kind) {
    case "text":
      // A `Fragment`, not a `<span>`. Plain text is most of every string that
      // comes through here, and wrapping each run in an element would put a
      // box around prose for no reason — and it would move the text node one
      // level down, out of the paragraph that owns it. That level matters
      // beyond tidiness: a text node's nearest element is what an accessible
      // name and a text query both resolve against.
      return <Fragment key={key}>{node.text}</Fragment>;
    case "code":
      return (
        <code key={key} className={CODE}>
          {node.text}
        </code>
      );
    case "strong":
      return (
        <strong key={key} className="font-semibold">
          {renderInline(node.children, `${key}.`)}
        </strong>
      );
    case "link":
      // Only `http(s)` becomes a navigable anchor. Everything else — a
      // relative path, a `mailto:`, and above all a `javascript:` URL the
      // planner could have read out of a repo — renders as its label with the
      // target in the tooltip. Dropping the target silently would be worse
      // than not linking it: the operator would have no way to know what the
      // sentence pointed at.
      return SAFE_HREF.test(node.href) ? (
        <a
          key={key}
          href={node.href}
          target="_blank"
          rel="noreferrer noopener"
          className="underline decoration-border underline-offset-2 hover:decoration-current"
        >
          {node.text}
        </a>
      ) : (
        <span key={key} title={node.href}>
          {node.text}
        </span>
      );
  }
  node satisfies never;
  return null;
}

function renderInline(nodes: readonly Inline[], keyPrefix = ""): React.ReactNode[] {
  return nodes.map((node, index) => renderInlineNode(node, `${keyPrefix}${index}`));
}

/** One line of markdown, with no block structure. For a field that is a
 *  sentence by construction — a question, the reason under it — where a `<p>`
 *  would add a margin to something that is already a row. */
export function MarkdownInline({ text }: { text: string }) {
  return <>{renderInline(parseInline(text))}</>;
}

/* ────────────────────────────── blocks ──────────────────────────────────── */

export type Block =
  | { kind: "paragraph"; text: string }
  | { kind: "heading"; text: string }
  | { kind: "code"; text: string }
  | { kind: "list"; ordered: boolean; items: string[] };

const FENCE = /^\s*(```|~~~)/;
const HEADING = /^\s{0,3}#{1,6}\s+(.*)$/;
const BULLET = /^\s{0,3}[-*+]\s+(.*)$/;
const ORDERED = /^\s{0,3}\d{1,9}[.)]\s+(.*)$/;

/**
 * Splits the source into blocks.
 *
 * Lines inside a paragraph or a list item are joined with a **space**, not kept
 * as newlines, and that is not cosmetic. These rows render inside
 * `white-space: pre-wrap` (the transcript wraps every row that way so a
 * 900-character stderr run breaks), so a preserved newline would be a hard
 * break on screen — and the planner hard-wraps its prose at whatever width its
 * own output happened to use. Left alone, a paragraph written at 80 columns
 * reads as a ragged column 80 characters wide inside a 68ch measure, with the
 * breaks in different places from the ones the layout wants.
 */
export function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  const startsBlock = (line: string) =>
    FENCE.test(line) || HEADING.test(line) || BULLET.test(line) || ORDERED.test(line);

  while (i < lines.length) {
    const line = lines[i] as string;

    if (line.trim() === "") {
      i += 1;
      continue;
    }

    // A fenced block. An unterminated fence runs to the end of the input rather
    // than falling back to prose: the planner streams, and a truncated turn
    // leaves exactly this — an opened fence with no partner. Showing its
    // contents as code is closer to the truth than showing the fence markers.
    if (FENCE.test(line)) {
      const marker = (line.trim().match(/^(`{3,}|~{3,})/) as RegExpMatchArray)[1] as string;
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !(lines[i] as string).trim().startsWith(marker)) {
        body.push(lines[i] as string);
        i += 1;
      }
      i += 1; // the closing fence, or one past the end
      blocks.push({ kind: "code", text: body.join("\n") });
      continue;
    }

    const heading = line.match(HEADING);
    if (heading) {
      blocks.push({ kind: "heading", text: (heading[1] as string).replace(/\s*#+\s*$/, "") });
      i += 1;
      continue;
    }

    const bullet = line.match(BULLET);
    const ordered = line.match(ORDERED);
    if (bullet || ordered) {
      const isOrdered = bullet === null;
      const items: string[] = [];
      while (i < lines.length) {
        const current = lines[i] as string;
        const match = current.match(isOrdered ? ORDERED : BULLET);
        if (match) {
          items.push(match[1] as string);
          i += 1;
          continue;
        }
        // A continuation line — indented, non-blank, and not the start of
        // something else — belongs to the item above it. Without this a
        // two-line bullet becomes a bullet and an orphaned paragraph.
        if (
          items.length > 0 &&
          current.trim() !== "" &&
          /^\s+/.test(current) &&
          !startsBlock(current)
        ) {
          items[items.length - 1] = `${items[items.length - 1]} ${current.trim()}`;
          i += 1;
          continue;
        }
        break;
      }
      blocks.push({ kind: "list", ordered: isOrdered, items });
      continue;
    }

    const paragraph: string[] = [];
    while (i < lines.length) {
      const current = lines[i] as string;
      if (current.trim() === "" || startsBlock(current)) break;
      paragraph.push(current.trim());
      i += 1;
    }
    blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
  }

  return blocks;
}

/**
 * A fenced block.
 *
 * Same recipe as the transcript's `LOG_BLOCK` (`planner-transcript.tsx`) on
 * purpose — machine text inside a message reads the same whether the planner
 * fenced it or the CLI printed it — but a separate constant, because the two
 * answer to different things: that one is a container for stderr and this one
 * tracks whatever the markdown grammar decides is code.
 *
 * `whitespace-pre` rather than inheriting the row's `pre-wrap`: a fenced block
 * is the one place where a line break is content and a wrapped line is a lie
 * about the source. It scrolls in x instead, which is contained — the log's own
 * `overflow-x-clip` means a code block cannot hand a horizontal scrollbar to
 * the whole conversation.
 */
const CODE_BLOCK =
  "block overflow-x-auto whitespace-pre rounded border border-border/60 bg-background/50 px-2 py-1 font-mono text-[11px] leading-relaxed text-muted-foreground";

/** One block. Split out for the same reason as `renderInlineNode`. */
function renderBlock(block: Block, key: number): React.ReactNode {
  switch (block.kind) {
    case "paragraph":
      return (
        <p key={key}>
          <MarkdownInline text={block.text} />
        </p>
      );
    case "heading":
      // Rendered as a bold line, not an `<h*>`. These blocks land inside a
      // conversation row that is already under the panel's own heading, so
      // a real heading element would inject a level into the document
      // outline for what the planner meant as emphasis — and `###` in a
      // 13px log row has no size left to be a heading with.
      return (
        <p key={key} className="font-semibold text-foreground">
          <MarkdownInline text={block.text} />
        </p>
      );
    case "code":
      return (
        <code key={key} className={CODE_BLOCK}>
          {block.text}
        </code>
      );
    case "list": {
      const Tag = block.ordered ? "ol" : "ul";
      return (
        <Tag
          key={key}
          className={cn(
            "space-y-1 pl-4",
            block.ordered ? "list-decimal" : "list-disc",
            // The marker inherits the text colour, which on a muted
            // paragraph puts a bullet at the same weight as the sentence.
            "marker:text-muted-foreground",
          )}
        >
          {block.items.map((item, itemIndex) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: list items are positional text with no identity of their own; the whole block re-renders as a unit.
            <li key={itemIndex}>
              <MarkdownInline text={item} />
            </li>
          ))}
        </Tag>
      );
    }
  }
  block satisfies never;
  return null;
}

/**
 * Markdown with block structure, for a field that can be several paragraphs.
 *
 * `space-y-2` on the wrapper rather than margins on the children, so a single
 * paragraph — which is what most of these are — contributes no vertical space
 * at all and sits exactly where the plain text node it replaced used to sit.
 */
export function Markdown({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {parseBlocks(text).map((block, index) => renderBlock(block, index))}
    </div>
  );
}
