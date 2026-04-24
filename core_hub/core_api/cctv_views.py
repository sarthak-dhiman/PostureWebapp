import base64
import uuid
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.utils import timezone
from .models import Organization, ServiceAccount, CCTVTelemetry, PlatformLog

class CCTVNodeRegisterView(APIView):
    """
    Called by an Edge CCTV Node exactly once during its setup script.
    It takes an organization invite code, verifies it, and returns an ApiKey.
    """
    permission_classes = [] # Public, verified by invite code
    
    def post(self, request):
        invite_code = request.data.get("invite_code")
        device_name = request.data.get("device_name", "Unknown CCTV Node")
        mac_address = request.data.get("mac_address", "00:00:00:00:00:00")
        
        if not invite_code:
            return Response({"error": "invite_code is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        # Verify the organization
        org = get_object_or_404(Organization, invite_code=invite_code)
        
        # Optional: check if org has subscription/CCTV seats here
        has_sub = bool(org.stripe_subscription_id) or hasattr(org, 'gifted_subscription')
        if not has_sub:
            return Response({"error": "Organization does not have an active enterprise subscription."}, status=status.HTTP_403_FORBIDDEN)
            
        # Create a new ServiceAccount for this device
        account, raw_key = ServiceAccount.create_with_key(
            organization=org,
            name=f"{device_name} ({mac_address[-8:]})",
            source_type=ServiceAccount.SourceType.CCTV_NODE
        )
        
        return Response({
            "status": "success",
            "device_id": str(account.id),
            "organization_name": org.name,
            "api_key": raw_key,
            "message": "Store this API key securely. It cannot be retrieved again."
        }, status=status.HTTP_201_CREATED)


class CCTVNodeTelemetryView(APIView):
    """
    Called periodically (e.g. every 10s) by the Edge CCTV Node to report its status.
    Must be authenticated with the ApiKey provided during registration.
    """
    # Requires custom ApiKey auth, but we can handle it manually in dispatch if needed, 
    # or rely on a middleware/authenticator. Let's do it manually for simplicity here.
    authentication_classes = []
    permission_classes = []

    
    def get_service_account(self, request):
        auth_header = request.headers.get('Authorization')
        xdevice = request.headers.get('X-Device-Api-Key') or request.headers.get('X-Device-Apikey')
        print(f"[DEBUG AUTH] Incoming Header: {auth_header}")
        if xdevice:
            print(f"[DEBUG AUTH] Incoming X-Device-Api-Key header present")

        raw_key = None

        # Accept multiple schemes from Authorization: ApiKey <key> or Token <key>
        if auth_header:
            parts = auth_header.split()
            if len(parts) == 2:
                scheme, candidate = parts
                if scheme in ('Bearer', 'ApiKey', 'Token'):
                    # Note: Bearer will frequently be a JWT; this method is primarily
                    # used by device endpoints where frontend uses Bearer for raw keys.
                    raw_key = candidate
                    print(f"[DEBUG AUTH] Using Authorization scheme: {scheme}")

        # Fallback to explicit X-Device-Api-Key header
        if not raw_key and xdevice:
            raw_key = xdevice

        if not raw_key:
            print("[DEBUG AUTH] No device key found in headers.")
            return None

        # Log obfuscated key for verification
        safe_key = f"{raw_key[:4]}...{raw_key[-4:]}" if len(raw_key) > 8 else "***"
        print(f"[DEBUG AUTH] Raw Key (safe): {safe_key}")
        
        try:
            hashed_key = ServiceAccount.hash_key(raw_key)
            print(f"[DEBUG AUTH] Hashed Key: {hashed_key}")
            
            # Check for deterministic key fallback (from frontend demo)
            # The frontend generates: "ph_live_" + base64(org.id) + "X9jL2"
            import base64
            from .models import Organization
            
            # 1. Try standard DB lookup first
            try:
                acc = ServiceAccount.objects.get(
                    api_key_hash=hashed_key, 
                    source_type=ServiceAccount.SourceType.CCTV_NODE
                )
                print(f"[DEBUG AUTH] Authenticated as: {acc}")
                return acc
            except ServiceAccount.DoesNotExist:
                # 2. If not found, check if it's the deterministic frontend key for ANY organization
                for org in Organization.objects.all():
                    expected_raw = "ph_live_" + base64.b64encode(str(org.id).encode()).decode().replace('=', '') + "X9jL2"
                    if raw_key == expected_raw:
                        print(f"[DEBUG AUTH] Matched deterministic demo key for org: {org.name}")
                        # Auto-provision the service account if it doesn't exist
                        acc, created = ServiceAccount.objects.get_or_create(
                            organization=org,
                            name=f"Main Posture CCTV Node ({org.name})",
                            source_type=ServiceAccount.SourceType.CCTV_NODE,
                            defaults={"api_key_hash": hashed_key}
                        )
                        return acc
                        
            print(f"[DEBUG AUTH] NOT FOUND: No ServiceAccount matches this hash and type.")
            return None
            
        except Exception as e:
            print(f"[DEBUG AUTH] ERROR during auth: {str(e)}")
            return None

    def post(self, request):
        service_account = self.get_service_account(request)
        if not service_account:
            return Response({"error": "Unauthorized"}, status=status.HTTP_401_UNAUTHORIZED)
            
        node_status = request.data.get("status", "online")
        active_tracked_persons = request.data.get("active_tracked_persons", 0)
        current_fps = request.data.get("current_fps", 0.0)
        
        # New: Rich per-camera payload
        # Expected format: {"cameras": [{"uid": "cam_1", "name": "Front Desk", "tracked_persons": 2, "fps": 12.5}, ...]}
        cameras_payload = request.data.get("cameras", [])
        
        # Sync camera objects
        from .models import CCTVCamera
        if cameras_payload:
            # State Sync: Deactivate ALL cameras for this node first
            # They will be reactivated individually below if they are in the current payload
            CCTVCamera.objects.filter(service_account=service_account).update(is_active=False)
            
            for cam_data in cameras_payload:
                uid = cam_data.get("uid")
                if uid:
                    CCTVCamera.objects.update_or_create(
                        service_account=service_account,
                        uid=uid,
                        defaults={
                            "name": cam_data.get("name", f"Camera {uid}"),
                            "room_type": cam_data.get("room_type", "General"),
                            "is_active": True # Reactivate this specific camera
                        }
                    )
        elif not service_account.cameras.exists():
            # Legacy Fallback: Create a default master camera
            CCTVCamera.objects.get_or_create(
                service_account=service_account,
                uid="legacy_master",
                defaults={
                    "name": "Master Feed",
                    "room_type": "Facility",
                    "is_active": True
                }
            )

        telemetry = CCTVTelemetry.objects.create(
            service_account=service_account,
            status=node_status,
            active_tracked_persons=active_tracked_persons,
            current_fps=current_fps,
            payload=request.data # Store everything
        )
        
        return Response({"status": "ok", "telemetry_id": str(telemetry.id)}, status=status.HTTP_201_CREATED)


class CCTVNodeDetailView(APIView):
    """
    Returns detailed stats for a specific node, including its camera list
    and recent telemetry/violations for the drill-down dashboard.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, node_id):
        from .models import ServiceAccount, CCTVCamera, CCTVViolation, CCTVTelemetry
        from django.utils import timezone
        
        org = request.user.organization
        try:
            acc = ServiceAccount.objects.get(id=node_id, organization=org)
        except ServiceAccount.DoesNotExist:
            return Response({"error": "Node not found"}, status=status.HTTP_404_NOT_FOUND)

        # Get latest telemetry
        latest_tel = acc.telemetry.order_by('-created_at').first()
        
        # Get Cameras
        cameras = []
        node_cameras = acc.cameras.filter(is_active=True)
        
        # If no hard cameras exist, synthesize a legacy master
        if not node_cameras.exists() and latest_tel:
             cameras.append({
                "id": "synthetic-legacy",
                "uid": "legacy_master",
                "name": "Master Feed (Legacy)",
                "room_type": "Facility",
                "is_active": True,
                "tracked_persons": latest_tel.active_tracked_persons,
                "fps": latest_tel.current_fps,
                "is_legacy": True
            })
        else:
            for cam in node_cameras:
                # Extract this camera's specific stats from the latest telemetry payload
                cam_telemetry = {}
                if latest_tel and isinstance(latest_tel.payload, dict):
                    cam_list = latest_tel.payload.get("cameras", [])
                    cam_telemetry = next((c for c in cam_list if c.get("uid") == cam.uid), {})

                cameras.append({
                    "id": str(cam.id),
                    "uid": cam.uid,
                    "name": cam.name,
                    "room_type": cam.room_type,
                    "is_active": cam.is_active,
                    "tracked_persons": cam_telemetry.get("tracked_persons", 0),
                    "fps": cam_telemetry.get("fps", 0.0)
                })

        # Get last 20 violations
        violations = CCTVViolation.objects.filter(camera__service_account=acc).order_by('-timestamp')[:20]
        violation_list = [{
            "id": str(v.id),
            "camera_name": v.camera.name,
            "type": v.violation_type,
            "severity": v.severity,
            "violator": v.violator_name,
            "timestamp": v.timestamp.isoformat()
        } for v in violations]

        return Response({
            "id": str(acc.id),
            "name": acc.name,
            "status": "online" if latest_tel and (timezone.now() - latest_tel.created_at).total_seconds() < 90 else "offline",
            "total_fps": latest_tel.current_fps if latest_tel else 0,
            "total_tracked": latest_tel.active_tracked_persons if latest_tel else 0,
            "cameras": cameras,
            "recent_violations": violation_list
        })



class CCTVEventLogView(APIView):
    """
    Called by the Edge CCTV Node when an anomaly (like bad posture) is detected.
    """
    permission_classes = []
    
    def get_service_account(self, request):
        auth_header = request.headers.get('Authorization')
        print(f"[DEBUG EVENT AUTH] Incoming Header: {auth_header}")
        
        if not auth_header or not auth_header.startswith('Bearer '):
            return None
            
        token = auth_header.split(' ')[1]
        raw_key = token
        
        try:
            hashed_key = ServiceAccount.hash_key(raw_key)
            acc = ServiceAccount.objects.get(
                api_key_hash=hashed_key, 
                source_type=ServiceAccount.SourceType.CCTV_NODE
            )
            print(f"[DEBUG EVENT AUTH] Authenticated as: {acc}")
            return acc
        except ServiceAccount.DoesNotExist:
            print(f"[DEBUG EVENT AUTH] NOT FOUND for hash {hashed_key[:8]}...")
            return None
        except Exception as e:
            print(f"[DEBUG EVENT AUTH] ERROR: {str(e)}")
            return None

    def post(self, request):
        service_account = self.get_service_account(request)
        if not service_account:
            return Response({"error": "Unauthorized"}, status=status.HTTP_401_UNAUTHORIZED)
            
        payload = request.data.get("payload", {})
        
        log_entry = PlatformLog.objects.create(
            organization=service_account.organization,
            service_account=service_account,
            app_source=PlatformLog.AppSource.POSTURE_CCTV,
            payload=payload
        )
        
        return Response({"status": "logged", "log_id": str(log_entry.id)}, status=status.HTTP_201_CREATED)


class CCTVDashboardNodesView(APIView):
    """
    Called by the Next.js frontend to list all registered edge nodes and their latest telemetry
    for the current user's organization.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.utils import timezone
        from datetime import timedelta

        user = request.user
        org = user.organization
        
        if not org:
            return Response({"error": "No organization found"}, status=status.HTTP_400_BAD_REQUEST)
            
        nodes = []
        # Fix: use ServiceAccount.SourceType.CCTV_NODE — not PlatformLog.AppSource
        node_accounts = ServiceAccount.objects.filter(
            organization=org, 
            source_type=ServiceAccount.SourceType.CCTV_NODE
        )
        
        # A node is considered online if it has sent a telemetry ping in the last 90 seconds
        ONLINE_THRESHOLD = timedelta(seconds=90)
        now = timezone.now()

        for acc in node_accounts:
            # Get latest telemetry
            latest_tel = acc.telemetry.order_by('-created_at').first()
            # Determine online status by recency, not just stored status string
            if latest_tel and (now - latest_tel.created_at) < ONLINE_THRESHOLD:
                node_status = "online"
            else:
                node_status = "offline"

            nodes.append({
                "id": str(acc.id),
                "name": acc.name,
                "status": node_status,
                "feeds": 1,
                "fps": latest_tel.current_fps if latest_tel else 0,
                "active_tracked_persons": latest_tel.active_tracked_persons if latest_tel else 0,
                "last_seen": latest_tel.created_at.isoformat() if latest_tel else None
            })
            
        return Response({"nodes": nodes})


