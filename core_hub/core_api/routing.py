from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/api/v1/cctv/stream/(?P<node_id>[a-f0-9-]+)/$', consumers.CCTVStreamConsumer.as_asgi()),
]
