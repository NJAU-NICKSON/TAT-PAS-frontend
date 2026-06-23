
const SCION_GREEN = '#1FA64A';
const SCION_RED = '#E2231A';

const SCION_MARK_SVG = `
<svg width="46" height="46" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M70 22c-8-9-22-11-33-6-11 5-17 16-14 27 2 7 8 12 16 13-9 1-15 7-16 15-2 11 5 22 17 26 11 4 24 1 32-8-7 5-17 6-25 2-7-3-11-10-9-17 2-6 8-10 15-10h2v-16h-2c-7 0-13-4-15-10-2-7 2-14 9-17 8-4 18-3 25 2 0 0 1-21-7-21Z" fill="${SCION_GREEN}"/>
  <path d="M42 30h16v12h12v16H58v12H42V58H30V42h12V30Z" fill="${SCION_RED}"/>
</svg>`;

export interface PrintOptions {
  title: string;
  documentLabel?: string;
  reference?: string;
  body: string;
  footerNote?: string;
}

function buildHtml({ title, documentLabel, reference, body, footerNote }: PrintOptions): string {
  const now = new Date();
  const printedAt = now.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 28px; color: #1e293b; font-size: 13px; }
  .letterhead { display: flex; justify-content: space-between; align-items: flex-start;
    margin-bottom: 22px; padding-bottom: 16px; border-bottom: 3px solid ${SCION_GREEN}; }
  .brand { display: flex; align-items: center; gap: 12px; }
  .brand-text .name { font-size: 20px; font-weight: 800; color: #0f172a; line-height: 1; }
  .brand-text .name .hl { color: ${SCION_GREEN}; }
  .brand-text .branch { font-size: 11px; color: #64748b; margin-top: 3px; }
  .brand-text .tagline { font-size: 10px; font-style: italic; color: #94a3b8; margin-top: 2px; }
  .doc-meta { text-align: right; }
  .doc-meta .label { font-size: 14px; font-weight: 800; color: #0f172a; letter-spacing: 0.04em; }
  .doc-meta .ref { font-family: monospace; font-size: 11px; color: #64748b; margin-top: 3px; }
  .doc-meta .date { font-size: 11px; color: #64748b; margin-top: 6px; }
  .footer { margin-top: 36px; padding-top: 14px; border-top: 1px solid #e2e8f0;
    text-align: center; font-size: 10.5px; color: #94a3b8; line-height: 1.6; }
  table { width: 100%; border-collapse: collapse; }
  @media print { body { padding: 14px; } @page { margin: 14mm; } }
</style></head>
<body>
  <div class="letterhead">
    <div class="brand">
      ${SCION_MARK_SVG}
      <div class="brand-text">
        <div class="name">SCION <span class="hl">Hospital</span></div>
        <div class="branch">Mwiki Branch, Nairobi</div>
        <div class="tagline">Caring from the heart…</div>
      </div>
    </div>
    <div class="doc-meta">
      ${documentLabel ? `<div class="label">${documentLabel}</div>` : ''}
      ${reference ? `<div class="ref">${reference}</div>` : ''}
      <div class="date">${printedAt}</div>
    </div>
  </div>

  ${body}

  <div class="footer">
    ${footerNote ? `<p>${footerNote}</p>` : ''}
    <p>This is a computer-generated document from TAT-PAS and requires no signature.</p>
    <p>Printed: ${printedAt}</p>
  </div>
</body></html>`;
}

export function printDocument(options: PrintOptions): void {
  const html = buildHtml(options);

  if (printViaIframe(html)) return;
  printViaWindow(html);
}

function withAutoPrint(html: string): string {
  const autoPrint = `
<script>
  (function () {
    function go() {
      try { window.focus(); window.print(); } catch (e) {}
    }
    if (document.readyState === 'complete') { setTimeout(go, 120); }
    else { window.addEventListener('load', function () { setTimeout(go, 120); }); }
  })();
</scr` + `ipt>`;
  return html.includes('</body>')
    ? html.replace('</body>', `${autoPrint}</body>`)
    : html + autoPrint;
}

function printViaIframe(html: string): boolean {
  try {
    const existing = document.getElementById('tatpas-print-frame');
    if (existing) existing.remove();

    const iframe = document.createElement('iframe');
    iframe.id = 'tatpas-print-frame';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.srcdoc = withAutoPrint(html);
    document.body.appendChild(iframe);

    iframe.addEventListener('load', () => {
      setTimeout(() => {
        try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); } catch { /* ignore */ }
      }, 150);
      setTimeout(() => iframe.remove(), 2000);
    });

    return true;
  } catch {
    return false;
  }
}

function printViaWindow(html: string): void {
  const win = window.open('', '_blank');
  if (!win) {
    const blob = new Blob([withAutoPrint(html)], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return;
  }
  win.document.open();
  win.document.write(withAutoPrint(html));
  win.document.close();
  win.focus();
}
