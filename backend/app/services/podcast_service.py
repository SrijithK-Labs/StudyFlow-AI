import os
import re
import edge_tts
from pydub import AudioSegment
import asyncio
import uuid

# Define voices with rate and pitch for better differentiation
VOICES = {
    "Guy": {
        "voice": "en-US-DavisNeural",
        "rate": "-5%",
        "pitch": "-2Hz"
    },
    "Ava": {
        "voice": "en-US-JennyNeural",
        "rate": "+5%",
        "pitch": "+2Hz"
    }
}

VOICE_FALLBACKS = {
    "Guy": ["en-US-DavisNeural", "en-US-AndrewNeural", "en-US-GuyNeural", "en-US-TonyNeural"],
    "Ava": ["en-US-JennyNeural", "en-US-AvaNeural", "en-US-MichelleNeural", "en-US-AriaNeural"]
}

# Use absolute path to ensure we can find it
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUTPUT_DIR = os.path.join(BASE_DIR, "static", "podcasts")

if not os.path.exists(OUTPUT_DIR):
    os.makedirs(OUTPUT_DIR, exist_ok=True)


def clean_text_for_tts(text: str) -> str:
    """
    Clean text for natural TTS pronunciation.
    Removes markdown, code blocks, URLs, and formats numbers/symbols.
    """
    if not text:
        return ""
    
    clean = text
    
    # Remove code blocks (```code```)
    clean = re.sub(r'```[\s\S]*?```', '', clean)
    
    # Remove inline code (`code`)
    clean = re.sub(r'`[^`]+`', '', clean)
    
    # Remove markdown links [text](url) -> text
    clean = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', clean)
    
    # Remove raw URLs
    clean = re.sub(r'https?://\S+', '', clean)
    
    # Remove markdown headers (# ## ###)
    clean = re.sub(r'^#{1,6}\s+', '', clean, flags=re.MULTILINE)
    
    # Remove bold/italic markers
    clean = re.sub(r'\*{1,3}([^*]+)\*{1,3}', r'\1', clean)
    clean = re.sub(r'_{1,3}([^_]+)_{1,3}', r'\1', clean)
    
    # Remove bullet points and list markers
    clean = re.sub(r'^\s*[-*•]\s+', '', clean, flags=re.MULTILINE)
    clean = re.sub(r'^\s*\d+\.\s+', '', clean, flags=re.MULTILINE)
    
    # Remove blockquotes
    clean = re.sub(r'^>\s+', '', clean, flags=re.MULTILINE)
    
    # Remove horizontal rules
    clean = re.sub(r'^[-*_]{3,}\s*$', '', clean, flags=re.MULTILINE)
    
    # Remove HTML tags
    clean = re.sub(r'<[^>]+>', '', clean)
    
    # Remove emojis (keep text)
    clean = re.sub(r'[^\x00-\x7F]+', '', clean)
    
    # Remove thinking/reasoning blocks
    clean = re.sub(r'<think>[\s\S]*?</think>', '', clean)
    clean = re.sub(r'\[Self-Reflection:.*?\]', '', clean)
    clean = re.sub(r'🔄 Self-Reflection:[\s\S]*?(?=🔧|\Z)', '', clean)
    clean = re.sub(r'🧠 Why this response:[\s\S]*?(?=🔄|\Z)', '', clean)
    
    # Remove study metadata
    clean = re.sub(r'🎯 Intent:.*', '', clean)
    clean = re.sub(r'💭 Emotion:.*', '', clean)
    clean = re.sub(r'📐 Style:.*', '', clean)
    clean = re.sub(r'🤖 Agent:.*', '', clean)
    clean = re.sub(r'🛠 Content:.*', '', clean)
    clean = re.sub(r'📝 Model.*?:.*', '', clean)
    
    # Format common symbols for better pronunciation
    clean = clean.replace('&', ' and ')
    clean = clean.replace('@', ' at ')
    clean = clean.replace('#', ' number ')
    clean = clean.replace('%', ' percent ')
    clean = clean.replace('$', ' dollars ')
    clean = clean.replace('€', ' euros ')
    clean = clean.replace('£', ' pounds ')
    
    # Format arrows
    clean = clean.replace('→', ' leads to ')
    clean = clean.replace('←', ' comes from ')
    clean = clean.replace('=>', ' means ')
    clean = clean.replace('->', ' to ')
    clean = clean.replace('<-', ' from ')
    
    # Format code-related symbols
    clean = clean.replace('[]', ' empty list ')
    clean = clean.replace('{}', ' empty dict ')
    clean = clean.replace('()', ' parentheses ')
    
    # Remove consecutive duplicate words (stutters like "before before")
    clean = re.sub(r'\b(\w+)\s+\1\b', r'\1', clean)
    
    # Clean up whitespace
    clean = re.sub(r'\n{3,}', '\n\n', clean)
    clean = re.sub(r' {2,}', ' ', clean)
    clean = clean.strip()
    
    return clean


