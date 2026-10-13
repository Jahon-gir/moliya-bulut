#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Chuntak AI "ko'prik": Ollama oldidagi kalit tekshiruvchi darvoza.

Nima uchun kerak: Ollama'ning o'zida parol yo'q. Internetga to'g'ridan-to'g'ri chiqarsangiz, har kim modelingizdan foydalanadi.
Ko'prik faqat to'g'ri kalit (X-Model-Kalit sarlavhasi) bilan kelgan so'rovni Ollama'ga uzatadi.

Ishga tushirish (Windows PowerShell):
    $env:MODEL_KALIT="<o'zingiz o'ylab topgan uzun kalit>"
    python model-server/kopri.py

Faqat standart kutubxona ishlatiladi (hech narsa o'rnatish shart emas). Kalit hech qayerga yozilmaydi va chop etilmaydi.
Tana (savol) va javob logga YOZILMAYDI: faqat vaqt va holat kodi.
"""
import hmac
import http.client
import json
import os
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

TINGLASH_MANZILI = "127.0.0.1"            # faqat shu kompyuterning o'zidan (internetga Tailscale/Cloudflare chiqaradi)
SUKUT_PORT = 8787
OLLAMA_MANZILI = "127.0.0.1"
OLLAMA_PORT = 11434
TANA_MAX = 20 * 1024                       # 20 KB
KALIT_MIN = 16
JAVOB_MAX = 2 * 1024 * 1024                # Ollama javobi 2 MB dan oshmasin
SUKUT_MODEL = "chuntak-v5"
OLLAMA_VAQT = 120                          # sekund: model sovuq ishga tushganda birinchi javob sekin bo'lishi mumkin


def log_qatori(holat):
    """Faqat vaqt va holat kodi. Yo'l, tana, sarlavha, kalit yozilmaydi."""
    sys.stderr.write("[%s] %s\n" % (time.strftime("%Y-%m-%d %H:%M:%S"), holat))
    sys.stderr.flush()


def ruxsat_royxati(matn):
    return [x.strip() for x in (matn or SUKUT_MODEL).split(",") if x.strip()]


def yarat(kalit, ruxsat_modellar, port=SUKUT_PORT, ollama_port=OLLAMA_PORT, ollama_vaqt=OLLAMA_VAQT):
    """Serverni yaratadi (ishga tushirmaydi). Sinov ham shuni ishlatadi."""
    kalit_bayt = kalit.encode("utf-8")

    class Ishlovchi(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"
        timeout = 30                       # sekin/osilib qolgan ulanishlar uchun
        server_version = "Kopri"
        sys_version = ""

        # standart log o'chiriladi (u yo'l va manzilni yozadi); o'rniga log_qatori
        def log_message(self, *args):
            pass

        def log_request(self, *args, **kwargs):
            pass

        def log_error(self, *args, **kwargs):
            pass

        def javob(self, holat, tana=b"", turi="application/json; charset=utf-8"):
            if isinstance(tana, (dict, list)):
                tana = json.dumps(tana, ensure_ascii=False).encode("utf-8")
            self.send_response(holat)
            self.send_header("Content-Type", turi)
            self.send_header("Content-Length", str(len(tana)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("Connection", "close")
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(tana)
            self.close_connection = True
            log_qatori(holat)

        def xato(self, holat, xabar):
            self.javob(holat, {"xato": xabar})

        def yoq(self):
            self.xato(404, "Topilmadi.")

        do_GET = do_PUT = do_DELETE = do_PATCH = do_HEAD = do_OPTIONS = lambda self: self.yoq()

        def do_POST(self):
            if self.path != "/api/chat":
                return self.yoq()
            berilgan = (self.headers.get("X-Model-Kalit") or "").encode("utf-8")
            if not hmac.compare_digest(berilgan, kalit_bayt):
                return self.xato(401, "Kalit noto'g'ri yoki yo'q.")
            uzunlik = self.headers.get("Content-Length")
            if uzunlik is None:
                return self.xato(411, "Content-Length kerak.")
            try:
                n = int(uzunlik)
            except ValueError:
                return self.xato(400, "Content-Length noto'g'ri.")
            if n < 0:
                return self.xato(400, "Content-Length noto'g'ri.")
            if n > TANA_MAX:
                return self.xato(413, "So'rov juda katta.")
            xom = self.rfile.read(n)
            try:
                tana = json.loads(xom.decode("utf-8"))
            except (ValueError, UnicodeDecodeError):
                return self.xato(400, "JSON emas.")
            if not isinstance(tana, dict):
                return self.xato(400, "JSON obyekt kerak.")
            if tana.get("model") not in ruxsat_modellar:
                return self.xato(403, "Bu model nomi ruxsat etilmagan.")
            tana["stream"] = False         # majburan
            yuboriladigan = json.dumps(tana, ensure_ascii=False).encode("utf-8")
            try:
                ulanish = http.client.HTTPConnection(OLLAMA_MANZILI, ollama_port, timeout=ollama_vaqt)
                try:
                    ulanish.request("POST", "/api/chat", body=yuboriladigan, headers={"Content-Type": "application/json", "Content-Length": str(len(yuboriladigan))})
                    r = ulanish.getresponse()
                    javob_tanasi = r.read(JAVOB_MAX + 1)
                    holat = r.status
                finally:
                    ulanish.close()
            except (OSError, http.client.HTTPException):
                return self.xato(502, "Ollama javob bermadi (ishlayaptimi?).")
            if len(javob_tanasi) > JAVOB_MAX:
                return self.xato(502, "Ollama javobi juda katta.")
            self.javob(holat, javob_tanasi)

    class Server(ThreadingHTTPServer):
        daemon_threads = True

    return Server((TINGLASH_MANZILI, port), Ishlovchi)


def asosiy():
    kalit = os.environ.get("MODEL_KALIT", "")
    if len(kalit) < KALIT_MIN:
        sys.stderr.write(
            "XATO: MODEL_KALIT yo'q yoki juda qisqa (kamida %d belgi kerak).\n"
            "PowerShell'da shunday bering (qo'shtirnoq ichiga o'zingiz o'ylab topgan uzun kalitni yozing):\n"
            "    $env:MODEL_KALIT=\"<uzun-kalit>\"\n"
            "    python model-server/kopri.py\n" % KALIT_MIN
        )
        return 2
    try:
        port = int(os.environ.get("KOPRI_PORT", SUKUT_PORT))
    except ValueError:
        sys.stderr.write("XATO: KOPRI_PORT son bo'lishi kerak.\n")
        return 2
    server = yarat(kalit, ruxsat_royxati(os.environ.get("MODEL_RUXSAT")), port)
    print("Ko'prik ishga tushdi: http://%s:%d  (Ollama: %s:%d). To'xtatish: Ctrl+C" % (TINGLASH_MANZILI, port, OLLAMA_MANZILI, OLLAMA_PORT))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nTo'xtatildi.")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(asosiy())
