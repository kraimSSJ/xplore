import { jsPDF } from 'jspdf';
import { Order } from '../types';

const NAVY = '#0F1F3D';
const NAVY_LIGHT = '#1E3A63';
const WHITE = '#FFFFFF';
const GRAY = '#6B7280';
const BORDER = '#E5E7EB';

// Fetches an image URL and returns a data URL jsPDF can embed. Fails
// silently (returns null) for broken/unreachable/CORS-blocked images,
// same behavior as the old backend's fetchPhotoBuffers.
async function toDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generateOrderPdf(order: Order): Promise<Blob> {
  const photoCache = new Map<string, string>();
  await Promise.all(
    Array.from(new Set(order.items.map((i) => i.productPhotoUrl).filter(Boolean) as string[])).map(
      async (url) => {
        const dataUrl = await toDataUrl(url);
        if (dataUrl) photoCache.set(url, dataUrl);
      },
    ),
  );

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 40;

  function header() {
    doc.setFillColor(NAVY);
    doc.rect(0, 0, pageWidth, 90, 'F');
    doc.setTextColor(WHITE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(26);
    doc.text('XPLORE', marginX, 46);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text('Internal Order Invoice', marginX, 68);

    doc.setFontSize(10);
    doc.text(`Order #${order.id.slice(0, 8).toUpperCase()}`, pageWidth - marginX, 34, {
      align: 'right',
    });
    doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`, pageWidth - marginX, 50, {
      align: 'right',
    });
    doc.text(`Status: ${order.status.toUpperCase()}`, pageWidth - marginX, 66, { align: 'right' });
  }

  header();
  let y = 130;

  doc.setTextColor(NAVY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`Ordered by: ${order.user?.fullName || 'Unknown'}`, marginX, y);
  doc.setTextColor(GRAY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(order.user?.email || '', marginX, y + 16);

  y += 45;

  const colName = 100;
  const colQty = 330;
  const colPrice = 400;
  const colTotal = 480;
  const tableWidth = pageWidth - marginX * 2;

  function tableHeader() {
    doc.setFillColor(NAVY_LIGHT);
    doc.rect(marginX, y, tableWidth, 24, 'F');
    doc.setTextColor(WHITE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('PRODUCT', colName, y + 16);
    doc.text('QTY', colQty, y + 16);
    doc.text('PRICE', colPrice, y + 16);
    doc.text('TOTAL', colTotal, y + 16);
    y += 24;
  }

  tableHeader();
  let grandTotal = 0;

  for (const item of order.items || []) {
    const rowHeight = 55;
    if (y + rowHeight > pageHeight - 120) {
      doc.addPage();
      y = 40;
      header();
      y = 130;
      tableHeader();
    }

    doc.setDrawColor(BORDER);
    doc.setLineWidth(0.5);
    doc.rect(marginX, y, tableWidth, rowHeight);

    const photo = item.productPhotoUrl && photoCache.get(item.productPhotoUrl);
    if (photo) {
      try {
        doc.addImage(photo, marginX + 4, y + 4, 46, 46);
      } catch {
        // ignore broken images
      }
    }

    doc.setTextColor(NAVY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(item.productName, colName, y + 22, { maxWidth: 220 });

    doc.setTextColor(GRAY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`${item.quantity}`, colQty, y + 32);
    doc.text(
      item.unitPriceRmb
        ? `¥${item.unitPriceRmb.toFixed(2)} / ${item.unitPrice.toFixed(2)} MAD`
        : `${item.unitPrice.toFixed(2)} MAD`,
      colPrice,
      y + 32,
      { maxWidth: 75 },
    );
    doc.text(`${(item.unitPrice * item.quantity).toFixed(2)} MAD`, colTotal, y + 32);

    grandTotal += item.unitPrice * item.quantity;
    y += rowHeight;
  }

  y += 20;
  if (y + 100 > pageHeight - 60) {
    doc.addPage();
    y = 40;
  }

  const subtotal = grandTotal;
  const shipping = order.shippingCost || 0;
  const total = subtotal + shipping;
  const summaryX = 340;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(GRAY);
  doc.text('Subtotal:', summaryX, y);
  doc.text(`${subtotal.toFixed(2)} MAD`, summaryX + 180, y, { align: 'right' });

  y += 18;
  doc.text('Shipping:', summaryX, y);
  doc.text(`${shipping.toFixed(2)} MAD`, summaryX + 180, y, { align: 'right' });

  y += 22;
  doc.setFillColor(NAVY);
  doc.rect(summaryX, y, 180, 30, 'F');
  doc.setTextColor(WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('TOTAL', summaryX + 10, y + 20);
  doc.text(`${total.toFixed(2)} MAD`, summaryX + 170, y + 20, { align: 'right' });

  if (order.adminNotes) {
    y += 50;
    doc.setTextColor(NAVY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Notes:', marginX, y);
    doc.setTextColor(GRAY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(order.adminNotes, marginX, y + 14, { maxWidth: tableWidth });
  }

  return doc.output('blob');
}

export async function downloadOrderPdf(order: Order) {
  const blob = await generateOrderPdf(order);
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `order-${order.id.slice(0, 8)}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
