import cv2
import websockets
import asyncio
import json
import base64
import sys

async def diagnose_stream(node_id, camera_uid="legacy_master"):
    # Change this to your server's IP if not running on the same machine
    base_url = "localhost:8000"
    uri = f"ws://{base_url}/ws/api/v1/cctv/stream/{node_id}/"
    
    print(f"--- CCTV AGENT DIAGNOSTICS ---")
    print(f"TARGET NODE: {node_id}")
    print(f"CAMERA UID: {camera_uid}")
    print(f"URI: {uri}")
    print(f"-------------------------------")

    try:
        async with websockets.connect(uri) as websocket:
            print("CONNECTIVITY: [OK] Connected to Cloud Relay ✅")
            
            # Start a webcam test
            cap = cv2.VideoCapture(0)
            if not cap.isOpened():
                print("HARDWARE: [FAIL] Could not open camera. Check permissions! ❌")
                return

            print("HARDWARE: [OK] Camera accessed successfully ✅")
            
            # Capture one frame
            ret, frame = cap.read()
            if not ret:
                print("FRAME: [FAIL] Could not capture frame ❌")
                return

            # Encode
            _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 50])
            frame_b64 = base64.b64encode(buffer).decode('utf-8')
            
            # TEST 1: Send Heartbeat
            print("PROTOCOL: Sending Test Heartbeat...")
            await websocket.send(json.dumps({"type": "ping"}))
            
            # TEST 2: Send Frame
            print(f"PROTOCOL: Sending Frame (Size: {len(frame_b64)} chars)...")
            payload = {
                "type": "frame",
                "camera_uid": camera_uid,
                "data": frame_b64
            }
            await websocket.send(json.dumps(payload))
            print("PROTOCOL: Data Pushed Successfully ✅")
            
            # Wait for any bounce-back (Consumer might send a response)
            try:
                # Give it a second to see if the server drops the connection
                await asyncio.sleep(2)
                print("\nSTATUS: Stream is ACTIVE. Your dashboard should be updating now.")
                print("If the dashboard still shows 'Waiting', verify that:")
                print(f"1. The Camera UID on the dashboard is EXACTLY '{camera_uid}'")
                print("2. You have pressed 'Resume Stream' on the UI (if paused)")
            except:
                pass

    except ConnectionRefusedError:
        print(f"CONNECTIVITY: [FAIL] Connection Refused! Is the server running on {base_url}? ❌")
    except Exception as e:
        print(f"ERROR: {str(e)} ❌")
    finally:
        if 'cap' in locals(): cap.release()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python agent_diagnostics.py <NODE_ID> [CAMERA_UID]")
    else:
        nid = sys.argv[1]
        cuid = sys.argv[2] if len(sys.argv) > 2 else "legacy_master"
        asyncio.run(diagnose_stream(nid, cuid))
