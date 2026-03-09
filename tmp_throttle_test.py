import requests
import time

url = "http://localhost:8000/api/v1/auth/token/"

def test_login_throttle():
    print("Testing login throttle (Limit: 5/min)...")
    for i in range(1, 8):
        response = requests.post(url, json={
            "email": f"test{i}@example.com",
            "password": "wrongpassword123",
            "cf-turnstile-response": "dummy-token-for-testing"
        })
        print(f"Attempt {i}: Status {response.status_code} - {response.text}")
        if response.status_code == 429:
            print("=> Successfully hit 429 Too Many Requests!")
            return True
        time.sleep(0.5)
    
    print("Failed to hit rate limit.")
    return False

if __name__ == "__main__":
    test_login_throttle()
