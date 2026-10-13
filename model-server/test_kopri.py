# -*- coding: utf-8 -*-
"""Ko'prik sinovi. Ishga tushirish:  python3 model-server/test_kopri.py
Ollama taqlid qilinadi (kompyuteringizdagi haqiqiy Ollama kerak emas), kalit uydirma."""
import contextlib
import http.client
import io
import json
import os
import subprocess
import sys
import threading
import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer

BU = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BU)
import kopri  # noqa: E402

KALIT = "sinov-kalit-uydirma-1234567890"


class SoxtaOllama(BaseHTTPRequestHandler):
    kelgan = []   # (yo'l, sarlavhalar, tana)

    def log_message(self, *a):
        pass

    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0)
        tana = json.loads(self.rfile.read(n).decode("utf-8"))
        SoxtaOllama.kelgan.append((self.path, dict(self.headers), tana))
        javob = json.dumps({"model": tana.get("model"), "message": {"role": "assistant", "content": "[]"}, "done": True}).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(javob)))
        self.end_headers()
        self.wfile.write(javob)


class KopriSinovi(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ollama = HTTPServer(("127.0.0.1", 0), SoxtaOllama)
        threading.Thread(target=cls.ollama.serve_forever, daemon=True).start()
        cls.kopri = kopri.yarat(KALIT, ["chuntak-v5"], port=0, ollama_port=cls.ollama.server_address[1])
        threading.Thread(target=cls.kopri.serve_forever, daemon=True).start()
        cls.port = cls.kopri.server_address[1]

    @classmethod
    def tearDownClass(cls):
        cls.kopri.shutdown()
        cls.ollama.shutdown()
        cls.kopri.server_close()
        cls.ollama.server_close()

    def setUp(self):
        SoxtaOllama.kelgan.clear()

    def so(self, yol="/api/chat", metod="POST", tana=None, sarlavha=None, xom=None):
        c = http.client.HTTPConnection("127.0.0.1", self.port, timeout=10)
        h = {"Content-Type": "application/json"}
        if sarlavha is not None:
            h.update(sarlavha)
        body = xom if xom is not None else (json.dumps(tana).encode("utf-8") if tana is not None else None)
        c.request(metod, yol, body=body, headers=h)
        r = c.getresponse()
        data = r.read()
        c.close()
        return r.status, data

    def togri(self, **ustiga):
        t = {"model": "chuntak-v5", "stream": False, "messages": [{"role": "user", "content": "salom"}]}
        t.update(ustiga)
        return t

    def test_kalitsiz_401(self):
        self.assertEqual(self.so(tana=self.togri())[0], 401)
        self.assertEqual(SoxtaOllama.kelgan, [])

    def test_notogri_kalit_401(self):
        self.assertEqual(self.so(tana=self.togri(), sarlavha={"X-Model-Kalit": KALIT + "x"})[0], 401)
        self.assertEqual(self.so(tana=self.togri(), sarlavha={"X-Model-Kalit": ""})[0], 401)
        self.assertEqual(self.so(tana=self.togri(), sarlavha={"X-Model-Kalit": KALIT[:-1]})[0], 401)
        self.assertEqual(SoxtaOllama.kelgan, [])

    def test_notogri_yol_404(self):
        k = {"X-Model-Kalit": KALIT}
        for yol in ["/", "/api/generate", "/api/tags", "/api/chat/", "/api/chat?x=1", "/v1/chat/completions", "/api/pull"]:
            self.assertEqual(self.so(yol=yol, tana=self.togri(), sarlavha=k)[0], 404, yol)
        for metod in ["GET", "PUT", "DELETE", "PATCH", "OPTIONS"]:
            self.assertEqual(self.so(metod=metod, sarlavha=k)[0], 404, metod)
        self.assertEqual(SoxtaOllama.kelgan, [])

    def test_katta_tana_413(self):
        katta = self.togri(messages=[{"role": "user", "content": "a" * (kopri.TANA_MAX + 10)}])
        self.assertEqual(self.so(tana=katta, sarlavha={"X-Model-Kalit": KALIT})[0], 413)
        self.assertEqual(SoxtaOllama.kelgan, [])

    def test_ruxsatsiz_model_rad(self):
        k = {"X-Model-Kalit": KALIT}
        for nom in ["boshqa-model", "llama3", "", None, 5, "CHUNTAK-V5"]:
            t = self.togri()
            t["model"] = nom
            self.assertEqual(self.so(tana=t, sarlavha=k)[0], 403, repr(nom))
        t = self.togri()
        del t["model"]
        self.assertEqual(self.so(tana=t, sarlavha=k)[0], 403)
        self.assertEqual(SoxtaOllama.kelgan, [])

    def test_buzuq_tana_400(self):
        k = {"X-Model-Kalit": KALIT}
        self.assertEqual(self.so(xom=b"json emas", sarlavha=k)[0], 400)
        self.assertEqual(self.so(xom=b"[1,2]", sarlavha=k)[0], 400)
        self.assertEqual(self.so(xom=b"\xff\xfe", sarlavha=k)[0], 400)

    def test_togri_sorov_otadi_stream_false_kalit_uzatilmaydi(self):
        status, data = self.so(tana=self.togri(stream=True), sarlavha={"X-Model-Kalit": KALIT})
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(data)["message"]["content"], "[]")
        self.assertEqual(len(SoxtaOllama.kelgan), 1)
        yol, sarlavhalar, tana = SoxtaOllama.kelgan[0]
        self.assertEqual(yol, "/api/chat")
        self.assertIs(tana["stream"], False, "stream majburan false")
        self.assertEqual(tana["messages"][0]["content"], "salom")
        self.assertNotIn("X-Model-Kalit", sarlavhalar, "kalit Ollama'ga uzatilmaydi")

    def test_ollama_ochiq_emas_502(self):
        s = kopri.yarat(KALIT, ["chuntak-v5"], port=0, ollama_port=1)   # 1-port: hech narsa tinglamaydi
        threading.Thread(target=s.serve_forever, daemon=True).start()
        try:
            c = http.client.HTTPConnection("127.0.0.1", s.server_address[1], timeout=10)
            c.request("POST", "/api/chat", body=json.dumps(self.togri()).encode(), headers={"X-Model-Kalit": KALIT, "Content-Type": "application/json"})
            self.assertEqual(c.getresponse().status, 502)
        finally:
            s.shutdown()
            s.server_close()

    def test_log_faqat_vaqt_va_holat(self):
        belgi = "MAXFIY-GAP-BELGISI"
        xato = io.StringIO()
        with contextlib.redirect_stderr(xato):
            self.so(tana=self.togri(messages=[{"role": "user", "content": belgi}]), sarlavha={"X-Model-Kalit": KALIT})
            self.so(tana=self.togri(), sarlavha={"X-Model-Kalit": "noto'g'ri-kalit-sinov"})
            self.so(yol="/yashirin-yol-belgisi")
        log = xato.getvalue()
        for taqiq in [belgi, KALIT, "noto'g'ri-kalit-sinov", "yashirin-yol-belgisi", "salom", "/api/chat"]:
            self.assertNotIn(taqiq, log)
        qatorlar = [q for q in log.splitlines() if q.strip()]
        self.assertEqual(len(qatorlar), 3)
        for q in qatorlar:
            self.assertRegex(q, r"^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\] \d{3}$")

    def test_faqat_localhostda_tinglaydi(self):
        self.assertEqual(self.kopri.server_address[0], "127.0.0.1")


