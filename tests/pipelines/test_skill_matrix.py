"""Đối chiếu kỹ năng ứng viên với yêu cầu tin tuyển dụng.

Đây là logic quyết định ai được nổi lên đầu danh sách và ai bị đánh dấu thiếu
kỹ năng, nên sai ở đây là loại oan người phù hợp. Phần dễ sai nhất là chuẩn hoá
tên kỹ năng: cùng một thứ nhưng CV và JD viết khác nhau.
"""
from __future__ import annotations

import pytest

from src.backend.app.pipelines.cv_processing_pipeline import CVProcessingPipeline

build = CVProcessingPipeline._build_skill_matrix
norm = CVProcessingPipeline._normalise_skill


class TestChuanHoaTenKyNang:
    @pytest.mark.parametrize(
        ("a", "b"),
        [
            ("Node.js", "NodeJS"),
            ("node js", "nodejs"),
            ("C++", "c++"),
            ("Next.JS", "nextjs"),
            ("  Python  ", "python"),
            ("PostgreSQL", "postgre sql"),
        ],
    )
    def test_cac_cach_viet_cua_cung_mot_ky_nang_deu_quy_ve_mot(self, a, b):
        assert norm(a) == norm(b)

    def test_ky_nang_khac_nhau_khong_bi_gop_nham(self):
        assert norm("Java") != norm("JavaScript")
        assert norm("React") != norm("ReactNative")


class TestDoiChieuKyNang:
    def test_khop_du_ky_nang_bat_buoc(self):
        m = build(["Python", "FastAPI", "Docker"], ["Python", "FastAPI"], [])
        assert m["must_have"]["matched"] == ["Python", "FastAPI"]
        assert m["must_have"]["missing"] == []
        assert m["must_have_coverage"] == 1.0

    def test_thieu_ky_nang_bat_buoc_duoc_liet_ke(self):
        m = build(["Python"], ["Python", "Kubernetes"], [])
        assert m["must_have"]["missing"] == ["Kubernetes"]
        assert m["must_have_coverage"] == 0.5

    def test_khop_bat_ke_cach_viet(self):
        """CV ghi 'Node.js', JD ghi 'NodeJS' — không được báo thiếu."""
        m = build(["Node.js"], ["NodeJS"], [])
        assert m["must_have"]["matched"] == ["NodeJS"]
        assert m["must_have"]["missing"] == []

    def test_giu_nguyen_cach_viet_cua_JD_khi_tra_ve(self):
        """Hiển thị theo từ ngữ của tin tuyển dụng, không theo CV."""
        m = build(["node.js"], ["Node.JS"], [])
        assert m["must_have"]["matched"] == ["Node.JS"]

    def test_nice_to_have_khong_lam_loang_do_phu(self):
        """Thiếu 1 kỹ năng bắt buộc nặng hơn thiếu 5 kỹ năng 'có thì tốt'."""
        m = build(["Python"], ["Python"], ["Go", "Rust", "Elixir", "Scala", "Haskell"])
        assert m["must_have_coverage"] == 1.0
        assert len(m["nice_to_have"]["missing"]) == 5

    def test_ky_nang_thua_duoc_tach_rieng(self):
        m = build(["Python", "Terraform"], ["Python"], [])
        assert m["extra_skills"] == ["Terraform"]

    def test_ky_nang_thua_khong_lap_lai_cai_da_khop(self):
        m = build(["Python", "Go"], ["Python"], ["Go"])
        assert m["extra_skills"] == []


class TestTruongHopBien:
    def test_JD_khong_yeu_cau_ky_nang_nao(self):
        """Không có yêu cầu thì độ phủ là None, KHÔNG phải 0.

        0 nghĩa là 'khớp 0%' và sẽ đẩy ứng viên xuống đáy danh sách một cách
        oan uổng; None nghĩa là 'không có gì để đo'.
        """
        m = build(["Python"], [], [])
        assert m["must_have_coverage"] is None

    def test_JD_truyen_None(self):
        m = build(["Python"], None, None)
        assert m["must_have_coverage"] is None
        assert m["must_have"]["matched"] == []

    def test_ung_vien_khong_co_ky_nang_nao(self):
        m = build([], ["Python"], [])
        assert m["must_have"]["missing"] == ["Python"]
        assert m["must_have_coverage"] == 0.0

    def test_bo_qua_chuoi_rong_trong_danh_sach_ky_nang(self):
        """LLM thỉnh thoảng trả về phần tử rỗng; không được coi đó là kỹ năng."""
        m = build(["Python", "", "  "], ["Python"], [])
        assert m["must_have"]["matched"] == ["Python"]
        assert "" not in m["extra_skills"]
