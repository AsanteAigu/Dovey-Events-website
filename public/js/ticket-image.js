// Draws a booking as a branded ticket image (portrait, phone-friendly) and hands
// it to the visitor: the share sheet on phones (save to Photos, send on WhatsApp),
// a PNG download elsewhere. Pure canvas, no libraries.
import { formatDate, money, STATUS_LABELS } from './common.js';

const W = 1080;
const INK = '#0b0d12';
const PAPER = '#f6f1ea';
const CARD = '#fffdf9';
const ACCENT = '#9d56c2';
const LILAC = '#cfa6e6';
const MUTED = '#6f6a62';
const LINE = '#e2d9cc';
const SERIF = 'Cormorant, Georgia, serif';
const SANS = 'Manrope, "Segoe UI", system-ui, sans-serif';

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null); // the ticket still works without the logo
    img.src = src;
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Splits text into lines that fit maxWidth (at most maxLines, the last one ellipsised). */
function wrap(ctx, text, maxWidth, maxLines = 2) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !line) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    let last = lines[maxLines - 1];
    while (ctx.measureText(`${last}…`).width > maxWidth && last.length) last = last.slice(0, -1);
    lines[maxLines - 1] = `${last.trimEnd()}…`;
  }
  return lines;
}

async function draw(booking) {
  // Make sure the brand fonts are ready, or the canvas falls back to Georgia.
  await Promise.all([
    document.fonts.load(`500 96px ${SERIF}`),
    document.fonts.load(`italic 500 96px ${SERIF}`),
    document.fonts.load(`600 28px ${SANS}`),
    document.fonts.load(`400 28px ${SANS}`),
  ]).catch(() => {});
  const logo = await loadImage('/img/dovey-logo.png');

  // Lay out the detail rows first, so the ticket grows to fit long venues or extras.
  const pad = 88;
  const cardX = pad - 24;
  const cardY = 450;
  const cardW = W - 2 * cardX;
  const colX = [cardX + 64, cardX + cardW / 2 + 16];
  const colW = cardW / 2 - 96;
  const balance = Math.max(booking.totalAmount - booking.amountPaid, 0);
  const rows = [
    ['Occasion', booking.occasion.name, 'Package', booking.package.name],
    ['Date', formatDate(booking.eventDate), null, null],
    ['Guests', String(booking.guests), 'Venue', booking.venue || 'To be confirmed'],
    ['Event total', money(booking.totalAmount), booking.amountPaid > 0 ? 'Paid' : 'Deposit due',
      money(booking.amountPaid > 0 ? booking.amountPaid : booking.depositAmount)],
  ];
  if (booking.amountPaid > 0 && balance > 0) rows.push(['Balance before the event', money(balance), null, null]);
  if (booking.addOns?.length) rows.push(['Extras', booking.addOns.map((a) => a.name).join(', '), null, null]);

  const measure = document.createElement('canvas').getContext('2d');
  measure.font = `500 44px ${SERIF}`;
  const laidOut = rows.map(([l1, v1, l2, v2]) => {
    const cells = [[l1, v1, 0], [l2, v2, 1]]
      .filter(([label]) => label)
      .map(([label, value, col]) => ({ label, col, lines: wrap(measure, value, l2 === null ? cardW - 128 : colW, 2) }));
    return { cells, height: 58 + Math.max(...cells.map((c) => c.lines.length)) * 50 + 44 };
  });
  const stubY = cardY + 96 + laidOut.reduce((sum, row) => sum + row.height, 0);
  const cardH = stubY - cardY + 280;
  const H = cardY + cardH + 170;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.textBaseline = 'alphabetic';

  // Backdrop: ink with a soft orchid glow, like the site's hero.
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.85, 120, 0, W * 0.85, 120, 900);
  glow.addColorStop(0, 'rgba(157, 86, 194, 0.45)');
  glow.addColorStop(1, 'rgba(157, 86, 194, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Brand.
  if (logo) ctx.drawImage(logo, pad, 92, 64, 64 * (logo.height / logo.width));
  ctx.fillStyle = PAPER;
  ctx.font = `500 60px ${SERIF}`;
  ctx.fillText('Dovey', pad + 84, 144);
  const wordmarkWidth = ctx.measureText('Dovey').width;
  ctx.fillStyle = LILAC;
  ctx.font = `600 20px ${SANS}`;
  ctx.letterSpacing = '8px';
  ctx.fillText('EVENTS', pad + 84 + wordmarkWidth + 18, 140);
  ctx.letterSpacing = '0px';

  // Headline.
  const confirmed = ['confirmed', 'completed'].includes(booking.status);
  const lead = confirmed ? 'Your date is ' : 'Your booking ';
  ctx.font = `500 104px ${SERIF}`;
  ctx.fillStyle = PAPER;
  ctx.fillText(lead, pad, 330);
  const leadWidth = ctx.measureText(lead).width;
  ctx.font = `italic 500 104px ${SERIF}`;
  ctx.fillStyle = LILAC;
  ctx.fillText(confirmed ? 'held.' : 'details.', pad + leadWidth, 330);
  ctx.font = `400 30px ${SANS}`;
  ctx.fillStyle = 'rgba(246, 241, 234, 0.7)';
  ctx.fillText(`${booking.customerName} · ${STATUS_LABELS[booking.status] ?? booking.status}`, pad, 392);

  // The ticket card.
  roundRect(ctx, cardX, cardY, cardW, cardH, 36);
  ctx.fillStyle = CARD;
  ctx.fill();

  // Details, two columns.
  let y = cardY + 96;
  for (const row of laidOut) {
    for (const { label, col, lines } of row.cells) {
      ctx.fillStyle = MUTED;
      ctx.font = `600 20px ${SANS}`;
      ctx.letterSpacing = '3px';
      ctx.fillText(label.toUpperCase(), colX[col], y);
      ctx.letterSpacing = '0px';
      ctx.fillStyle = INK;
      ctx.font = `500 44px ${SERIF}`;
      lines.forEach((line, i) => ctx.fillText(line, colX[col], y + 58 + i * 50));
    }
    y += row.height;
  }

  // Perforation: dashed line with punched notches at both edges.
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 3;
  ctx.setLineDash([14, 12]);
  ctx.beginPath();
  ctx.moveTo(cardX + 40, stubY);
  ctx.lineTo(cardX + cardW - 40, stubY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = INK;
  for (const x of [cardX, cardX + cardW]) {
    ctx.beginPath();
    ctx.arc(x, stubY, 30, 0, Math.PI * 2);
    ctx.fill();
  }

  // Stub: the booking reference, big and legible.
  ctx.fillStyle = MUTED;
  ctx.font = `600 20px ${SANS}`;
  ctx.letterSpacing = '3px';
  ctx.fillText('BOOKING REFERENCE', cardX + 64, stubY + 92);
  ctx.letterSpacing = '0px';
  ctx.fillStyle = ACCENT;
  ctx.font = `600 64px ui-monospace, "Cascadia Mono", Menlo, monospace`;
  ctx.fillText(booking.reference, cardX + 64, stubY + 172);
  ctx.fillStyle = MUTED;
  ctx.font = `400 24px ${SANS}`;
  ctx.fillText('Show this ticket or quote the reference when you contact us.', cardX + 64, stubY + 222);

  // Footer.
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(246, 241, 234, 0.6)';
  ctx.font = `italic 500 34px ${SERIF}`;
  ctx.fillText('Where every detail matters.', W / 2, H - 88);
  ctx.font = `500 22px ${SANS}`;
  ctx.fillStyle = 'rgba(246, 241, 234, 0.45)';
  ctx.fillText(location.host, W / 2, H - 46);

  return canvas;
}

/** Saves the booking's ticket: share sheet on phones, PNG download otherwise. */
export async function saveTicket(booking) {
  const canvas = await draw(booking);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  const name = `Dovey-Events-${booking.reference}.png`;
  const file = new File([blob], name, { type: 'image/png' });

  if (navigator.canShare?.({ files: [file] }) && matchMedia('(pointer: coarse)').matches) {
    try {
      await navigator.share({ files: [file], title: 'Dovey Events booking', text: `Booking ${booking.reference}` });
      return;
    } catch (err) {
      if (err.name === 'AbortError') return; // they closed the share sheet
      // Anything else: fall through to a normal download.
    }
  }
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
