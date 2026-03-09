from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import CustomUser, Organization, PlatformLog, ServiceAccount


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ['name', 'is_active', 'razorpay_subscription_id', 'created_at']
    list_filter = ['is_active']
    search_fields = ['name', 'razorpay_subscription_id']
    readonly_fields = ['id', 'created_at']


@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    list_display = ['username', 'email', 'organization', 'role', 'is_active']
    list_filter = ['role', 'is_active', 'organization']
    search_fields = ['username', 'email', 'first_name', 'last_name']
    readonly_fields = ['last_login', 'date_joined']

    # Add `organization` and `role` to the fieldsets from UserAdmin.
    fieldsets = UserAdmin.fieldsets + (
        ('Organization & Role', {'fields': ('organization', 'role')}),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (
        ('Organization & Role', {'fields': ('organization', 'role')}),
    )


@admin.register(ServiceAccount)
class ServiceAccountAdmin(admin.ModelAdmin):
    list_display = ['name', 'organization', 'source_type', 'is_active', 'created_at']
    list_filter = ['source_type', 'is_active', 'organization']
    search_fields = ['name', 'organization__name']
    readonly_fields = ['id', 'api_key_hash', 'created_at']

    def get_exclude(self, request, obj=None):
        # Ensure api_key_hash cannot be edited through the admin form.
        return ['api_key_hash'] if obj is None else []


@admin.register(PlatformLog)
class PlatformLogAdmin(admin.ModelAdmin):
    list_display = ['id', 'app_source', 'organization', 'user', 'service_account', 'timestamp']
    list_filter = ['app_source', 'organization']
    search_fields = ['user__username', 'service_account__name', 'organization__name']
    readonly_fields = ['id', 'organization', 'app_source', 'user', 'service_account',
                       'payload', 'timestamp', 'created_at']
    date_hierarchy = 'timestamp'

    def has_add_permission(self, request):
        # Logs are ingested via the API only; never via admin.
        return False

    def has_change_permission(self, request, obj=None):
        # Logs are immutable.
        return False