class IshgaTushirishSinovi(unittest.TestCase):
    def yurgiz(self, env_ustiga):
        env = {k: v for k, v in os.environ.items() if k not in ("MODEL_KALIT", "KOPRI_PORT", "MODEL_RUXSAT")}
        env.update(env_ustiga)
        return subprocess.run([sys.executable, "-I", os.path.join(BU, "kopri.py")], env=env, capture_output=True, text=True, timeout=20)

    def test_kalit_yoq_yoki_qisqa_bolsa_toxtaydi(self):
        for env in [{}, {"MODEL_KALIT": ""}, {"MODEL_KALIT": "qisqa-kalit"}, {"MODEL_KALIT": "a" * 15}]:
            r = self.yurgiz(env)
            self.assertEqual(r.returncode, 2, env)
            self.assertIn("MODEL_KALIT", r.stderr)
            self.assertNotIn("qisqa-kalit", r.stderr + r.stdout, "kalit chop etilmaydi")

    def test_notogri_port_toxtaydi(self):
        r = self.yurgiz({"MODEL_KALIT": "a" * 20, "KOPRI_PORT": "abc"})
        self.assertEqual(r.returncode, 2)
        self.assertNotIn("a" * 20, r.stderr + r.stdout)


if __name__ == "__main__":
    unittest.main(verbosity=2)
