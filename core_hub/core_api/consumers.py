import json
import base64
from channels.generic.websocket import AsyncWebsocketConsumer

class CCTVStreamConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.node_id = self.scope['url_route']['kwargs']['node_id']
        self.room_group_name = f'cctv_{self.node_id}'
        
        print(f"[CCTV DEBUG] NEW CONNECTION for node {self.node_id} (Channel: {self.channel_name})")

        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()

    async def disconnect(self, close_code):
        print(f"[CCTV DEBUG] DISCONNECT from node {self.node_id} (Code: {close_code})")
        # Leave room group
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    # Receive message from WebSocket (Node or Browser)
    async def receive(self, text_data=None, bytes_data=None):
        if bytes_data:
            # Binary frame from Edge Node (Direct Relay)
            # Send binary data directly to the group
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'cctv_frame',
                    'data': bytes_data
                }
            )
        elif text_data:
            try:
                data = json.loads(text_data)
                msg_type = data.get('type')
                
                if msg_type == 'ping':
                    await self.send(text_data=json.dumps({'type': 'pong'}))
                
                # If a node sends a frame (Base64 for multi-camera support)
                elif msg_type == 'frame':
                    frame_b64 = data.get('data')
                    camera_uid = data.get('camera_uid', 'legacy_master')
                    print(f"[CCTV DEBUG] Backend received frame from node {self.node_id} for camera {camera_uid}. Size: {len(frame_b64) if frame_b64 else 0} bytes")
                    if frame_b64:
                        await self.channel_layer.group_send(
                            self.room_group_name,
                            {
                                'type': 'cctv_frame_broadcast',
                                'camera_uid': camera_uid,
                                'data': frame_b64
                            }
                        )

            except json.JSONDecodeError:
                pass

    # Receive message from room group (Relay to Browser)
    async def cctv_frame(self, event):
        # Fallback for raw binary (legacy/single camera)
        binary_data = event['data']
        await self.send(bytes_data=binary_data)

    async def cctv_frame_broadcast(self, event):
        # Directed frame for specific camera
        print(f"[CCTV DEBUG] Broadcasting frame for camera {event['camera_uid']} to browser client")
        await self.send(text_data=json.dumps({
            'type': 'frame',
            'camera_uid': event['camera_uid'],
            'data': event['data']
        }))

