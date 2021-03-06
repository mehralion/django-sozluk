import re
from decimal import Decimal

from django.contrib.auth.models import AnonymousUser
from django.core.validators import RegexValidator
from django.db import models
from django.db.models import F
from django.shortcuts import reverse
from django.utils import timezone

from ..models.messaging import Message
from ..utils import turkish_lower, get_generic_superuser
from .managers.entry import EntryManager, EntryManagerAll, EntryManagerOnlyPublished


class EntryValidator(RegexValidator):
    regex = r"""^[A-Za-z0-9 ğçıöşüĞÇİÖŞÜ#₺&@()_+=':%/",.!?*~`\[\]{}<>^;\\|-]+$"""
    message = "bu entry geçersiz karakterler içeriyor"
    flags = re.MULTILINE


class Entry(models.Model):
    topic = models.ForeignKey("Topic", on_delete=models.CASCADE, related_name="entries")
    author = models.ForeignKey("Author", on_delete=models.CASCADE)
    content = models.TextField(validators=[EntryValidator()])
    date_created = models.DateTimeField(auto_now_add=True)
    date_edited = models.DateTimeField(blank=True, null=True, default=None)
    vote_rate = models.DecimalField(max_digits=7, decimal_places=2, default=Decimal(0))
    is_draft = models.BooleanField(default=False)

    objects_all = EntryManagerAll()
    objects_published = EntryManagerOnlyPublished()
    objects = EntryManager()

    def __str__(self):
        return f"{self.id}#{self.author}"

    class Meta:
        ordering = ["date_created"]
        verbose_name_plural = "entry"

    def save(self, *args, **kwargs):
        self.content = turkish_lower(self.content)
        super().save(*args, **kwargs)

        # Check if the user has written 10 entries, If so make them available for novice lookup
        if self.author.is_novice and self.author.application_status == "OH" and self.author.entry_count >= 10:
            self.author.application_status = "PN"
            self.author.application_date = timezone.now()
            self.author.save()

            Message.objects.compose(
                get_generic_superuser(),
                self.author,
                "10 adet entry'nizi doldurduğunuz için sizi çaylak listesine aldık."
                " profilinizden sıranızı görebilirsiniz.",
            )

        # assign topic creator (includes novices)
        if not self.is_draft and not self.topic.created_by:
            self.topic.created_by = self.author
            self.topic.save()

        self.topic.register_wishes(fulfiller_entry=self)

    def get_absolute_url(self):
        return reverse("entry-permalink", kwargs={"entry_id": self.pk})

    def delete(self, *args, **kwargs):
        super().delete(*args, **kwargs)
        if self.author.is_novice and self.author.application_status == "PN":
            # if the entry count drops less than 10, remove user from novice lookup
            # does not work if bulk deletion made on admin panel (users can only remove one entry at a time)
            if self.author.entry_count < 10:
                self.author.application_status = "OH"
                self.author.application_date = None
                self.author.save()

    def get_favorite_count(self, sender=AnonymousUser):
        favoriters = self.favorited_by(manager="objects_accessible")

        if sender.is_authenticated:
            return favoriters.exclude(pk__in=sender.blocked.all()).count()

        return favoriters.count()

    def update_vote(self, rate, change=False):
        k = Decimal("2") if change else Decimal("1")
        self.vote_rate = F("vote_rate") + rate * k
        self.save()
