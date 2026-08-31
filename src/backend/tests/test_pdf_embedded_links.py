"""Link ẩn trong annotation của PDF.

Rất nhiều CV chỉ để chữ "GitHub" gắn hyperlink, không viết URL ra dạng chữ.
Nếu tầng này im lặng trả về rỗng khi gặp trục trặc, pipeline sẽ kết luận ứng
viên không có GitHub — rồi chấm điểm họ trên kết luận đó. Đó là lý do những
test này quan tâm tới việc CÓ GHI LOG hay không, chứ không chỉ giá trị trả về.
"""
from __future__ import annotations

from unittest.mock import MagicMock, patch

from modules.ingestion.application.ingestion_service import _extract_embedded_links


def _link_annot(uri: str) -> MagicMock:
    annot = {"/Subtype": "/Link", "/A": {"/URI": uri}}
    ref = MagicMock()
    ref.get_object.return_value = annot
    return ref


def _broken_annot() -> MagicMock:
    ref = MagicMock()
    ref.get_object.side_effect = ValueError("corrupt object reference")
    return ref


def _page(annots) -> MagicMock:
    page = MagicMock()
    page.get.return_value = annots
    return page


def test_link_annotations_are_extracted():
    page = _page([_link_annot("https://github.com/octocat")])
    assert _extract_embedded_links(page) == ["https://github.com/octocat"]


def test_a_page_with_no_annotations_is_not_an_error():
    assert _extract_embedded_links(_page(None)) == []


def test_non_link_annotations_are_skipped_silently():
    # Chú thích, ô chữ ký… không phải hyperlink. Bỏ qua là đúng, và không có
    # gì để cảnh báo.
    ref = MagicMock()
    ref.get_object.return_value = {"/Subtype": "/Widget"}
    with patch("modules.ingestion.application.ingestion_service.logger") as log:
        assert _extract_embedded_links(_page([ref])) == []
    log.warning.assert_not_called()


def test_a_corrupt_annotation_is_logged_not_swallowed():
    page = _page([_link_annot("https://github.com/octocat"), _broken_annot()])

    with patch("modules.ingestion.application.ingestion_service.logger") as log:
        urls = _extract_embedded_links(page, page_number=3)

    # Link đọc được vẫn phải qua: một annotation hỏng không làm mất cả trang.
    assert urls == ["https://github.com/octocat"]
    # Nhưng phải để lại dấu vết, nếu không thì "CV không có link" và "đọc link
    # không được" trông giống hệt nhau.
    log.warning.assert_called_once()
    event, kwargs = log.warning.call_args[0][0], log.warning.call_args[1]
    assert event == "ingestion.pdf.annotations_skipped"
    assert kwargs == {"page": 3, "skipped": 1}


def test_an_unreadable_annots_entry_is_logged():
    page = MagicMock()
    page.get.side_effect = ValueError("bad /Annots")

    with patch("modules.ingestion.application.ingestion_service.logger") as log:
        assert _extract_embedded_links(page, page_number=1) == []

    log.warning.assert_called_once()
    assert log.warning.call_args[0][0] == "ingestion.pdf.annots_unreadable"
