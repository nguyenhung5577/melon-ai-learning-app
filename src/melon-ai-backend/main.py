import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from api.endpoints import router
import os
from dotenv import load_dotenv

# Ép hệ thống load file .env thủ công để chắc chắn nhận key
load_dotenv()


print("[BẢO HIỂM BACKEND] Kiểm tra key cấu hình...")
print("OpenRouter API Key:", os.getenv("OPENROUTER_API_KEY")[:15] + "..." if os.getenv("OPENROUTER_API_KEY") else "❌ BỊ THIẾU")
print("ElevenLabs API Key:", os.getenv("ELEVENLABS_API_KEY")[:15] + "..." if os.getenv("ELEVENLABS_API_KEY") else "❌ BỊ THIẾU")

app = FastAPI(title="Melon AI Backend", description="AI API for Melon Education App")

# CORS setup for Frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all origins for dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/v1")

# Serve generated media files used by frontend.
os.makedirs("generations/audio", exist_ok=True)
os.makedirs("uploads/images", exist_ok=True)
app.mount("/static/audio", StaticFiles(directory="generations/audio"), name="static-audio")
app.mount("/static/images", StaticFiles(directory="uploads/images"), name="static-images")

@app.get("/health")
def health_check():
    return {"status": "ok", "message": "Melon AI is running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)