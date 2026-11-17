import qrcode from 'qrcode-generator';
// Four modules of unprinted quiet zone on all sides. No data leaves this site.
export function displayQR(value:string){
 const code=qrcode(0,'Q');code.addData(value,'Byte');code.make();
 const n=code.getModuleCount(),path:string[]=[];
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  if(!code.isDark(y,x))continue;
  let end=x+1;while(end<n&&code.isDark(y,end))end++;
  const len=end-x;path.push(`M${x+4} ${y+4}h${len}v1h-${len}z`);x=end-1;
 }
 return {size:n+8,path:path.join('')};
}
