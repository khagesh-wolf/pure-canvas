/**
 * QR Code Generator Utility
 * Generates QR codes as SVG strings for offline use
 * Based on the qrcode.react implementation pattern
 */

// QR Code generation using a simplified approach that works offline
// This uses the same algorithm as qrcode.react but outputs SVG strings

import { QRCodeSVG } from 'qrcode.react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';

/**
 * Generate a QR code as an SVG string
 */
export function generateQRSVG(data: string, size: number = 120): string {
  const element = createElement(QRCodeSVG, {
    value: data,
    size: size,
    level: 'M',
    includeMargin: true,
  });
  
  return renderToStaticMarkup(element);
}

/**
 * Generate QR data for tables and WiFi for printing
 */
export interface PrintQRData {
  tableNum: number;
  tableQR: string;
  wifiQR: string | null;
}

export function generatePrintQRData(
  tableCount: number,
  baseUrl: string,
  wifiSSID?: string,
  wifiPassword?: string
): PrintQRData[] {
  const wifiQRData = wifiSSID 
    ? `WIFI:T:WPA;S:${wifiSSID};P:${wifiPassword || ''};;`
    : null;
  
  const wifiQRSVG = wifiQRData ? generateQRSVG(wifiQRData, 120) : null;
  
  const result: PrintQRData[] = [];
  
  for (let i = 1; i <= tableCount; i++) {
    const tableUrl = `${baseUrl}/table/${i}`;
    result.push({
      tableNum: i,
      tableQR: generateQRSVG(tableUrl, 120),
      wifiQR: wifiQRSVG,
    });
  }
  
  return result;
}
