import os
import uuid
import tempfile
import httpx
from dotenv import load_dotenv

load_dotenv()

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")

async def transcribe_audio_file(file_bytes: bytes, original_filename: str) -> str:
    if not OPENAI_API_KEY:
        return _fallback_google_stt(file_bytes, original_filename)

    try:
        ext = os.path.splitext(original_filename)[1] or ".wav"
        temp_path = os.path.join(tempfile.gettempdir(), f"stt_{uuid.uuid4().hex}{ext}")

        with open(temp_path, "wb") as f:
            f.write(file_bytes)

        async with httpx.AsyncClient(timeout=30) as client:
            with open(temp_path, "rb") as audio_file:
                response = await client.post(
                    "https://api.openai.com/v1/audio/transcriptions",
                    headers={"Authorization": f"Bearer {OPENAI_API_KEY}"},
                    files={"file": (original_filename, audio_file, "audio/wav")},
                    data={"model": "whisper-1"},
                )

            if response.status_code != 200:
                return ""

            data = response.json()
            return data.get("text", "")

    except Exception:
        return ""
    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except OSError:
                pass


def _fallback_google_stt(file_bytes: bytes, original_filename: str) -> str:
    raw_path = None
    wav_path = None
    try:
        import speech_recognition as sr
        from pydub import AudioSegment

        ext = ".webm" if "webm" in original_filename.lower() else ".ogg"
        raw_path = os.path.join(tempfile.gettempdir(), f"raw_{uuid.uuid4().hex}{ext}")
        wav_path = os.path.join(tempfile.gettempdir(), f"wav_{uuid.uuid4().hex}.wav")

        with open(raw_path, "wb") as f:
            f.write(file_bytes)

        audio = AudioSegment.from_file(raw_path)
        audio.export(wav_path, format="wav")

        recognizer = sr.Recognizer()
        with sr.AudioFile(wav_path) as source:
            audio_data = recognizer.record(source)
            text = recognizer.recognize_google(audio_data)

        return text

    except Exception:
        return ""
    finally:
        for path in [raw_path, wav_path]:
            if path and os.path.exists(path):
                try:
                    os.remove(path)
                except OSError:
                    pass
