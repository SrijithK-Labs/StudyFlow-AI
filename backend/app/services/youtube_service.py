import re
from youtube_transcript_api import YouTubeTranscriptApi
from typing import Optional, Dict

class YouTubeService:
    @staticmethod
    def extract_video_id(url: str) -> Optional[str]:
        """Extracts the video ID from a YouTube URL."""
        patterns = [
            r'(?:v=|\/)([0-9A-Za-z_-]{11}).*',
            r'youtu\.be\/([0-9A-Za-z_-]{11})',
            r'embed\/([0-9A-Za-z_-]{11})',
            r'shorts\/([0-9A-Za-z_-]{11})',
            r'watch\?v=([0-9A-Za-z_-]{11})'
        ]
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)
        return None

    @staticmethod
    async def get_transcript(video_id: str) -> Optional[str]:
        """Fetches the transcript for a given YouTube video ID."""
        try:
            # In version 1.2.3, YouTubeTranscriptApi uses instance methods
            api = YouTubeTranscriptApi()
            
            # Try to fetch english first
            try:
                data = api.fetch(video_id, languages=['en', 'en-US'])
            except:
                # Fallback to any available if english fails
                # In this version, list(video_id) returns a TranscriptList
                transcript_list = api.list(video_id)
                # find_transcript with empty list or generic code might work, 
                # but better to just pick the first available
                transcript = next(iter(transcript_list))
                data = transcript.fetch()
            
            full_text = " ".join([t.text for t in data])
            return full_text
        except Exception:
            return None

    @staticmethod
    async def get_video_metadata(video_id: str) -> Dict[str, str]:
        """Fetches basic metadata for a YouTube video. 
        Note: To get the title properly without heavy dependencies like pytube, 
        we might just return the URL for now or use a basic oembed check."""
        return {
            "title": f"YouTube Video ({video_id})",
            "url": f"https://www.youtube.com/watch?v={video_id}",
            "id": video_id
        }