def clean_for_script_generation(text: str) -> str:
    """
    Clean AI message content for podcast script generation.
    Less aggressive than TTS cleaning - keep structure but remove noise.
    """
    if not text:
        return ""
    
    # Remove markdown code blocks but keep what's inside
    clean = re.sub(r'```[\s\S]*?```', lambda m: m.group(0).split('\n', 1)[-1].rsplit('\n', 1)[0] if '\n' in m.group(0) else '', text)
    
    # Remove inline code backticks
    clean = re.sub(r'`([^`]+)`', r'\1', clean)
    
    # Remove markdown links but keep text
    clean = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', clean)
    
    # Remove raw URLs
    clean = re.sub(r'https?://\S+', '', clean)
    
    # Remove HTML tags
    clean = re.sub(r'<[^>]+>', '', clean)
    
    # Remove emojis (keep text)
    clean = re.sub(r'[^\x00-\x7F]+', '', clean)
    
    # Remove thinking/reasoning blocks
    clean = re.sub(r'<think>[\s\S]*?</think>', '', clean)
    clean = re.sub(r'\[Self-Reflection:.*?\]', '', clean)
    clean = re.sub(r'🔄 Self-Reflection:[\s\S]*?(?=🔧|\Z)', '', clean)
    clean = re.sub(r'🧠 Why this response:[\s\S]*?(?=🔄|\Z)', '', clean)
    
    # Remove study metadata
    clean = re.sub(r'🎯 Intent:.*', '', clean)
    clean = re.sub(r'💭 Emotion:.*', '', clean)
    clean = re.sub(r'📐 Style:.*', '', clean)
    clean = re.sub(r'🤖 Agent:.*', '', clean)
    clean = re.sub(r'🛠 Content:.*', '', clean)
    clean = re.sub(r'📝 Model.*?:.*', '', clean)
    
    # Remove source citations like [1], [2], etc.
    clean = re.sub(r'\[\d+\]', '', clean)
    
    # Remove "Source:" or "Sources:" sections
    clean = re.sub(r'(?i)sources?:[\s\S]*$', '', clean)
    
    # Remove "SOURCES" section
    clean = re.sub(r'(?i)^##?\s*SOURCES[\s\S]*$', '', clean, flags=re.MULTILINE)
    
    # Remove thinking section headers but keep content below
    clean = re.sub(r'(?i)^##?\s*(?:View Thinking|Hide Thinking)\s*$', '', clean, flags=re.MULTILINE)
    
    # Clean up excessive whitespace but keep paragraph breaks
    clean = re.sub(r'\n{4,}', '\n\n\n', clean)
    clean = re.sub(r' {3,}', ' ', clean)
    clean = clean.strip()
    
    return clean


