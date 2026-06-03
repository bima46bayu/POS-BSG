// src/lib/printTicket.js
import html2canvas from "html2canvas";

/**
 * Capture a DOM node (thermal receipt) and open the system print dialog
 * with only that image — avoids printing the whole modal/page on tablet.
 */
export async function printElementById(elementId) {
  const el = document.getElementById(elementId);
  if (!el) {
    throw new Error("Area struk tidak ditemukan");
  }

  const canvas = await html2canvas(el, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
    allowTaint: true,
    logging: false,
    height: el.scrollHeight,
    windowHeight: el.scrollHeight,
    scrollX: 0,
    scrollY: 0,
    ignoreElements: (node) => node.classList?.contains("no-print"),
  });

  const imgData = canvas.toDataURL("image/png");
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Struk</title>
        <style>
          @page { size: 80mm auto; margin: 4mm; }
          html, body { margin: 0; padding: 0; background: #fff; }
          img { width: 80mm; max-width: 100%; display: block; margin: 0 auto; }
        </style>
      </head>
      <body>
        <img src="${imgData}" alt="Struk" />
      </body>
    </html>
  `;

  // Dedicated window works more reliably on Android/iOS tablets than hidden iframe.
  const printWin = window.open("", "_blank", "noopener,noreferrer");
  if (printWin) {
    printWin.document.open();
    printWin.document.write(html);
    printWin.document.close();

    const trigger = () => {
      printWin.focus();
      printWin.print();
      printWin.onafterprint = () => {
        try {
          printWin.close();
        } catch (_) {}
      };
      setTimeout(() => {
        try {
          if (!printWin.closed) printWin.close();
        } catch (_) {}
      }, 60000);
    };

    if (printWin.document.readyState === "complete") {
      setTimeout(trigger, 350);
    } else {
      printWin.onload = () => setTimeout(trigger, 350);
    }
    return;
  }

  // Fallback: hidden iframe (desktop)
  const iframe = document.createElement("iframe");
  iframe.style.cssText =
    "position:fixed;left:-9999px;top:0;width:0;height:0;border:0;";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    throw new Error("Gagal membuka dialog print");
  }

  doc.open();
  doc.write(html);
  doc.close();

  iframe.onload = () => {
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } finally {
        setTimeout(() => document.body.removeChild(iframe), 1000);
      }
    }, 300);
  };
}
