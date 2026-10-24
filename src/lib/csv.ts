/** Small RFC-4180-style CSV reader/writer for bounded admin imports/exports. */
export function parseCsv(input: string): string[][] {
 if (input.length > 1_000_000) throw new Error('CSV upload is too large (maximum 1 MB).');
 const rows: string[][] = []; let row: string[] = [], cell = '', quoted = false; const source = input.replace(/^\uFEFF/, '');
 for (let i=0;i<source.length;i+=1) { const ch=source[i]!; if(quoted){if(ch==='"'&&source[i+1]==='"'){cell+='"';i+=1;}else if(ch==='"')quoted=false;else cell+=ch;} else if(ch==='"'&&cell.length===0)quoted=true;else if(ch===','){row.push(cell);cell='';}else if(ch==='\n'){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';}else cell+=ch; }
 if(quoted)throw new Error('CSV contains an unclosed quoted field.');if(cell.length||row.length){row.push(cell.replace(/\r$/,''));rows.push(row);}return rows.filter((r)=>r.some((v)=>v.trim()!==''));
}
export function csvCell(value: unknown): string {let text=value==null?'':value instanceof Date?value.toISOString():String(value);if(/^[\u0000-\u0020]*[=+@-]/.test(text))text=`'${text}`;return /[",\r\n]/.test(text)?`"${text.replaceAll('"','""')}"`:text;}
export function toCsv(headers:string[],rows:unknown[][]):string{return [headers,...rows].map((row)=>row.map(csvCell).join(',')).join('\r\n');}
