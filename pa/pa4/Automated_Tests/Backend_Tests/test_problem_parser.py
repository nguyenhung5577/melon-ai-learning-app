import sys
from unittest.mock import MagicMock
sys.modules['fitz'] = MagicMock()

import pytest
from services.problem_parser_service import parse_problem_sources, ParserInputFile

def test_problem_parser_missing_input():
    """Unit Test: Hàm parse_problem_sources phải bắt lỗi nếu không có text hay file."""
    with pytest.raises(ValueError, match="No text, PDF, or image content provided"):
        parse_problem_sources(
            grade=5,
            subject="math",
            language="vi",
            text="",
            files=[]
        )

def test_parser_input_file_dataclass():
    """Unit Test: Kiểm tra cấu trúc ParserInputFile Dataclass."""
    f = ParserInputFile("test.pdf", "application/pdf", b"123")
    assert f.filename == "test.pdf"
    assert f.data == b"123"

def test_problem_parser_success_mock():
    """Integration Test: Mock _parse_json_object để trả về JSON giả lập"""
    from unittest.mock import patch, MagicMock
    
    mock_result = {
        "questions": [
            {"id": "q1", "stem": "1+1=?", "type": "multiple_choice", "answer": "B", "choices": [{"key": "A", "text": "1"}, {"key": "B", "text": "2"}]}
        ]
    }
    
    with patch('services.problem_parser_service._parse_json_object') as mock_parse:
        mock_parse.return_value = mock_result
        
        # Cần mock thêm llm request
        with patch('services.problem_parser_service._call_openrouter') as mock_llm:
            mock_llm.return_value = "{}"
            
            result = parse_problem_sources(
                grade=5,
                subject="math",
                language="vi",
                text="Solve 1+1=?",
                files=[]
            )
            
            assert "questions" in result
            mock_parse.assert_called_once()
