import pytest
from services.problem_parser_service import parse_problem_sources, ParserInputFile

@pytest.mark.asyncio
async def test_problem_parser_missing_input():
    """Unit Test: Hàm parse_problem_sources phải bắt lỗi nếu không có text hay file."""
    with pytest.raises(ValueError, match="Either text or files must be provided"):
        await parse_problem_sources(
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
