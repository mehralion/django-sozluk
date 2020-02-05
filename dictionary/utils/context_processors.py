from urllib.parse import parse_qsl

from django.core.exceptions import ObjectDoesNotExist
from django.core.paginator import Paginator
from django.utils.functional import cached_property

from ..models import Category, Conversation, TopicFollowing
from . import b64decode_utf8_or_none, get_category_parameters
from .managers import TopicListManager
from .settings import (NON_DB_CATEGORIES, NON_DB_SLUGS_SAFENAMES, TOPICS_PER_PAGE_DEFAULT, YEAR_RANGE, DEFAULT_CATEGORY,
                       LOGIN_REQUIRED_CATEGORIES)


class LeftFrameProcessor:
    """
    Provides necessary data for left frame rendering on page load. Works similar to views.list.TopicList
    """
    safename = None

    def __init__(self, request):
        # Find corresponding slug, decide if it is non-database slug or not.
        self.request = request
        self.slug = b64decode_utf8_or_none(request.COOKIES.get("active_category"))

        if self.slug:
            if self.slug in NON_DB_CATEGORIES:
                self.handle_non_db()
            else:
                self.handle_generic()
        else:
            self.handle_default()

    def handle_non_db(self):
        self.safename = NON_DB_SLUGS_SAFENAMES[self.slug]

    def handle_generic(self):
        try:
            category = Category.objects.get(slug=self.slug)
            self.safename = category.name
        except Category.DoesNotExist:
            self.handle_default()

    def handle_default(self):
        self.slug = DEFAULT_CATEGORY
        self.safename = NON_DB_SLUGS_SAFENAMES[self.slug]

    @property
    def serialized(self):
        current_page = self.get_page()

        if not self.request.user.is_authenticated and self.slug in LOGIN_REQUIRED_CATEGORIES:
            self.handle_default()

        manager = TopicListManager(self.request.user, self.slug, self.year, search_keys=self.search_keys)
        paginated = Paginator(manager.serialized, self.get_paginate_by())
        topic_data = paginated.get_page(current_page).object_list

        # @formatter:off
        data = {
            "slug": self.slug,
            "topic_data": topic_data,
            "refresh_count": manager.refresh_count,
            "slug_identifier": manager.slug_identifier,
            "slug_parameters": self.parameters,
            "page_range": paginated.page_range,
            "current_page": current_page,
            "safename": self.safename,
            "selected_year": self.year,
            "year_range": YEAR_RANGE
        }  # @formatter:on

        return data

    def get_page(self):
        try:
            page = int(b64decode_utf8_or_none(self.request.COOKIES.get("navigation_page")))
        except (TypeError, ValueError, OverflowError):
            page = 1

        return page

    def get_paginate_by(self):
        if self.request.user.is_authenticated:
            return self.request.user.topics_per_page
        return TOPICS_PER_PAGE_DEFAULT

    @cached_property
    def parameters(self):
        return get_category_parameters(self.slug, self.year)

    @cached_property
    def year(self):
        if self.slug == "tarihte-bugun":
            return b64decode_utf8_or_none(self.request.COOKIES.get("selected_year")) or 2020  # default
        return None

    @cached_property
    def search_keys(self):
        # Returns a dictionary.
        if self.slug == "hayvan-ara":
            query = b64decode_utf8_or_none(self.request.COOKIES.get("search_parameters"))
            if not query:
                self.handle_default()
                return {}

            search_keys = dict(parse_qsl(query[1:]))  # [1:] to omit ? from query
            return search_keys
        return {}

    @cached_property
    def active_category(self):
        # Call after .serialized
        return self.slug


def left_frame(request):
    processor = LeftFrameProcessor(request)
    serialized_data = processor.serialized
    active_category = processor.active_category
    return {"left_frame": serialized_data, "active_category": active_category}


def header_categories(request):
    """
    Required for header category navigation.
    """
    return {"nav_categories": Category.objects.all()}


def message_status(request):
    """
    Checks if any unread messages exists, enables the indicator in the header if there are.
    """
    unread_message_status = False

    if request.user.is_authenticated:
        try:
            for chat in Conversation.objects.list_for_user(request.user):
                if chat.last_message.recipient == request.user and not chat.last_message.read_at:
                    unread_message_status = True
                    break
        except Conversation.DoesNotExist:
            pass

    return {"user_has_unread_messages": unread_message_status}


def following_status(request):
    """
    Enables the indicator in the header, if there is new content from following topics.
    Notice: only for following topics, not users. there is a dedicated tab named "son" in header for that.
    """
    status = False
    if request.user.is_authenticated:
        user_following = TopicFollowing.objects.filter(author=request.user)

        try:
            for following in user_following:
                if following.read_at < following.topic.latest_entry_date(request.user):
                    status = True
                    break
        except ObjectDoesNotExist:
            pass
    return {"user_has_unread_followings": status}
