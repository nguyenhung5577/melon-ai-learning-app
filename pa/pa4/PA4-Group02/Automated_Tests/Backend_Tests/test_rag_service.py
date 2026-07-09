import pytest
import services.rag_service

def test_rag_service_module_exists():
    """Unit Test: Đảm bảo module RAG Service tồn tại và load thành công."""
    assert services.rag_service is not None
