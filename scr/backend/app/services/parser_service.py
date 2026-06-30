import fitz
import re


class ParserService:

    def parse(self, file_path: str) -> str:
        with fitz.open(file_path) as doc:

            if doc.is_encrypted:
                raise ValueError("PDF is encrypted.")

            text = []

            for page in doc:
                text.append(page.get_text("text"))

        return "\n".join(text)

    def cleanup(self, text: str) -> str:

        text = text.replace("•", "-")
        text = text.replace("●", "-")
        text = text.replace("■", "-")

        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"\n+", "\n", text)

        lines = []

        for line in text.split("\n"):
            line = line.strip()

            if line:
                lines.append(line)

        return "\n".join(lines)

    def process(self, file_path: str) -> str:
        raw_text = self.parse(file_path)
        cleaned_text = self.cleanup(raw_text)

        return cleaned_text