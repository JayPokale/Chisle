"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Renders the benchmark transcripts, which are markdown: fenced code, tables,
// nested lists, bold, inline code.
//
// Raw HTML is deliberately NOT enabled (no rehype-raw). These strings are model
// output, and while they are ours and committed, rendering arbitrary generated
// HTML into the page buys nothing and costs a class of injection bug. The few
// stray tags in the corpus render as visible text, which is the honest result
// anyway — it is what the model actually emitted.
//
// No syntax highlighter: that is another dependency an order of magnitude
// larger, to colour six committed samples. Monospace on a panel is enough.

function CodeBlock({ children }: { children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="group relative">
      <pre className="pane-scroll my-2 overflow-x-auto rounded border border-line bg-paper/70 p-2.5">
        {children}
      </pre>
      <button
        onClick={(e) => {
          const text = e.currentTarget.parentElement?.querySelector("pre")?.innerText ?? "";
          navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        }}
        className="absolute right-1.5 top-3.5 rounded border border-line bg-panel px-1.5 py-0.5 font-mono text-[9.5px] text-dim opacity-0 transition-opacity hover:text-amber focus:opacity-100 group-hover:opacity-100"
        aria-label="Copy code"
      >
        {copied ? "copied" : "copy"}
      </button>
    </div>
  );
}

export default function Markdown({ children }: { children: string }) {
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (p) => <h4 className="mt-4 mb-1.5 text-[13px] font-bold first:mt-0" {...p} />,
          h2: (p) => <h5 className="mt-4 mb-1.5 text-[12.5px] font-bold first:mt-0" {...p} />,
          h3: (p) => <h6 className="mt-3 mb-1 text-[12px] font-semibold first:mt-0" {...p} />,
          h4: (p) => <h6 className="mt-3 mb-1 text-[12px] font-semibold first:mt-0" {...p} />,
          p: (p) => <p className="my-2 first:mt-0 last:mb-0" {...p} />,
          ul: (p) => <ul className="my-2 list-disc space-y-0.5 pl-5 marker:text-amber" {...p} />,
          ol: (p) => <ol className="my-2 list-decimal space-y-0.5 pl-5 marker:text-amber" {...p} />,
          li: (p) => <li className="pl-0.5" {...p} />,
          strong: (p) => <strong className="font-semibold text-ink" {...p} />,
          em: (p) => <em className="italic" {...p} />,
          hr: () => <hr className="my-3 border-line" />,
          a: (p) => (
            <a className="text-amber underline-offset-2 hover:underline" target="_blank" rel="noreferrer" {...p} />
          ),
          blockquote: (p) => (
            <blockquote className="my-2 border-l-2 border-line pl-3 text-dim" {...p} />
          ),
          // react-markdown v10 hands inline code as <code> without a parent <pre>;
          // block code arrives wrapped, so <pre> owns the frame and <code> stays bare.
          code: ({ className, children, ...rest }) => {
            const isBlock = /language-/.test(className || "");
            if (isBlock) {
              return (
                <code className="block font-mono text-[11px] leading-relaxed" {...rest}>
                  {children}
                </code>
              );
            }
            return (
              <code
                className="rounded border border-line bg-amber-soft/60 px-1 py-px font-mono text-[10.5px] text-amber"
                {...rest}
              >
                {children}
              </code>
            );
          },
          pre: (p) => <CodeBlock>{p.children}</CodeBlock>,
          table: (p) => (
            <div className="pane-scroll my-2 overflow-x-auto">
              <table className="w-full border-collapse text-[11px]" {...p} />
            </div>
          ),
          thead: (p) => <thead className="text-dim" {...p} />,
          th: (p) => <th className="border border-line px-2 py-1 text-left font-semibold" {...p} />,
          td: (p) => <td className="border border-line px-2 py-1 align-top" {...p} />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
