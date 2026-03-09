import asyncio
import websockets
import os

async def test_stream():
    node_id = "812f23bf-83af-4454-802d-0e0600a06806"
    # Inside docker, localhost:8000 might not work if Daphne binds to 0.0.0.0, 
    # but usually it does. Let's try 127.0.0.1.
    uri = f"ws://127.0.0.1:8000/ws/api/v1/cctv/stream/{node_id}/"
    print(f"Connecting to {uri}")
    try:
        async with websockets.connect(uri) as websocket:
            print("Connected!")
            # Send a dummy binary frame (tiny JPEG header)
            await websocket.send(b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00\xff\xdb\x00C\x00")
            print("Sent dummy frame")
            await asyncio.sleep(1)
    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_stream())
