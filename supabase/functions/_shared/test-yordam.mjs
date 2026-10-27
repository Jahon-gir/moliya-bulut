// Sinov yordamchilari (faqat testlar uchun; funksiyalarga joylanmaydi): qurilma kalitlari va MUSTAQIL deshifrlash (RFC 8291, qabul qiluvchi tomoni).
import assert from 'node:assert/strict';
import * as P from './push.ts';
const subtle = globalThis.crypto.subtle;

export async function qurilmaJuftligi() {
  const kp = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const auth = crypto.getRandomValues(new Uint8Array(16));
  return { kp, p256dh: P.b64uKodla(new Uint8Array(await subtle.exportKey('raw', kp.publicKey))), auth: P.b64uKodla(auth), authBayt: auth };
}
export async function vapidJuftligi() {
  const kp = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const jwk = await subtle.exportKey('jwk', kp.privateKey);
  return { ochiq: P.b64uKodla(new Uint8Array(await subtle.exportKey('raw', kp.publicKey))), maxfiy: jwk.d };
}
async function hkdf(ikm, salt, info, uzunlik) {
  const hmac = async (kalit, xabar) => new Uint8Array(await subtle.sign('HMAC', await subtle.importKey('raw', kalit, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), xabar));
  const prk = await hmac(salt, ikm);
  let t = new Uint8Array(0), chiqish = new Uint8Array(0);
  for (let i = 1; chiqish.length < uzunlik; i++) { t = await hmac(prk, Uint8Array.from([...t, ...info, i])); chiqish = Uint8Array.from([...chiqish, ...t]); }
  return chiqish.slice(0, uzunlik);
}
export async function deshifrla(tana, q) {
  const uaOchiq = P.b64uOch(q.p256dh);
  const tuz = tana.slice(0, 16), idlen = tana[20], asOchiq = tana.slice(21, 21 + idlen), shifr = tana.slice(21 + idlen);
  const asKalit = await subtle.importKey('raw', asOchiq, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: asKalit }, q.kp.privateKey, 256));
  const enc = (s) => new TextEncoder().encode(s);
  const ikm = await hkdf(ecdh, q.authBayt, Uint8Array.from([...enc('WebPush: info\0'), ...uaOchiq, ...asOchiq]), 32);
  const cek = await hkdf(ikm, tuz, enc('Content-Encoding: aes128gcm\0'), 16), nonce = await hkdf(ikm, tuz, enc('Content-Encoding: nonce\0'), 12);
  const ochiq = new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: nonce }, await subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']), shifr));
  assert.equal(ochiq[ochiq.length - 1], 2);
  return JSON.parse(new TextDecoder().decode(ochiq.slice(0, -1)));
}
