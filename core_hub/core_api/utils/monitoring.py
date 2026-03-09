from django.core.mail import send_mail
from django.conf import settings

def send_system_alert(subject, message, severity="MEDIUM"):
    """
    Sends a critical system alert to developers.
    """
    alert_email = getattr(settings, 'DEV_ALERTS_EMAIL', settings.DEFAULT_FROM_EMAIL)
    
    formatted_subject = f"[POSTURE ALERT] [{severity}] {subject}"
    
    full_message = f"""
    SYSTEM ALERT
    ------------
    Severity: {severity}
    Subject: {subject}
    
    Details:
    {message}
    
    --
    Posture System Monitor
    """
    
    try:
        send_mail(
            subject=formatted_subject,
            message=full_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[alert_email],
            fail_silently=False
        )
        print(f"[MONITOR] System alert sent: {subject}")
        return True
    except Exception as e:
        print(f"[MONITOR ERROR] Failed to send system alert: {str(e)}")
        return False
