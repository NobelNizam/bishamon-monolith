import { Fragment, type ReactNode } from 'react';
import { safeUrl } from '@/lib/client';

// Render text as React nodes only. HTML, scripts, images and unsafe protocols never execute.
function inline(value: string): ReactNode[] {
  return value.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^\s)]+\)|\*[^*]+\*)/g).map((token, index) => {
    if (token.startsWith('**') && token.endsWith('**')) return <strong key={index}>{token.slice(2, -2)}</strong>;
    if (token.startsWith('`') && token.endsWith('`')) return <code key={index}>{token.slice(1, -1)}</code>;
    if (token.startsWith('*') && token.endsWith('*')) return <em key={index}>{token.slice(1, -1)}</em>;
    const link = /^\[([^\]]+)\]\(([^\s)]+)\)$/.exec(token);
    if (link) { const url = safeUrl(link[2]); return url ? <a key={index} href={url} target="_blank" rel="noopener noreferrer">{link[1]}</a> : <Fragment key={index}>{link[1]}</Fragment>; }
    return <Fragment key={index}>{token}</Fragment>;
  });
}
export function Markdown({ content }: { content: string }) {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]; const key = i;
    if (!line.trim()) { i++; continue; }
    if (/^\s*```/.test(line)) {
      const language = line.trim().slice(3).trim(); const code = []; i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) code.push(lines[i++]);
      i++; blocks.push(<div className="code-block" key={key}>{language && <span>{language}</span>}<pre><code>{code.join('\n')}</code></pre></div>); continue;
    }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) { i++; blocks.push(heading[1].length <= 2 ? <h2 key={key}>{inline(heading[2])}</h2> : <h3 key={key}>{inline(heading[2])}</h3>); continue; }
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) { blocks.push(<hr key={key} />); i++; continue; }
    if (/^\s*>\s?/.test(line)) {
      const quote = []; while (i < lines.length && /^\s*>\s?/.test(lines[i])) quote.push(lines[i++].replace(/^\s*>\s?/, ''));
      blocks.push(<blockquote key={key}>{inline(quote.join(' '))}</blockquote>); continue;
    }
    const unordered = /^\s*[-*+]\s+/.test(line); const ordered = /^\s*\d+[.)]\s+/.test(line);
    if (unordered || ordered) {
      const items = []; const pattern = unordered ? /^\s*[-*+]\s+/ : /^\s*\d+[.)]\s+/;
      while (i < lines.length && pattern.test(lines[i])) items.push(<li key={i}>{inline(lines[i++].replace(pattern, ''))}</li>);
      blocks.push(unordered ? <ul key={key}>{items}</ul> : <ol key={key}>{items}</ol>); continue;
    }
    const paragraph = [line]; i++;
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|\s*```|\s*>|\s*[-*+]\s|\s*\d+[.)]\s)/.test(lines[i])) paragraph.push(lines[i++]);
    blocks.push(<p key={key}>{inline(paragraph.join('\n'))}</p>);
  }
  return <div className="markdown">{blocks}</div>;
}
