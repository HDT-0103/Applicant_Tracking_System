"""
Embedding providers for the scoring pipeline.

Convention shared with the candidate-side scoring work:
  * Model: intfloat/multilingual-e5-base (768 dims).
  * E5 requires an instruction prefix on every text — job descriptions are
    embedded as "query:", resumes/candidate profiles as "passage:". Cosine
    similarity is only meaningful between a query vector and a passage vector
    produced by the same model.

Swapping to a hosted embedding API later = add another EmbeddingProvider
implementation and point EMBEDDING_PROVIDER at it; callers only see the
interface, and every stored row carries model_name for re-embedding.
"""

from __future__ import annotations

import asyncio
import threading
from abc import ABC, abstractmethod
from typing import List, Literal

import structlog

from modules.shared.infrastructure.config import Settings

logger = structlog.get_logger(__name__)

EmbedKind = Literal["query", "passage"]


class EmbeddingProvider(ABC):
    @property
    @abstractmethod
    def model_name(self) -> str: ...

    @property
    @abstractmethod
    def dim(self) -> int: ...

    @abstractmethod
    async def embed(self, texts: List[str], kind: EmbedKind) -> List[List[float]]:
        """Embed texts with the E5 prefix for `kind` applied."""


class LocalE5Provider(EmbeddingProvider):
    """intfloat/multilingual-e5-base via sentence-transformers, CPU."""

    _MODEL_NAME = "intfloat/multilingual-e5-base"
    _DIM = 768

    # Model tải ~1.1GB lần đầu và chiếm RAM đáng kể — giữ một instance duy nhất
    # cho cả process, load lười để không chặn app startup.
    _model = None
    _model_lock = threading.Lock()

    @property
    def model_name(self) -> str:
        return self._MODEL_NAME

    @property
    def dim(self) -> int:
        return self._DIM

    @classmethod
    def _get_model(cls):
        if cls._model is None:
            with cls._model_lock:
                if cls._model is None:
                    from sentence_transformers import SentenceTransformer

                    logger.info("embedding.model_loading", model=cls._MODEL_NAME)
                    cls._model = SentenceTransformer(cls._MODEL_NAME)
                    logger.info("embedding.model_loaded", model=cls._MODEL_NAME)
        return cls._model

    async def embed(self, texts: List[str], kind: EmbedKind) -> List[List[float]]:
        if not texts:
            return []
        prefixed = [f"{kind}: {text}" for text in texts]

        def _encode() -> List[List[float]]:
            model = self._get_model()
            vectors = model.encode(prefixed, normalize_embeddings=True)
            return [vector.tolist() for vector in vectors]

        # encode chạy trên CPU cỡ 0.1–1s/text — đẩy ra thread để không chặn event loop.
        return await asyncio.to_thread(_encode)


def get_embedding_provider(settings: Settings) -> EmbeddingProvider:
    provider_name = getattr(settings, "embedding_provider", "local-e5")
    if provider_name == "local-e5":
        return LocalE5Provider()
    raise ValueError(f"Unknown EMBEDDING_PROVIDER: {provider_name!r}")
