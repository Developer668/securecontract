import { isIP } from 'node:net';
const privateHosts=[/^localhost$/i,/^127\./,/^10\./,/^192\.168\./,/^169\.254\./,/^0\./,/^::1$/,/^fc/i,/^fd/i];
export function assertPublicHttpUrl(value:string):URL {
  const url=new URL(value);
  if(!['http:','https:'].includes(url.protocol))throw new Error('Only HTTP(S) source URLs are allowed');
  if(url.username||url.password)throw new Error('Source URLs must not contain credentials');
  const host=url.hostname.replace(/^\[|\]$/g,'');
  if(privateHosts.some(pattern=>pattern.test(host))||(isIP(host)===4&&host.startsWith('172.')&&Number(host.split('.')[1])>=16&&Number(host.split('.')[1])<=31))throw new Error('Private or local source URLs are not allowed');
  return url;
}
