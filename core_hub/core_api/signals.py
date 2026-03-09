from django.db.models.signals import post_save, pre_save, post_delete
from django.dispatch import receiver
from .models import CustomUser, Organization, AuditLog

@receiver(post_save, sender=CustomUser)
def log_user_role_change(sender, instance, created, **kwargs):
    """
    Logs when a user's role is updated.
    """
    if not created and 'role' in (kwargs.get('update_fields') or []):
        AuditLog.objects.create(
            organization=instance.organization,
            actor=None, # In a signal, we don't always have the request user easily
            action="ROLE_CHANGE",
            description=f"User {instance.email} role updated to {instance.role}.",
            payload={"user_id": str(instance.id), "new_role": instance.role}
        )

@receiver(pre_save, sender=Organization)
def log_org_setting_changes(sender, instance, **kwargs):
    """
    Logs sensitive changes to organization settings before saving.
    """
    if instance.pk:
        try:
            old_instance = Organization.objects.get(pk=instance.pk)
            changes = {}
            
            if old_instance.is_active != instance.is_active:
                changes['is_active'] = {'from': old_instance.is_active, 'to': instance.is_active}
            
            if old_instance.max_seats != instance.max_seats:
                changes['max_seats'] = {'from': old_instance.max_seats, 'to': instance.max_seats}

            if changes:
                AuditLog.objects.create(
                    organization=instance,
                    action="ORG_UPDATE",
                    description=f"Organization {instance.name} settings updated: {', '.join(changes.keys())}.",
                    payload=changes
                )
        except Organization.DoesNotExist:
            pass

@receiver(post_save, sender=CustomUser)
def log_new_member(sender, instance, created, **kwargs):
    """
    Logs when a new user is created or joins an organization.
    """
    if created:
        action = "USER_REGISTERED"
        desc = f"New user {instance.email} registered."
        if instance.organization:
            action = "MEMBER_JOINED"
            desc = f"User {instance.email} joined organization {instance.organization.name}."
            
        AuditLog.objects.create(
            organization=instance.organization,
            action=action,
            description=desc,
            payload={"user_id": str(instance.id), "email": instance.email}
        )
