import asyncio
from httpx import AsyncClient
from datetime import datetime, timezone, timedelta

async def test():
    async with AsyncClient() as client:
        res = await client.post('http://localhost:8000/api/scheduling/slots', json={
            "interviewer_ids": ["f82bb54f-1234-5678-90ab-cdef12345678"],
            "date_from": datetime.now(timezone.utc).isoformat(),
            "date_to": (datetime.now(timezone.utc) + timedelta(days=2)).isoformat(),
            "duration_minutes": 45
        })
        try:
            print("Status:", res.status_code)
            data = res.json()
            if isinstance(data, list):
                print(len(data))
            else:
                print(data)
        except Exception as e:
            print("Error parsing json:", e)

asyncio.run(test())
