import random
import uuid
import base64
from django.core.cache import cache

def generate_math_captcha():
    """Generates a math CAPTCHA, stores solution in cache, and returns an SVG."""
    ops = [('+', lambda x, y: x + y), ('-', lambda x, y: x - y)]
    op_str, op_func = random.choice(ops)
    
    num1 = random.randint(1, 15)
    num2 = random.randint(1, 15)
    
    # Ensure num1 is always greater to avoid negative answers
    if op_str == '-' and num2 > num1:
        num1, num2 = num2, num1

    answer = str(op_func(num1, num2))
    question = f"What is {num1} {op_str} {num2}?"

    # Some basic visual noise and slight random rotation
    angle = random.randint(-5, 5)
    
    svg = f'''<svg width="200" height="50" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f8fafc" rx="6" stroke="#e2e8f0" />
        <line x1="10%" y1="{random.randint(10, 40)}" x2="90%" y2="{random.randint(10, 40)}" stroke="#cbd5e1" stroke-width="2" />
        <line x1="5%" y1="{random.randint(10, 40)}" x2="95%" y2="{random.randint(10, 40)}" stroke="#cbd5e1" stroke-width="2" />
        <line x1="{random.randint(20, 180)}" y1="5" x2="{random.randint(20, 180)}" y2="45" stroke="#cbd5e1" stroke-width="2" />
        <text x="50%" y="50%" font-family="monospace" font-size="22" font-weight="bold" fill="#334155" text-anchor="middle" dominant-baseline="middle" transform="rotate({angle}, 100, 25)">
            {question}
        </text>
    </svg>'''
    
    captcha_id = str(uuid.uuid4())
    # Cache solution for 5 minutes (300 seconds)
    cache.set(f"captcha_{captcha_id}", answer, timeout=300)
    
    svg_base64 = base64.b64encode(svg.encode('utf-8')).decode('utf-8')
    image_uri = f"data:image/svg+xml;base64,{svg_base64}"
    
    return captcha_id, image_uri

def verify_math_captcha(captcha_id, solution):
    """Verifies the CAPTCHA solution against the cached answer. Deletes the cache key after check."""
    if not captcha_id or not solution:
        return False
        
    key = f"captcha_{captcha_id}"
    stored_answer = cache.get(key)
    
    if stored_answer is None:
        return False
        
    # Prevent replay attacks by deleting the key immediately
    cache.delete(key)
    
    return str(stored_answer).strip() == str(solution).strip()
