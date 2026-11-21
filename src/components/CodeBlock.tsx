import { useEffect, useState } from 'react'
import type { HighlighterCore } from 'shiki/core'
import { cn } from '@/lib/utils'

let highlighter: Promise<HighlighterCore> | null = null

function getHighlighter() {
  highlighter ??= Promise.all([import('shiki/core'), import('shiki/engine/javascript')]).then(
    ([{ createHighlighterCore }, { createJavaScriptRegexEngine }]) =>
      createHighlighterCore({
        themes: [import('@shikijs/themes/github-light'), import('@shikijs/themes/github-dark-dimmed')],
        langs: [import('@shikijs/langs/python')],
        engine: createJavaScriptRegexEngine(),
      }),
  )
  return highlighter
}

export function CodeBlock({ code, className }: { code: string; className?: string }) {
  const [html, setHtml] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getHighlighter()
      .then((h) =>
        h.codeToHtml(code, {
          lang: 'python',
          themes: { light: 'github-light', dark: 'github-dark-dimmed' },
        }),
      )
      .then((out) => !cancelled && setHtml(out))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [code])

  return (
    <div
      className={cn(
        'code-block overflow-x-auto rounded-lg border bg-[var(--code-bg)] px-4 py-3 font-mono text-[13px] leading-relaxed sm:text-sm',
        className,
      )}
    >
      {html ? (
        <div dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <pre className="m-0">
          <code>{code}</code>
        </pre>
      )}
    </div>
  )
}

export function OutputText({ text, className }: { text: string; className?: string }) {
  return (
    <pre className={cn('m-0 overflow-x-auto font-mono text-[13px] leading-relaxed whitespace-pre sm:text-sm', className)}>
      {text}
    </pre>
  )
}
