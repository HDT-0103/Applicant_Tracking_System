import hashlib
import secrets

class PasswordService:
    @staticmethod
    def hash_password(password: str) -> str:
        # Generate a random salt
        salt = secrets.token_hex(16)
        # Hash the password with the salt using pbkdf2_hmac
        key = hashlib.pbkdf2_hmac(
            'sha256',
            password.encode('utf-8'),
            salt.encode('utf-8'),
            100000
        )
        return f"{salt}${key.hex()}"

    @staticmethod
    def verify_password(password: str, hashed_password: str) -> bool:
        try:
            salt, key_hex = hashed_password.split('$')
            key = hashlib.pbkdf2_hmac(
                'sha256',
                password.encode('utf-8'),
                salt.encode('utf-8'),
                100000
            )
            return key.hex() == key_hex
        except Exception:
            return False
