import React from 'react';

export default function Footer() {
  return (
    <footer id="footer" className="bg-dashboard-card border-t border-dashboard-border py-3">
      <div className="max-w-[1920px] mx-auto px-6">
        <p className="text-lg font-extralight text-slate-500 text-center">
          AI vibe coded development by{' '}
          <a
            href="https://biela.dev/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 hover:text-amazon-orange transition-colors"
          >
            Biela.dev
          </a>
          , powered by{' '}
          <a
            href="https://teachmecode.ae/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 hover:text-amazon-orange transition-colors"
          >
            TeachMeCode® Institute
          </a>
        </p>
      </div>
    </footer>
  );
}
