declare module 'pdfkit' {
  interface PDFDocumentOptions {
    size?: string | [number, number];
    margin?: number;
    [key: string]: any;
  }

  interface TextOptions {
    align?: 'left' | 'center' | 'right' | 'justify';
    width?: number;
    link?: string;
    continued?: boolean;
    [key: string]: any;
  }

  class PDFDocument {
    constructor(options?: PDFDocumentOptions);
    
    page: {
      index: number;
      width: number;
      height: number;
    } | null;
    
    y: number;
    x: number;
    
    fontSize(size: number): this;
    font(name: string): this;
    fillColor(color: string): this;
    text(text: string, options?: TextOptions): this;
    text(text: string, x: number, y: number, options?: TextOptions): this;
    moveDown(amount?: number): this;
    moveTo(x: number, y: number): this;
    lineTo(x: number, y: number): this;
    stroke(): this;
    addPage(): this;
    switchToPage(pageIndex: number): this;
    heightOfString(text: string, options?: { width?: number }): number;
    widthOfString(text: string): number;
    save(): this;
    restore(): this;
    on(event: string, callback: () => void): this;
    bufferedPageRange(): { start: number; count: number };
  }
  
  export = PDFDocument;
}

