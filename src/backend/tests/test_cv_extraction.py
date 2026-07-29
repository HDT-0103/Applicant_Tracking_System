"""
The public form no longer asks for name/email/phone — they come off the CV.
These tests pin that the extraction actually reaches the candidate record, and
that a failing LLM never costs the applicant their submission.
"""

import pytest

from modules.ingestion.application import ingestion_service
from modules.ingestion.application.ingestion_service import _clean, process_cv_resume


@pytest.fixture
def settings():
    class _Settings:
        gemini_api_key = "test-key"

    return _Settings()


@pytest.fixture(autouse=True)
def stub_pdf(monkeypatch):
    """Every test feeds the same CV text; no PDF is ever read."""
    monkeypatch.setattr(
        ingestion_service,
        "extract_text_and_links_from_pdf",
        lambda _path: ("Jane Doe — jane@example.com", []),
    )
    monkeypatch.setattr(ingestion_service, "save_candidate", lambda c: c)


def _stub_gemini(monkeypatch, result):
    async def _fake(_text, _settings):
        return result

    monkeypatch.setattr(ingestion_service, "parse_cv_with_gemini", _fake)


class TestClean:
    @pytest.mark.parametrize("raw", [None, "", "   ", "null", "NULL", "None", "n/a", 42, {}])
    def test_absent_values_become_none(self, raw):
        assert _clean(raw) is None

    def test_trims_surrounding_whitespace(self):
        assert _clean("  Jane Doe  ") == "Jane Doe"


@pytest.mark.asyncio
class TestProcessCvResume:
    async def test_extracts_contact_details_from_the_cv(self, monkeypatch, settings):
        _stub_gemini(monkeypatch, {
            "full_name": "Jane Doe",
            "email": "jane@example.com",
            "phone": "0900000000",
            "github_username": "janedoe",
            "linkedin_url": "https://linkedin.com/in/janedoe",
        })

        candidate = await process_cv_resume("uuid-1", "/tmp/cv.pdf", settings)

        assert candidate.full_name == "Jane Doe"
        assert candidate.email == "jane@example.com"
        assert candidate.phone == "0900000000"
        assert candidate.github_username == "janedoe"
        assert candidate.linkedin_url == "https://linkedin.com/in/janedoe"

    async def test_caller_supplied_values_win_over_the_llm(self, monkeypatch, settings):
        _stub_gemini(monkeypatch, {"full_name": "Wrong Name", "email": "wrong@example.com"})

        candidate = await process_cv_resume(
            "uuid-2", "/tmp/cv.pdf", settings,
            full_name="Real Name", email="real@example.com", phone="0911111111",
        )

        assert candidate.full_name == "Real Name"
        assert candidate.email == "real@example.com"

    async def test_llm_only_fills_the_gaps(self, monkeypatch, settings):
        _stub_gemini(monkeypatch, {"full_name": "From CV", "email": "cv@example.com"})

        candidate = await process_cv_resume("uuid-3", "/tmp/cv.pdf", settings, full_name="From Form")

        assert candidate.full_name == "From Form"
        assert candidate.email == "cv@example.com"

    async def test_null_like_answers_do_not_become_strings(self, monkeypatch, settings):
        _stub_gemini(monkeypatch, {"full_name": "Jane", "email": "null", "phone": ""})

        candidate = await process_cv_resume("uuid-4", "/tmp/cv.pdf", settings)

        assert candidate.email is None
        assert candidate.phone is None

    async def test_llm_failure_still_produces_a_candidate(self, monkeypatch, settings):
        _stub_gemini(monkeypatch, None)  # quota exhausted, bad JSON, network error…

        candidate = await process_cv_resume("uuid-5", "/tmp/cv.pdf", settings)

        assert candidate.uuid == "uuid-5"
        assert candidate.full_name is None

    async def test_job_id_reaches_the_candidate_record(self, monkeypatch, settings):
        """Without this the CV loses the job it was submitted for."""
        _stub_gemini(monkeypatch, {})

        candidate = await process_cv_resume("uuid-6", "/tmp/cv.pdf", settings, job_id="job-42")

        assert candidate.job_id == "job-42"

    async def test_llm_is_skipped_when_the_form_gave_everything(self, monkeypatch, settings):
        called = False

        async def _fake(_text, _settings):
            nonlocal called
            called = True
            return {}

        monkeypatch.setattr(ingestion_service, "parse_cv_with_gemini", _fake)

        await process_cv_resume(
            "uuid-7", "/tmp/cv.pdf", settings,
            full_name="A", email="a@example.com", phone="09",
        )

        assert called is False, "no reason to spend Gemini quota when nothing is missing"

    async def test_links_parsed_from_the_pdf_are_used(self, monkeypatch, settings):
        monkeypatch.setattr(
            ingestion_service,
            "extract_text_and_links_from_pdf",
            lambda _p: ("cv text", ["https://github.com/octocat", "https://linkedin.com/in/octo"]),
        )
        _stub_gemini(monkeypatch, {})

        candidate = await process_cv_resume("uuid-8", "/tmp/cv.pdf", settings)

        assert candidate.github_username == "octocat"
        assert candidate.linkedin_url == "https://linkedin.com/in/octo"
        assert candidate.status == "PARSED"
