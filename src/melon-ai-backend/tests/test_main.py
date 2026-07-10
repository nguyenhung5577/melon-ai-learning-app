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
    print(f"\n[DEBUG] GET /health - Status Code: {response.status_code}")
    print(f"[DEBUG] Response JSON: {response.json()}")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "message": "Melon AI is running"}

def test_tts_endpoint_missing_text():
    """
    Integration Test: Gọi API TTS nhưng không truyền text (Expect lỗi 422 Unprocessable Entity).
    """
    response = client.post("/api/v1/tts", json={})
    print(f"\n[DEBUG] POST /api/v1/tts (empty body) - Status Code: {response.status_code}")
    print(f"[DEBUG] Response Error JSON: {response.json()}")
    assert response.status_code == 422
