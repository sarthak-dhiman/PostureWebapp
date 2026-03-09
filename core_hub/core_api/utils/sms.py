from typing import Tuple


def send_sms(phone: str, message: str) -> Tuple[bool, str]:
    """Mock SMS sender for development.

    Returns (success, detail). In production, integrate with an SMS provider.
    """
    try:
        # For now we simply log to stdout. Containers will show the message.
        print(f"[SMS] To: {phone} Message: {message}")
        return True, "mocked"
    except Exception as e:
        return False, str(e)
