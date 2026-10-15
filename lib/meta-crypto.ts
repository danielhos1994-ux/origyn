export function randomHex(size=32){return Array.from(crypto.getRandomValues(new Uint8Array(size)),b=>b.toString(16).padStart(2,'0')).join('');}
export async function hash(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');}
export async function encryptToken(token:string,keyHex:string,purpose='origyn-meta-v1'){
 if(!/^[a-f0-9]{64}$/i.test(keyHex))throw new Error('Invalid encryption key');
 const key=await crypto.subtle.importKey('raw',new Uint8Array(keyHex.match(/../g)!.map(v=>parseInt(v,16))),{name:'AES-GCM'},false,['encrypt']);
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const ciphertext=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(purpose)},key,new TextEncoder().encode(token)));
 return JSON.stringify({v:1,iv:Array.from(iv),data:Array.from(ciphertext)});
}

export async function decryptToken(value:string,keyHex:string,purpose='origyn-meta-v1'){
 const data=JSON.parse(value) as {v:number;iv:number[];data:number[]};
 if(data.v!==1||data.iv.length!==12||!/^[a-f0-9]{64}$/i.test(keyHex))throw new Error('Invalid protected configuration');
 const key=await crypto.subtle.importKey('raw',new Uint8Array(keyHex.match(/../g)!.map(v=>parseInt(v,16))),{name:'AES-GCM'},false,['decrypt']);
 const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(data.iv),additionalData:new TextEncoder().encode(purpose)},key,new Uint8Array(data.data));
 return new TextDecoder().decode(plain);
}

export const decryptSecret=(value:string,keyHex:string)=>decryptToken(value,keyHex,'origyn-meta-app-secret-v1');
