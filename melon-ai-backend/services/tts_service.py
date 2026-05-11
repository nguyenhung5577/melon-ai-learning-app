import os
from elevenlabs.client import ElevenLabs
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

def _get_client() -> ElevenLabs:
    api_key = os.getenv("ELEVENLABS_API_KEY")
    if not api_key:
        raise RuntimeError(
            "Missing ELEVENLABS_API_KEY. Add it to melon-ai-backend/.env "
            "or export it in the current shell environment."
        )
    return ElevenLabs(api_key=api_key)

def text_to_speech(text: str, filename: str = "output.mp3") -> str:
    """
    Converts text to speech using ElevenLabs API
    """
    client = _get_client()
    audio_generator = client.generate(
        text=text,
        model="eleven_multilingual_v2"
    )

    os.makedirs("generations/audio", exist_ok=True)
    filepath = f"generations/audio/{filename}"

    # generator returns bytes iteratively
    with open(filepath, "wb") as f:
        for chunk in audio_generator:
            f.write(chunk)

    return f"/static/audio/{filename}"