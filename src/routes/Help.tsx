import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentMember } from '@/lib/api';
import { ThemeToggle } from '@/components/ThemeToggle';
import { AdminQuickNav } from '@/components/AdminQuickNav';
import { MemberQuickNav } from '@/components/MemberQuickNav';
import { HANDBOOK_MARKDOWN, extractToc } from '@/lib/handbook';

export default function Help() {
  const { signOut } = useAuth();
  const me = useCurrentMember();
  const isAdmin = me.data?.role === 'admin';

  const toc = useMemo(() => extractToc(HANDBOOK_MARKDOWN), []);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mobileTocOpen, setMobileTocOpen] = useState(false);

  // ScrollSpy: aktiver Abschnitt
  useEffect(() => {
    const handler = () => {
      const sections = toc
        .map((t) => ({ id: t.id, el: document.getElementById(t.id) }))
        .filter((s): s is { id: string; el: HTMLElement } => !!s.el);
      const scrollY = window.scrollY + 140;
      let current: string | null = null;
      for (const s of sections) {
        if (s.el.offsetTop <= scrollY) current = s.id;
      }
      setActiveId(current);
    };
    handler();
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, [toc]);

  function handlePrint() {
    window.print();
  }

  return (
    <div className="bg-schwarzwald-soft min-h-screen text-slate-100 print:bg-white print:text-black">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-forest-800/40 bg-forest-950/95 backdrop-blur-xl print:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 py-2.5">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/planner" className="flex h-9 w-9 items-center justify-center rounded-lg bg-forest-900/60 text-forest-300 ring-1 ring-forest-800/50 hover:bg-forest-800" title="Zurück">
              ←
            </Link>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-semibold text-forest-100 leading-tight truncate">📖 Mitglieder-Handbuch</h1>
              <p className="text-[10px] sm:text-xs text-forest-400 truncate">Alle Funktionen der App auf einen Blick</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handlePrint}
              title="Als PDF speichern (Browser-Druck)"
              className="hidden sm:inline-flex items-center gap-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 px-3 py-1.5 text-xs text-amber-200 ring-1 ring-amber-500/30">
              📄 PDF
            </button>
            <button
              onClick={() => setMobileTocOpen((v) => !v)}
              className="lg:hidden rounded-lg bg-forest-900/60 px-3 py-1.5 text-xs text-forest-200 ring-1 ring-forest-800/50">
              ☰ Inhalt
            </button>
            <ThemeToggle compact />
            {isAdmin ? <AdminQuickNav variant="icons" /> : <MemberQuickNav myMemberId={me.data?.id} />}
            <button onClick={() => signOut()}
              className="rounded-lg bg-forest-900/80 px-2.5 py-1.5 text-xs text-forest-200 ring-1 ring-forest-700/50 hover:bg-forest-900">
              Abmelden
            </button>
          </div>
        </div>
      </header>

      {/* Mobile TOC Overlay */}
      {mobileTocOpen && (
        <div className="lg:hidden fixed inset-x-0 top-[57px] z-20 bg-forest-950/95 backdrop-blur-xl border-b border-forest-800/40 max-h-[60vh] overflow-y-auto print:hidden">
          <nav className="px-4 py-3 space-y-1">
            {toc.map((t) => (
              <a
                key={t.id}
                href={`#${t.id}`}
                onClick={() => setMobileTocOpen(false)}
                className={`block rounded-md px-3 py-1.5 text-sm transition ${
                  activeId === t.id
                    ? 'bg-amber-500/20 text-amber-100 font-semibold'
                    : 'text-forest-200 hover:bg-forest-900/60'
                } ${t.level === 3 ? 'pl-6 text-xs' : ''}`}
              >
                {t.title}
              </a>
            ))}
          </nav>
        </div>
      )}

      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 flex gap-6">
        {/* Desktop TOC */}
        <aside className="hidden lg:block w-64 flex-shrink-0 print:hidden">
          <nav className="sticky top-20 space-y-1 max-h-[calc(100vh-6rem)] overflow-y-auto">
            <p className="text-[10px] uppercase tracking-wider text-forest-400 mb-2 px-2">Inhalt</p>
            {toc.map((t) => (
              <a
                key={t.id}
                href={`#${t.id}`}
                className={`block rounded-md px-3 py-1.5 text-sm transition ${
                  activeId === t.id
                    ? 'bg-amber-500/20 text-amber-100 font-semibold border-l-2 border-amber-400'
                    : 'text-forest-200 hover:bg-forest-900/60 hover:text-forest-100'
                } ${t.level === 3 ? 'pl-6 text-xs' : ''}`}
              >
                {t.title}
              </a>
            ))}
          </nav>
        </aside>

        {/* Markdown-Content */}
        <article className="flex-1 min-w-0 prose-handbook">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeSlug]}
          >
            {HANDBOOK_MARKDOWN}
          </ReactMarkdown>
        </article>
      </div>

      {/* Print-CSS + Markdown-Styles */}
      <style>{`
        .prose-handbook { color: #e8f5e8; line-height: 1.7; }
        .prose-handbook h1 { font-size: 2rem; font-weight: 800; color: #fbbf24; margin-top: 1.5rem; margin-bottom: 1rem; line-height: 1.2; }
        .prose-handbook h2 { font-size: 1.5rem; font-weight: 700; color: #fbbf24; margin-top: 2.5rem; margin-bottom: 1rem; padding-top: 0.5rem; border-top: 1px solid rgba(124,74,26,0.3); scroll-margin-top: 5rem; }
        .prose-handbook h3 { font-size: 1.15rem; font-weight: 700; color: #fde68a; margin-top: 1.5rem; margin-bottom: 0.5rem; scroll-margin-top: 5rem; }
        .prose-handbook p { margin: 0.75rem 0; }
        .prose-handbook ul, .prose-handbook ol { margin: 0.75rem 0; padding-left: 1.5rem; }
        .prose-handbook li { margin: 0.25rem 0; }
        .prose-handbook code { background: rgba(8,18,12,0.7); color: #fbbf24; padding: 0.1rem 0.4rem; border-radius: 4px; font-size: 0.9em; font-family: ui-monospace, monospace; }
        .prose-handbook blockquote { border-left: 3px solid #fbbf24; padding: 0.5rem 1rem; margin: 1rem 0; background: rgba(8,18,12,0.4); border-radius: 0 8px 8px 0; color: #a8c8a8; font-style: italic; }
        .prose-handbook table { width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: 0.9rem; }
        .prose-handbook th, .prose-handbook td { border: 1px solid rgba(124,74,26,0.3); padding: 0.5rem 0.75rem; text-align: left; }
        .prose-handbook th { background: rgba(124,74,26,0.15); font-weight: 700; color: #fbbf24; }
        .prose-handbook tbody tr:nth-child(odd) { background: rgba(8,18,12,0.3); }
        .prose-handbook a { color: #fbbf24; text-decoration: underline; }
        .prose-handbook a:hover { color: #fcd34d; }
        .prose-handbook hr { border: 0; border-top: 1px solid rgba(124,74,26,0.4); margin: 2rem 0; }
        .prose-handbook strong { color: #f5f5dc; font-weight: 700; }
        .prose-handbook em { color: #fde68a; }

        @media print {
          .prose-handbook { color: #1f2937; }
          .prose-handbook h1, .prose-handbook h2, .prose-handbook h3 { color: #7c4a1a; border-color: #d4a574; }
          .prose-handbook th { background: #fef3c7; color: #7c4a1a; }
          .prose-handbook tbody tr:nth-child(odd) { background: #f9f5e8; }
          .prose-handbook code { background: #f5f5dc; color: #7c4a1a; }
          .prose-handbook blockquote { background: #f9f5e8; color: #4a5568; border-color: #d4a574; }
          .prose-handbook strong { color: #1f2937; }
          .prose-handbook a { color: #7c4a1a; }
          @page { margin: 1.5cm; }
        }
      `}</style>
    </div>
  );
}
