import os
import pytest
from unittest.mock import patch, MagicMock
from services.llm_service import _llm_provider, _call_chat_completion

def test_llm_provider_default():
    """Unit Test: LLM Provider mặc định là openrouter nếu không cấu hình OPENAI_API_KEY"""
    with patch.dict(os.environ, clear=True):
        assert _llm_provider() == "openrouter"

def test_llm_provider_openai():
    """Unit Test: LLM Provider là openai nếu có OPENAI_API_KEY"""
    with patch.dict(os.environ, {"OPENAI_API_KEY": "sk-123"}, clear=True):
        assert _llm_provider() == "openai"

def test_call_chat_completion_success():
    """Integration Test: Gọi hàm sinh văn bản đồng bộ (đã mock API requests)"""
    mock_response = "Mocked LLM Response"
    
    with patch('services.llm_service.requests.post') as mock_post:
        # Giả lập response của requests
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "choices": [{"message": {"content": mock_response}}]
        }
        mock_post.return_value = mock_resp
        
        result = _call_chat_completion(messages=[{"role": "user", "content": "Hello"}])
        assert result == mock_response
        mock_post.assert_called_once()
