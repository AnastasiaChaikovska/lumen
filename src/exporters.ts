function saveBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function downloadText(filename: string, text: string) {
  saveBlob(filename, new Blob([text], { type: "text/plain;charset=utf-8" }));
}

export async function downloadDocx(filename: string, title: string, body: string) {
  const {
    AlignmentType,
    Document,
    HeadingLevel,
    Packer,
    Paragraph,
    TextRun
  } = await import("docx");

  const paragraphs = body.split("\n").map((line) => {
    const trimmed = line.trim();

    if (!trimmed) {
      return new Paragraph({ text: "" });
    }

    const isHeading =
      trimmed.length < 56 &&
      trimmed === trimmed.toUpperCase() &&
      /[A-Z]/.test(trimmed);

    if (isHeading) {
      return new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 240, after: 120 },
        children: [new TextRun({ text: trimmed, bold: true })]
      });
    }

    if (trimmed.startsWith("- ")) {
      return new Paragraph({
        bullet: { level: 0 },
        spacing: { after: 80 },
        children: [new TextRun(trimmed.slice(2))]
      });
    }

    return new Paragraph({
      spacing: { after: 100 },
      children: [new TextRun(trimmed)]
    });
  });

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
            spacing: { after: 260 },
            children: [new TextRun({ text: title, bold: true })]
          }),
          ...paragraphs
        ]
      }
    ]
  });

  const blob = await Packer.toBlob(doc);
  saveBlob(filename, blob);
}

export async function downloadPdf(filename: string, title: string, body: string) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 48;
  const lineHeight = 15;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  let y = margin;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text(title, pageWidth / 2, y, { align: "center" });
  y += 32;

  pdf.setFontSize(10);
  body.split("\n").forEach((line) => {
    const trimmed = line.trim();
    const isHeading =
      trimmed.length < 56 &&
      trimmed === trimmed.toUpperCase() &&
      /[A-Z]/.test(trimmed);

    if (!trimmed) {
      y += 8;
      return;
    }

    pdf.setFont("helvetica", isHeading ? "bold" : "normal");
    const wrapped = pdf.splitTextToSize(trimmed, pageWidth - margin * 2);

    wrapped.forEach((textLine: string) => {
      if (y > pageHeight - margin) {
        pdf.addPage();
        y = margin;
      }

      pdf.text(textLine, margin, y);
      y += lineHeight;
    });

    y += isHeading ? 8 : 3;
  });

  pdf.save(filename);
}
