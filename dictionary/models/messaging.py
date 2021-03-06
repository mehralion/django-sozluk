from django.db import models
from django.utils import timezone

from ..utils import turkish_lower
from .managers.messaging import ConversationManager, MessageManager


class Message(models.Model):
    body = models.TextField()
    sender = models.ForeignKey("Author", related_name="+", on_delete=models.CASCADE)
    recipient = models.ForeignKey("Author", related_name="+", on_delete=models.CASCADE)
    sent_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, editable=False)

    objects = MessageManager()

    class Meta:
        ordering = ["sent_at"]

    def __str__(self):
        return str(self.pk)

    def save(self, *args, **kwargs):
        self.body = turkish_lower(self.body).strip()
        super().save(*args, **kwargs)

    def mark_read(self):
        self.read_at = timezone.now()
        self.save()


class Conversation(models.Model):
    participants = models.ManyToManyField("Author")
    messages = models.ManyToManyField(Message)

    objects = ConversationManager()

    def __str__(self):
        return f"{self.id}{self.participants.values_list('username', flat=True)}"

    @property
    def last_message(self):
        return self.messages.latest("sent_at")

    @property
    def collection(self):
        return self.messages.select_related("sender")
