import os
import pytest
from unittest.mock import patch
from services.tts_service import _get_client

def test_get_client_missing_api_key():
    """
    Unit Test (Modular): Kiểm tra _get_client throws RuntimeError nếu thiếu ELEVENLABS_API_KEY.
    """
    with patch.dict(os.environ, clear=True):
        if "ELEVENLABS_API_KEY" in os.environ:
            del os.environ["ELEVENLABS_API_KEY"]
            
        with pytest.raises(RuntimeError) as exc_info:
            _get_client()
        
        assert "Missing ELEVENLABS_API_KEY" in str(exc_info.value)
