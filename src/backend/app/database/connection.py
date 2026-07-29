import os
import asyncio
from urllib.parse import quote_plus
from dotenv import load_dotenv
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

load_dotenv()


def _build_database_url() -> str:
    """Ưu tiên DATABASE_URL (Supabase cho sẵn 1 chuỗi). Nếu không có thì ghép từ
    các biến DB_* / POSTGRES_*, có URL-encode user/password để không vỡ chuỗi khi
    mật khẩu chứa ký tự đặc biệt (@ : / # ...)."""
    raw = os.environ.get("DATABASE_URL")
    if raw:
        # Chuẩn hoá về driver async psycopg
        for prefix in ("postgresql+psycopg://", "postgresql://", "postgres://"):
            if raw.startswith(prefix):
                return "postgresql+psycopg://" + raw[len(prefix):]
        return raw

    user = os.environ.get("DB_USER") or os.environ.get("POSTGRES_USER") or ""
    password = os.environ.get("DB_PASSWORD") or os.environ.get("POSTGRES_PASSWORD") or ""
    host = os.environ.get("DB_HOST") or os.environ.get("POSTGRES_HOST", "localhost")
    port = os.environ.get("DB_PORT") or os.environ.get("POSTGRES_PORT", "5432")
    name = os.environ.get("DB_NAME") or os.environ.get("POSTGRES_DB") or ""
    return (
        f"postgresql+psycopg://{quote_plus(user)}:{quote_plus(password)}"
        f"@{host}:{port}/{name}"
    )


DATABASE_URL = _build_database_url()

# connect_args cho psycopg:
# - sslmode: Supabase yêu cầu SSL -> đặt DB_SSLMODE=require trong .env khi dùng Supabase.
# - prepare_threshold=None: tắt prepared statement -> an toàn khi đi qua pgBouncer pooler.
_connect_args: dict = {"prepare_threshold": None}
_sslmode = os.environ.get("DB_SSLMODE")
if _sslmode:
    _connect_args["sslmode"] = _sslmode

engine = create_async_engine(
    DATABASE_URL,
    echo=os.environ.get("SQL_ECHO", "false").lower() == "true",
    connect_args=_connect_args,
    pool_pre_ping=True,      # tự kiểm tra & thay connection chết (DB cloud hay đóng idle)
    pool_recycle=1800,       # tái tạo connection sau 30 phút
)
async_session_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

async def get_db_session():
    async with async_session_factory() as session:
        try:
            yield session
        finally:
            pass
        
async def test_connection():
    print("[*] Đang thử kết nối tới PostgreSQL Async...")
    try:
        # Lấy thử 1 session từ hàm generator
        async with async_session_factory() as session:
            # Chạy một câu lệnh SQL đơn giản để kiểm tra kết nối (Ping)
            result = await session.execute(text("SELECT 1"))
            print(f"[+] Kết nối thành công! Kết quả phản hồi từ DB: {result.scalar()}")
    except Exception as e:
        print(f"[-] Kết nối thất bại. Lỗi: {e}")

if __name__ == "__main__":
    import sys

    # Trên Windows, psycopg async cần SelectorEventLoop. Cách này chạy được trên
    # mọi phiên bản Python 3 (loop_factory chỉ có từ 3.12 nên không dùng ở đây).
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

    asyncio.run(test_connection())