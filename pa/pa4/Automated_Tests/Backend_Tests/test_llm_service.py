import os
import pytest
from unittest.mock import patch
from services.llm_service import _llm_provider

def test_llm_provider_default():
    """Unit Test: LLM Provider mặc định là openrouter nếu không cấu hình OPENAI_API_KEY"""
    with patch.dict(os.environ, clear=True):
        assert _llm_provider() == "openrouter"

def test_llm_provider_openai():
    """Unit Test: LLM Provider là openai nếu có OPENAI_API_KEY"""
    with patch.dict(os.environ, {"OPENAI_API_KEY": "sk-123"}, clear=True):
        assert _llm_provider() == "openai"
