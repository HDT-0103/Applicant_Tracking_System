import os
import asyncio
from dotenv import load_dotenv
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

load_dotenv()

DB_USER = os.environ.get('DB_USER')
DB_PASSWORD = os.environ.get('DB_PASSWORD')
DB_HOST = os.environ.get('DB_HOST')
DB_PORT = os.environ.get('DB_PORT')
DB_NAME = os.environ.get('DB_NAME')

DATABASE_URL=f'postgresql+psycopg://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}'

engine = create_async_engine(DATABASE_URL, echo=True)
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
    # Chạy hàm test async trong môi trường venv
    import selectors
    
    # Ép asyncio sử dụng SelectorEventLoop trên Windows để tương thích với psycopg
    asyncio.run(
        test_connection(), 
        loop_factory=lambda: asyncio.SelectorEventLoop(selectors.SelectSelector())
    )