async def synthesize_podcast(script):
    """
    Synthesize audio for each line in the script and combine them.
    script: List of {"speaker": "Guy"|"Ava", "text": "..."}
    """
    podcast_id = str(uuid.uuid4())
    temp_files = []
    
    try:
        # 1. Synthesize individual lines
        for idx, line in enumerate(script):
            speaker = line.get("speaker", "Guy")
            text = line.get("text", "")
            
            # Clean text for TTS
            text = clean_text_for_tts(text)
            
            # Skip empty lines
            if not text or len(text.strip()) < 3:
                continue
            
            voice_fallbacks = VOICE_FALLBACKS.get(speaker, VOICE_FALLBACKS["Guy"])
            voice_config = VOICES.get(speaker, VOICES["Guy"])
            voice_rate = voice_config.get("rate", "+0%") if isinstance(voice_config, dict) else "+0%"
            voice_pitch = voice_config.get("pitch", "+0Hz") if isinstance(voice_config, dict) else "+0Hz"
            
            temp_filename = f"{podcast_id}_{idx}.mp3"
            temp_path = os.path.join(OUTPUT_DIR, temp_filename)
            
            synthesized = False
            for fb_voice in voice_fallbacks:
                try:
                    communicate = edge_tts.Communicate(text, fb_voice, rate=voice_rate, pitch=voice_pitch)
                    await communicate.save(temp_path)
                    synthesized = True
                    break
                except Exception:
                    continue
            
            if synthesized:
                temp_files.append(temp_path)
        # 2. Combine using pydub
        if not temp_files:
            return None
        
        combined = AudioSegment.empty()
        
        # Add intro silence
        combined += AudioSegment.silent(duration=1500)
        
        prev_speaker = None
        for i, f in enumerate(temp_files):
            if not os.path.exists(f):
                continue
            segment = AudioSegment.from_mp3(f)
            combined += segment
            
            # Pause between segments
            if i < len(temp_files) - 1:
                curr_speaker = script[i].get("speaker", "") if i < len(script) else ""
                if curr_speaker != prev_speaker:
                    # Speaker change - natural conversation pause
                    combined += AudioSegment.silent(duration=2500)
                else:
                    # Same speaker - brief pause
                    combined += AudioSegment.silent(duration=1200)
                prev_speaker = curr_speaker
        
        # Add outro silence
        combined += AudioSegment.silent(duration=2000)
            
        final_filename = f"{podcast_id}.mp3"
        final_path = os.path.join(OUTPUT_DIR, final_filename)
        combined.export(final_path, format="mp3")
        
        # 3. Cleanup temp files
        for f in temp_files:
            if os.path.exists(f):
                os.remove(f)
                
        return final_filename
    except Exception:
        # Cleanup
        for f in temp_files:
            if os.path.exists(f):
                os.remove(f)
        return None


async def generate_single_voice_response(text: str, voice_name: str = "Ava") -> str:
    """
    Generate a quick TTS response for a single message using edge-tts.
    Returns the URL/filename of the generated audio.
    """
    voice_config = VOICES.get(voice_name, VOICES["Ava"])
    voice = voice_config["voice"] if isinstance(voice_config, dict) else voice_config
    rate = voice_config.get("rate", "+0%") if isinstance(voice_config, dict) else "+0%"
    pitch = voice_config.get("pitch", "+0Hz") if isinstance(voice_config, dict) else "+0Hz"
    
    msg_id = str(uuid.uuid4())
    filename = f"voice_reply_{msg_id}.mp3"
    filepath = os.path.join(OUTPUT_DIR, filename)
    
    try:
        # Clean text for TTS
        clean_text = clean_text_for_tts(text)
        
        # Skip if too short
        if len(clean_text.strip()) < 3:
            return ""
        
        communicate = edge_tts.Communicate(clean_text, voice, rate=rate, pitch=pitch)
        await communicate.save(filepath)
        return f"/static/podcasts/{filename}"
    except Exception:
        return ""
