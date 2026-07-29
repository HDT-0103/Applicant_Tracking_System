from abc import ABC, abstractmethod
from dotenv import load_dotenv
from groq import Groq
import os 

load_dotenv()

class LLMProvider(ABC):
    @abstractmethod
    def generate_text(self, prompt: str) -> str:
        pass
    
class GroqProvider(LLMProvider):
    def __init__(self):
        self.client = Groq(api_key=os.getenv("GROQ_API_KEY"))
        self.model = 'qwen/qwen3-32b'
        
    # Trong file GroqProvider của bạn
    def generate_text(self, prompt: str) -> str:
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "You are an ATS recruitment assistant. You must output valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1, # Đặt thấp để tăng độ chính xác của cấu trúc JSON
            response_format={"type": "json_object"} # <--- ÉP CHẮC CHẮN TRẢ VỀ JSON
        )
        return response.choices[0].message.content
    
    def _generate(self, prompt: str) -> str:
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {
                    "role": "system",
                    "content": "You are an ATS recruitment assistant."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.2
        )

        return response.choices[0].message.content