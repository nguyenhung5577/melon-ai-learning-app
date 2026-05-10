import os
from elevenlabs.client import ElevenLabs
from dotenv import load_dotenv

load_dotenv()

client = ElevenLabs(
    api_key=os.getenv("ELEVENLABS_API_KEY"),
)

def text_to_speech(text: str, filename: str = "output.mp3") -> str:
    """
    Converts text to speech using ElevenLabs API
    """
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

text_to_speech("Hello, this is a test of the ElevenLabs text-to-speech API!", "test_output.mp3")