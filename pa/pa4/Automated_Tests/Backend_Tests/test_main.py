import sys
from unittest.mock import MagicMock
sys.modules['fitz'] = MagicMock()

import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_health_check():
    """
    Integration Test: Kiểm tra endpoint /health hoạt động đúng không.
    """
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "message": "Melon AI is running"}

def test_tts_endpoint_missing_text():
    """
    Integration Test: Gọi API TTS nhưng không truyền text (Expect lỗi 422 Unprocessable Entity).
    """
    response = client.post("/api/v1/tts", json={})
    assert response.status_code == 422
