import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as LegacyFS from 'expo-file-system/legacy';
import type { Document } from '@/db/types';

export async function createPdfFromImages(imageUris: string[]): Promise<string> {
  const base64Images: string[] = [];
  for (const uri of imageUris) {
    try {
      const b64 = await LegacyFS.readAsStringAsync(uri, { encoding: LegacyFS.EncodingType.Base64 });
      base64Images.push(b64);
    } catch {
      // skip unreadable images
    }
  }

  const pagesHtml = base64Images
    .map(
      (b64, idx) => `
        <div class="page">
          <img src="data:image/jpeg;base64,${b64}" />
        </div>
        ${idx < base64Images.length - 1 ? '<div class="page-break"></div>' : ''}
      `
    )
    .join('\n');

  const html = `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { background: #fff; }
      .page { width: 100%; padding: 18px; }
      .page img { width: 100%; height: auto; object-fit: contain; }
      .page-break { page-break-after: always; }
    </style>
  </head>
  <body>
    ${pagesHtml}
  </body>
  </html>`;

  const { uri } = await Print.printToFileAsync({ html, base64: false });
  return uri;
}

function buildHtmlTemplate(doc: Document, categoryName: string | undefined, imageBase64: string | null): string {
  const priceRow = doc.purchase_price != null
    ? `<tr><td class="label">Purchase Price</td><td>$${doc.purchase_price.toFixed(2)}</td></tr>`
    : '';
  const expiryRow = doc.expiry_date
    ? `<tr><td class="label">Expiry Date</td><td>${doc.expiry_date}</td></tr>`
    : '';
  const categoryRow = categoryName
    ? `<tr><td class="label">Category</td><td>${categoryName}</td></tr>`
    : '';
  const notesRow = doc.notes
    ? `<tr><td class="label">Notes</td><td style="white-space:pre-wrap">${doc.notes}</td></tr>`
    : '';

  const imageHtml = imageBase64 && doc.file_type === 'image'
    ? `<div class="image-container">
         <img src="data:image/jpeg;base64,${imageBase64}" alt="Document" />
       </div>`
    : doc.file_type === 'pdf'
    ? `<div class="pdf-placeholder">
         <p>&#128196; PDF Document (see attached file)</p>
       </div>`
    : (doc.file_type === 'word' || doc.file_type === 'excel' || doc.file_type === 'document')
    ? `<div class="pdf-placeholder">
         <p>&#128196; ${doc.file_type === 'word' ? 'Word' : doc.file_type === 'excel' ? 'Excel' : 'Document'} file (see attached)</p>
       </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
      color: #1a1a1a;
      background: #ffffff;
      padding: 40px;
    }

    .header {
      display: flex;
      align-items: center;
      gap: 12px;
      border-bottom: 2px solid #10a37f;
      padding-bottom: 16px;
      margin-bottom: 28px;
    }

    .brand-badge {
      background: #10a37f;
      color: #fff;
      font-weight: 700;
      font-size: 13px;
      letter-spacing: 1px;
      padding: 4px 10px;
      border-radius: 4px;
    }

    .brand-label {
      color: #555;
      font-size: 12px;
    }

    h1 {
      font-size: 24px;
      font-weight: 700;
      color: #111;
      margin-bottom: 24px;
    }

    .image-container {
      margin-bottom: 28px;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      overflow: hidden;
      max-height: 400px;
    }

    .image-container img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
    }

    .pdf-placeholder {
      background: #fff5f5;
      border: 1px solid #fecaca;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
      color: #ef4444;
      margin-bottom: 28px;
      font-size: 15px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 28px;
    }

    td {
      padding: 10px 14px;
      font-size: 14px;
      border-bottom: 1px solid #f0f0f0;
      vertical-align: top;
    }

    td.label {
      font-weight: 600;
      color: #555;
      width: 140px;
      white-space: nowrap;
    }

    .footer {
      border-top: 1px solid #e0e0e0;
      padding-top: 14px;
      font-size: 11px;
      color: #aaa;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="header">
    <span class="brand-badge">VAULT</span>
    <span class="brand-label">Secure Document Archive</span>
  </div>

  <h1>${doc.title}</h1>

  ${imageHtml}

  <table>
    ${categoryRow}
    ${priceRow}
    ${expiryRow}
    ${notesRow}
    <tr>
      <td class="label">Saved</td>
      <td>${new Date(doc.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
    </tr>
    <tr>
      <td class="label">Last Updated</td>
      <td>${new Date(doc.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
    </tr>
  </table>

  <div class="footer">
    Generated by Vault · Secure Document Archive · ${new Date().toLocaleDateString()}
  </div>
</body>
</html>`;
}

/**
 * Renders a Document as a styled PDF and opens the native share sheet.
 * For image documents, the image is embedded directly into the PDF.
 */
export async function exportDocumentAsPdf(
  doc: Document,
  categoryName?: string
): Promise<void> {
  let imageBase64: string | null = null;

  if (doc.file_type === 'image' && doc.file_uri) {
    try {
      imageBase64 = await LegacyFS.readAsStringAsync(doc.file_uri, {
        encoding: LegacyFS.EncodingType.Base64,
      });
    } catch {
      // Non-critical: generate PDF without image if file read fails
    }
  }

  const html = buildHtmlTemplate(doc, categoryName, imageBase64);

  const { uri: pdfUri } = await Print.printToFileAsync({
    html,
    base64: false,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(pdfUri, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: `Export "${doc.title}"`,
    });
  }
}
