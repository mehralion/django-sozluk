from django.contrib.auth.views import (
    PasswordResetCompleteView,
    PasswordResetConfirmView,
    PasswordResetDoneView,
    PasswordResetView,
)
from django.urls import path

from ..views.auth import (
    ChangeEmail,
    ChangePassword,
    ConfirmEmail,
    Login,
    Logout,
    ResendEmailConfirmation,
    SignUp,
    TerminateAccount,
)
from ..views.reporting import VerifyReport


urlpatterns_password_reset = [
    path(
        "parola/",
        PasswordResetView.as_view(
            template_name="dictionary/registration/password_reset/form.html",
            html_email_template_name="dictionary/registration/password_reset/email_template.html",
        ),
        name="password_reset",
    ),
    path(
        "parola/oldu/",
        PasswordResetDoneView.as_view(template_name="dictionary/registration/password_reset/done.html"),
        name="password_reset_done",
    ),
    path(
        "parola/onay/<uidb64>/<token>/",
        PasswordResetConfirmView.as_view(template_name="dictionary/registration/password_reset/confirm.html"),
        name="password_reset_confirm",
    ),
    path(
        "parola/tamam/",
        PasswordResetCompleteView.as_view(template_name="dictionary/registration/password_reset/complete.html"),
        name="password_reset_complete",
    ),
]

urlpatterns_auth = urlpatterns_password_reset + [
    path("login/", Login.as_view(), name="login"),
    path("register/", SignUp.as_view(), name="register"),
    path("logout/", Logout.as_view(next_page="/"), name="logout"),
    path("email/onayla/<uidb64>/<token>/", ConfirmEmail.as_view(), name="confirm_email"),
    path("email/tekrar/", ResendEmailConfirmation.as_view(), name="resend_email"),
    path("ayarlar/sifre/", ChangePassword.as_view(), name="user_preferences_password"),
    path("ayarlar/email/", ChangeEmail.as_view(), name="user_preferences_email"),
    path("ayarlar/hesabi-kapat/", TerminateAccount.as_view(), name="user_preferences_terminate"),
    path("iletisim/onay/<uuid:key>", VerifyReport.as_view(), name="verify-report"),
]
