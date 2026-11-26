import uvicorn
import ssl
import sys
import os
import httpx

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

app = FastAPI(title="VoiceCraft Studio - Local & Mesh TTS Workbench", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

TTS_GATEWAY_URL = "https://127.0.0.1:8096"
COLLAB_HUB_URL = "https://127.0.0.1:8086"
WEB_DIR = "/home/pj-mcnerney/ai/voicecraft/web"
os.makedirs(WEB_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=WEB_DIR), name="static")

@app.get("/", response_class=HTMLResponse)
async def serve_index():
    index_file = os.path.join(WEB_DIR, "index.html")
    if os.path.exists(index_file):
        with open(index_file, "r", encoding="utf-8") as f:
            return f.read()
    return "<h1>VoiceCraft Studio Initializing...</h1>"

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "VoiceCraft Studio",
        "port": 8097,
        "engine": "Kokoro-v1.0 ONNX + ElevenLabs Mesh"
    }

# Proxy endpoints to local TTS Gateway to avoid cross-port TLS cert issues in browser
@app.get("/api/tts/voices")
async def proxy_voices():
    async with httpx.AsyncClient(verify=False, timeout=10.0) as client:
        try:
            resp = await client.get(f"{TTS_GATEWAY_URL}/v1/audio/voices")
            return resp.json()
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"TTS Gateway unreachable: {e}")

@app.post("/api/tts/speech")
async def proxy_speech(request: Request):
    body = await request.json()
    async with httpx.AsyncClient(verify=False, timeout=60.0) as client:
        try:
            resp = await client.post(f"{TTS_GATEWAY_URL}/v1/audio/speech", json=body)
            return Response(
                content=resp.content,
                status_code=resp.status_code,
                media_type=resp.headers.get("content-type", "audio/wav")
            )
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"TTS Gateway synthesis failed: {e}")

# Proxy endpoints to Collab Mesh Hub & Lore Gateway (:8086)
@app.api_route("/api/lore/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def proxy_lore(path: str, request: Request):
    headers = dict(request.headers)
    headers.pop("host", None)
    headers.pop("content-length", None)
    body = await request.body()

    async with httpx.AsyncClient(verify=False, timeout=60.0) as client:
        try:
            resp = await client.request(
                method=request.method,
                url=f"{COLLAB_HUB_URL}/api/lore/{path}",
                params=request.query_params,
                content=body,
                headers=headers,
            )
            return Response(
                content=resp.content,
                status_code=resp.status_code,
                headers=dict(resp.headers),
            )
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Lore Gateway proxy error: {e}")

@app.api_route("/api/rooms/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def proxy_rooms(path: str, request: Request):
    headers = dict(request.headers)
    headers.pop("host", None)
    headers.pop("content-length", None)
    body = await request.body()

    async with httpx.AsyncClient(verify=False, timeout=60.0) as client:
        try:
            resp = await client.request(
                method=request.method,
                url=f"{COLLAB_HUB_URL}/api/rooms/{path}",
                params=request.query_params,
                content=body,
                headers=headers,
            )
            return Response(
                content=resp.content,
                status_code=resp.status_code,
                headers=dict(resp.headers),
            )
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Collab rooms proxy error: {e}")

PORT = 8097
CERT_FILE = "/home/pj-mcnerney/ai/certs/server.crt"
KEY_FILE = "/home/pj-mcnerney/ai/certs/server.key"

if __name__ == "__main__":
    print(f"Starting VoiceCraft Studio on https://0.0.0.0:{PORT} (Tailscale: https://100.127.211.57:{PORT})")
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=PORT,
        ssl_keyfile=KEY_FILE,
        ssl_certfile=CERT_FILE,
        log_level="info",
    )
