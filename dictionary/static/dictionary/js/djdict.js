/* global Cookies */

$.ajaxSetup({
    beforeSend (xhr, settings) {
        xhr.setRequestHeader("Content-Type", "application/json");
        if (!(/^http:.*/.test(settings.url) || /^https:.*/.test(settings.url))) {
            // Only send the token to relative URLs i.e. locally.
            xhr.setRequestHeader("X-CSRFToken", Cookies.get("csrftoken"));
        }
    }
});

let toastQueue = 0;

const notify = (message, level = "default", initialDelay = 2000, persistent = false) => {
    const toastHolder = $(".toast-holder");
    const toastTemplate = `
    <div ${level === "error" ? `role="alert" aria-live="assertive"` : `role="status" aria-live="polite"`} aria-atomic="true" class="toast shadow-sm" data-autohide="${!persistent}">
        <div class="toast-body ${level}">
            <div class="toast-content">
                <span>${message}</span>
                <button type="button" class="ml-2 close" data-dismiss="toast" aria-label="Kapat">
                    <span aria-hidden="true">&times;</span>
                </button>
            </div>
        </div>
    </div>`;

    const toast = $(toastTemplate).prependTo(toastHolder);
    const delay = initialDelay + (toastQueue * 1000);

    $(toast).toast({ delay }).toast("show").on("shown.bs.toast", function () {
        toastQueue += 1;
    }).on("hidden.bs.toast", function () {
        $(this).remove();
        toastQueue -= 1;
    });
};

const dictToParameters = function (dict) {
    const str = [];
    for (const key in dict) {
        // a. check if the property/key is defined in the object itself, not in parent
        // b. check if the key is not empty
        if (Object.prototype.hasOwnProperty.call(dict, key) && dict[key]) {
            str.push(encodeURIComponent(key) + "=" + encodeURIComponent(dict[key]));
        }
    }
    return str.join("&");
};

let userIsMobile = false;
let lastScrollTop = 0;

const hideRedundantHeader = function () {
    const delta = 30;
    const st = $(this).scrollTop();
    const header = $("header.page_header");
    if (Math.abs(lastScrollTop - st) <= delta) {
        return;
    }

    if (st > lastScrollTop) {
        // downscroll code
        $(".sub-nav").css("margin-top", ".75em");
        header.css("top", "-55px").hover(function () {
            $(".sub-nav").css("margin-top", "0");
            header.css("top", "0px");
        });
    } else {
        // upscroll code
        $(".sub-nav").css("margin-top", "0");
        header.css("top", "0px");
    }
    lastScrollTop = st;
};

const mql = window.matchMedia("(max-width: 810px)");

const desktopView = function () {
    userIsMobile = false;

    // Find left frame scroll position.
    if (parseInt(localStorage.getItem("where")) > 0) {
        $("#left-frame-nav").scrollTop(localStorage.getItem("where"));
    }

    // Restore header.
    window.removeEventListener("scroll", hideRedundantHeader);
    $(".sub-nav").css("margin-top", "0");
    $("header.page_header").css("top", "0px");

    // Code to render swh references properly (reverse)
    $("a[data-sup]").each(function () {
        $(this).html(`*`);
    });
};

const mobileView = function () {
    userIsMobile = true;
    // Code to hide some part of the header on mobile scroll.
    window.addEventListener("scroll", hideRedundantHeader);

    // Code to render swh references properly
    $("a[data-sup]").each(function () {
        $(this).html(`<sup>${$(this).attr("data-sup")}</sup>`);
    });
};

// Safari doesn't support mql.addEventListener yet, so we have
// to use deprecated addListener.
mql.addListener(function (e) {
    if (e.matches) {
        mobileView();
    } else {
        desktopView();
    }
});

$(function () {
    // DOM ready.
    if (mql.matches) {
        mobileView();
    } else {
        desktopView();
    }

    // Handles notifications passed by django's message framework.
    const requestMessages = $("#request-messages");
    if (requestMessages.attr("data-has-messages") === "true") {
        let delay = 2000;
        for (const message of requestMessages.children("li")) {
            const isPersistent = $(message).attr("data-extra").includes("persistent");
            notify($(message).attr("data-message"), $(message).attr("data-level"), delay, isPersistent);
            delay += 1000;
        }
    }
});

$("input.with-datepicker-dropdown").datepicker(
    {
        container: "#dropdown_detailed_search",
        todayHighlight: true,
        language: "tr",
        autoclose: true,
        orientation: "auto bottom"
    }
).attr("placeholder", "gg.aa.yyyy");

$("input.with-datepicker-mobile").datepicker(
    {
        container: ".row",
        todayHighlight: true,
        language: "tr",
        autoclose: true,
        orientation: "auto left"
    }
).attr("placeholder", "gg.aa.yyyy");

$("#header_search").autocomplete({
    triggerSelectOnValidInput: false,
    showNoSuggestionNotice: true,
    noSuggestionNotice: "-- buna yakın bir sonuç yok --",

    lookup (lookup, done) {
        if (lookup.startsWith("@") && lookup.substr(1)) {
            const query = `{ autocomplete { authors(lookup: "${lookup.substr(1)}") { username } } }`;
            $.post("/graphql/", JSON.stringify({ query }), function (response) {
                done({ suggestions: response.data.autocomplete.authors.map(user => ({ value: `@${user.username}` })) });
            });
        } else {
            const query = `{ autocomplete { authors(lookup: "${lookup}", limit: 3) { username } 
                                                topics(lookup: "${lookup}", limit: 7) { title } } }`;
            $.post("/graphql/", JSON.stringify({ query }), function (response) {
                const topicSuggestions = response.data.autocomplete.topics.map(topic => ({ value: topic.title }));
                const authorSuggestions = response.data.autocomplete.authors.map(user => ({ value: `@${user.username}` }));
                done({ suggestions: topicSuggestions.concat(authorSuggestions) });
            });
        }
    },

    onSelect (suggestion) {
        window.location.replace("/topic/?q=" + suggestion.value);
    }
});

$(".author-search").autocomplete({
    lookup (lookup, done) {
        const query = `{ autocomplete { authors(lookup: "${lookup}") { username } } }`;
        $.post("/graphql/", JSON.stringify({ query }), function (response) {
            done({ suggestions: response.data.autocomplete.authors.map(user => ({ value: user.username })) });
        });
    },

    onSelect (suggestion) {
        $(this).val(suggestion.value);
    }
});

class LeftFrame {
    constructor (slug, page = 1, year = null, searchKeys = null, refresh = false, tab = null, exclusions = null) {
        this.slug = slug;
        this.page = page;
        this.year = year;
        this.refresh = refresh;
        this.searchKeys = searchKeys;
        this.tab = tab;
        this.exclusions = exclusions;

        this.setCookies();
        this.loadIndicator = $("#load_indicator");
    }

    setCookies () {
        Cookies.set("active_category", this.slug);
        Cookies.set("navigation_page", this.page);

        if (this.tab) {
            Cookies.set("active_tab", this.tab);
        } else {
            this.tab = Cookies.get("active_tab") || null;
        }

        if (this.slug === "tarihte-bugun") {
            const cookieYear = Cookies.get("selected_year");
            if (!this.year) {
                this.year = cookieYear || null;
            } else {
                Cookies.set("selected_year", this.year);
            }
        } else if (this.slug === "hayvan-ara") {
            const cookieSearchKeys = Cookies.get("search_parameters");
            if (!this.searchKeys) {
                this.searchKeys = cookieSearchKeys || null;
            } else {
                Cookies.set("search_parameters", this.searchKeys);
            }
        } else if (this.slug === "gundem") {
            const cookieExclusions = JSON.parse(Cookies.get("exclusions") || "[]");
            if (this.exclusions) {
                if (cookieExclusions) {
                    for (const exclusion of this.exclusions) {
                        if (cookieExclusions.includes(exclusion)) {
                            this.exclusions = cookieExclusions.filter(item => item !== exclusion);
                        } else {
                            cookieExclusions.push(exclusion);
                            this.exclusions = cookieExclusions;
                        }
                    }
                }
                Cookies.set("exclusions", JSON.stringify(this.exclusions));
            } else {
                this.exclusions = cookieExclusions || null;
            }
        }
    }

    call () {
        this.loadIndicator.css("display", "inline");
        const variables = {
            slug: this.slug,
            year: this.year,
            page: this.page,
            searchKeys: this.searchKeys,
            refresh: this.refresh,
            tab: this.tab,
            exclusions: this.exclusions
        };

        const query = `query($slug: String!, $year: Int, $page: Int, $searchKeys: String, $refresh: Boolean,
        $tab: String, $exclusions: [String]) { topics(slug: $slug, year: $year, page: $page, searchKeys: $searchKeys,
        refresh: $refresh, tab: $tab, exclusions: $exclusions){
            safename refreshCount year yearRange slugIdentifier parameters
            page { objectList { slug title count } paginator { pageRange numPages } number hasOtherPages }
            tabs{current available{name, safename}}
            exclusions{active, available{name, slug, description}
        }}}`;

        const self = this;

        $.post("/graphql/", JSON.stringify({ query, variables }), function (response) {
            if (response.errors) {
                self.loadIndicator.css("display", "none");
                notify("bir şeyler yanlış gitti", "error");
            } else {
                self.render(response.data.topics);
            }
        }).fail(function () {
            notify("bir şeyler yanlış gitti", "error");
            self.loadIndicator.css("display", "none");
        });
    }

    render (data) {
        $("#left-frame-nav").scrollTop(0);
        $("#current_category_name").text(data.safename);
        this.renderRefreshButton(data.refreshCount);
        this.renderYearSelector(data.year, data.yearRange);
        this.renderPagination(data.page.hasOtherPages, data.page.paginator.pageRange, data.page.paginator.numPages, data.page.number);
        this.renderTopicList(data.page.objectList, data.slugIdentifier, data.parameters);
        this.renderShowMoreButton(data.page.number, data.page.hasOtherPages);
        this.renderTabs(data.tabs);
        this.renderExclusions(data.exclusions);
        this.loadIndicator.css("display", "none");
    }

    renderRefreshButton (count) {
        const refreshButton = $("#refresh_bugun");
        if (count) {
            refreshButton.removeClass("dj-hidden");
            $("span#new_content_count").text(`(${count})`);
        } else {
            refreshButton.addClass("dj-hidden");
        }
    }

    renderShowMoreButton (currentPage, isPaginated) {
        const showMoreButton = $("a#show_more");

        if (currentPage !== 1 || !isPaginated) {
            showMoreButton.addClass("dj-hidden");
        } else {
            showMoreButton.removeClass("dj-hidden");
        }
    }

    renderTabs (tabData) {
        const tabHolder = $("ul#left-frame-tabs");
        if (tabData) {
            tabHolder.html("");
            const availableTabs = tabData.available;
            const current = tabData.current;
            for (const tab of availableTabs) {
                tabHolder.append(`<li class="nav-item"><a role="button" tabindex="0" data-lf-slug="${this.slug}" data-tab="${tab.name}" class="nav-link${current === tab.name ? " active" : ""}">${tab.safename}</a></li>`);
            }
            tabHolder.removeClass("dj-hidden");
        } else {
            tabHolder.addClass("dj-hidden");
        }
    }

    renderExclusions (exclusions) {
        const toggler = $("#gundem_excluder");
        const categoryHolder = $("#exlusion-choices");
        const categoryList = categoryHolder.children("ul.exlusion-choices");

        if (exclusions) {
            categoryList.empty();
            toggler.removeClass("dj-hidden");

            for (const category of exclusions.available) {
                const isActive = exclusions.active.includes(category.slug);
                categoryList.append(`<li><a role="button" title="${category.description}" ${isActive ? `class="active"` : ""} tabindex="0" data-slug="${category.slug}">#${category.name}</a></li>`);
            }
        } else {
            toggler.addClass("dj-hidden");
            categoryHolder.hide();
        }
    }

    renderYearSelector (currentYear, yearRange) {
        const yearSelect = $("#year_select");
        yearSelect.html("");

        if (this.slug === "tarihte-bugun") {
            yearSelect.css("display", "block");
            for (const year of yearRange) {
                yearSelect.append(`<option ${year === currentYear ? "selected" : ""} id="${year}">${year}</option>`);
            }
        } else {
            yearSelect.css("display", "none");
        }
    }

    renderTopicList (objectList, slugIdentifier, parameters) {
        const topicList = $("ul#topic-list");
        if (objectList.length === 0) {
            topicList.html(`<small>yok ki</small>`);
        } else {
            topicList.empty();
            const params = parameters || "";

            for (const topic of objectList) {
                topicList.append(`<li class="list-group-item"><a href="${slugIdentifier}${topic.slug}/${params}">${topic.title}<small class="total_entries">${topic.count ? topic.count : ""}</small></a></li>`);
            }
        }
    }

    renderPagination (isPaginated, pageRange, totalPages, currentPage) {
        // Pagination related selectors
        const paginationWrapper = $("#lf_pagination_wrapper");
        const pageSelector = $("select#left_frame_paginator");
        const totalPagesButton = $("#lf_total_pages");

        // Render pagination
        if (isPaginated && currentPage !== 1) {
            // Render Page selector
            pageSelector.empty();
            for (const page of pageRange) {
                pageSelector.append($("<option>", {
                    value: page,
                    text: page,
                    selected: page === currentPage
                }));
            }
            totalPagesButton.text(totalPages); // Last page
            paginationWrapper.removeClass("dj-hidden"); // Show it
        } else {
            paginationWrapper.addClass("dj-hidden");
        }
    }

    static populate (slug, page = 1, ...args) {
        if (userIsMobile) {
            return;
        }
        const leftFrame = new LeftFrame(slug, page, ...args);
        leftFrame.call();
    }

    static refreshPopulate () {
        LeftFrame.populate("bugun", 1, null, null, true);
    }
}

/* Start of LefFrame related triggers */

$("ul#category_view li a, div#category_view_in a:not(.regular), section.topic-categories-list ul li a").on("click", function (e) {
    e.preventDefault();
});

$("body").on("click", "[data-lf-slug]", function () {
    // Regular, slug-only

    if (userIsMobile) {
        window.location = ($(this).attr("href"));
    }

    const slug = $(this).attr("data-lf-slug");

    if ($(this)[0].hasAttribute("data-tab")) {
        // Check for the requested tab.
        LeftFrame.populate(slug, 1, null, null, false, $(this).attr("data-tab"));
    } else {
        LeftFrame.populate(slug);
    }
});

$("#year_select").on("change", function () {
    // Year is changed
    const selectedYear = this.value;
    LeftFrame.populate("tarihte-bugun", 1, selectedYear);
});

$("select#left_frame_paginator").on("change", function () {
    // Page is changed
    LeftFrame.populate(Cookies.get("active_category"), this.value);
});

$("#lf_total_pages").on("click", function () {
    // Navigated to last page
    $("select#left_frame_paginator").val($(this).html()).trigger("change");
});

$("#lf_navigate_before").on("click", function () {
    // Previous page
    const lfSelect = $("select#left_frame_paginator");
    const selected = parseInt(lfSelect.val());
    if (selected - 1 > 0) {
        lfSelect.val(selected - 1).trigger("change");
    }
});

$("#lf_navigate_after").on("click", function () {
    // Subsequent page
    const lfSelect = $("select#left_frame_paginator");
    const selected = parseInt(lfSelect.val());
    const max = parseInt($("#lf_total_pages").text());
    if (selected + 1 <= max) {
        lfSelect.val(selected + 1).trigger("change");
    }
});

$("a#show_more").on("click", function () {
    // Show more button event
    const slug = Cookies.get("active_category");

    if (slug) {
        LeftFrame.populate(slug, 2);
    }

    $(this).addClass("dj-hidden");
});

$("#refresh_bugun").on("click", function () {
    LeftFrame.refreshPopulate();
});

$(".exclusion-button").on("click", function () {
    $(this).closest("div").siblings(".exclusion-settings").toggle(250);
});

$("#exlusion-choices").on("click", "ul li a", function () {
    $(this).toggleClass("active");
    LeftFrame.populate("gundem", 1, null, null, null, null, [$(this).attr("data-slug")]);
});

$("#exclusion-settings-mobile").on("click", "ul li a", function () {
    const slug = $(this).attr("data-slug");
    const excludeParam = new URLSearchParams(window.location.search).get("exclude");
    let exclusions;

    if (excludeParam) {
        exclusions = excludeParam.split(",");
    } else {
        exclusions = [];
    }

    if (exclusions.includes(slug)) {
        exclusions = exclusions.filter(item => item !== slug);
    } else {
        exclusions.push(slug);
    }

    const exclude = exclusions.join(",");

    if (exclude) {
        window.location.replace("?exclude=" + exclude);
    } else {
        window.location.replace(window.location.href.split("?")[0]);
    }
});

/* End of LefFrame related triggers */

$("ul#category_view li[data-lf-slug], div#category_view_in a[data-lf-slug]:not(.regular)").on("click", function () {
    // Visual guidance for active category
    $("ul#category_view li[data-lf-slug], div#category_view_in a[data-lf-slug]:not(.regular)").removeClass("active");
    $(this).addClass("active");
});

// https://stackoverflow.com/questions/5999118/how-can-i-add-or-update-a-query-string-parameter
const updateQueryStringParameter = function (uri, key, value) {
    const re = new RegExp("([?&])" + key + "=.*?(&|$)", "i");
    const separator = uri.indexOf("?") !== -1 ? "&" : "?";
    if (uri.match(re)) {
        return uri.replace(re, "$1" + key + "=" + value + "$2");
    } else {
        return uri + separator + key + "=" + value;
    }
};

$("select.page-selector").on("change", function () {
    window.location = updateQueryStringParameter(location.href, "page", this.value);
});

jQuery.fn.extend({
    insertAtCaret (myValue) {
        return this.each(function () {
            if (document.selection) {
                // Internet Explorer
                this.focus();
                const sel = document.selection.createRange();
                sel.text = myValue;
                this.focus();
            } else if (this.selectionStart || this.selectionStart === "0") {
                // For browsers like Firefox and Webkit based
                const startPos = this.selectionStart;
                const endPos = this.selectionEnd;
                const scrollTop = this.scrollTop;
                this.value = this.value.substring(0, startPos) + myValue + this.value.substring(endPos, this.value.length);
                this.focus();
                this.selectionStart = startPos + myValue.length;
                this.selectionEnd = startPos + myValue.length;
                this.scrollTop = scrollTop;
            } else {
                this.value += myValue;
                this.focus();
            }
        });
    },
    toggleText (a, b) {
        return this.text(this.text() === b ? a : b);
    }

});

const replaceText = (elementId, replacementType) => {
    const txtarea = document.getElementById(elementId);
    const start = txtarea.selectionStart;
    const finish = txtarea.selectionEnd;
    const allText = txtarea.value;
    const sel = allText.substring(start, finish);
    if (!sel) {
        return false;
    } else {
        if (replacementType === "bkz") {
            txtarea.value = allText.substring(0, start) + `(bkz: ${sel})` + allText.substring(finish, allText.length);
        } else if (replacementType === "hede") {
            txtarea.value = allText.substring(0, start) + `\`${sel}\`` + allText.substring(finish, allText.length);
        } else if (replacementType === "swh") {
            txtarea.value = allText.substring(0, start) + `\`:${sel}\`` + allText.substring(finish, allText.length);
        } else if (replacementType === "spoiler") {
            txtarea.value = allText.substring(0, start) + `--\`spoiler\`--\n${sel}\n--\`spoiler\`--` + allText.substring(finish, allText.length);
        } else if (replacementType === "link") {
            const linkText = prompt("hangi adrese gidecek?", "http://");
            if (linkText !== "http://") {
                txtarea.value = allText.substring(0, start) + `[${linkText} ${sel}]` + allText.substring(finish, allText.length);
            }
        }
        return true;
    }
};

$("button#insert_bkz").on("click", function () {
    if (!replaceText("user_content_edit", "bkz")) {
        const bkzText = prompt("bkz verilecek başlık, #entry veya @yazar");
        if (bkzText) {
            $("textarea#user_content_edit").insertAtCaret(`(bkz: ${bkzText})`);
        }
    }
});

$("button#insert_hede").on("click", function () {
    if (!replaceText("user_content_edit", "hede")) {
        const hedeText = prompt("hangi başlık veya #entry için link oluşturulacak?");
        if (hedeText) {
            $("textarea#user_content_edit").insertAtCaret(`\`${hedeText}\``);
        }
    }
});

$("button#insert_swh").on("click", function () {
    if (!replaceText("user_content_edit", "swh")) {
        const swhText = prompt("yıldız içinde ne görünecek?");
        if (swhText) {
            $("textarea#user_content_edit").insertAtCaret(`\`:${swhText}\``);
        }
    }
});

$("button#insert_spoiler").on("click", function () {
    if (!replaceText("user_content_edit", "spoiler")) {
        const spoilerText = prompt("spoiler arasına ne yazılacak?");
        if (spoilerText) {
            $("textarea#user_content_edit").insertAtCaret(`--\`spoiler\`--\n${spoilerText}\n--\`spoiler\`--`);
        }
    }
});

$("button#insert_link").on("click", function () {
    if (!replaceText("user_content_edit", "link")) {
        const linkText = prompt("hangi adrese gidecek?", "http://");
        if (linkText && linkText !== "http://") {
            const linkName = prompt(" verilecek linkin adı ne olacak?");
            if (linkName) {
                $("textarea#user_content_edit").insertAtCaret(`[${linkText} ${linkName}]`);
            }
        }
    }
});

$("a.favorite[role='button']").on("click", function () {
    const self = this;
    const pk = $(self).parents(".entry-full").attr("data-id");
    const query = `mutation { entry { favorite(pk: "${pk}") { feedback count } } }`;

    $.post("/graphql/", JSON.stringify({ query }), function (response) {
        const count = response.data.entry.favorite.count;
        const countHolder = $(self).next();

        $(self).toggleClass("active");
        countHolder.text(count);

        if (count === 0) {
            countHolder.text("");
        }

        $(self).siblings("span.favorites-list").attr("data-loaded", "false");
    }).fail(function () {
        notify("bir şeyler yanlış gitti", "error");
    });
});

$(document).on("click", "footer.entry-footer > .feedback > .favorites .dropdown-menu, #dropdown_detailed_search :not(#close_search_dropdown), .autocomplete-suggestions", e => {
    e.stopPropagation();
});

$("a.fav-count[role='button']").on("click", function () {
    const self = this;
    const favoritesList = $(self).next();

    if (favoritesList.attr("data-loaded") === "true") {
        return;
    }

    const pk = $(self).closest(".entry-full").attr("data-id");

    const query = `{ entry{ favoriters(pk:${pk}){ username slug isNovice } } } `;

    $.post("/graphql/", JSON.stringify({ query }), function (response) {
        const allUsers = response.data.entry.favoriters;
        const authors = allUsers.filter(user => user.isNovice === false);
        const novices = allUsers.filter(user => user.isNovice === true);

        favoritesList.html("");

        if (authors.length > 0) {
            for (const author of authors) {
                favoritesList.append(`<a class="author" href="/biri/${author.slug}/">@${author.username}</a>`);
            }
        }

        if (novices.length > 0) {
            favoritesList.append(`<a id="show_novice_button" role="button" tabindex="0">... ${novices.length} çaylak</a><span class="dj-hidden" id="favorites_list_novices"></span>`);

            $("a#show_novice_button").on("click", function () {
                $("#favorites_list_novices").toggleClass("dj-hidden");
            });

            for (const novice of novices) {
                $("#favorites_list_novices").append(`<a class="novice" href="/biri/${novice.slug}/">@${novice.username}</a>`);
            }
        }

        favoritesList.attr("data-loaded", "true");
    }).fail(function () {
        notify("bir şeyler yanlış gitti", "error");
    });
});

$("a#message_history_show").on("click", function () {
    $("ul#message_list li.bubble").css("display", "list-item");
    $(this).toggle();
});

const userAction = function (type, recipient) {
    const query = `mutation { user { ${type}(username: "${recipient}") { feedback redirect } } }`;
    $.post("/graphql/", JSON.stringify({ query }), function (response) {
        const info = response.data.user[type];
        if (info.redirect) {
            window.location.replace(info.redirect);
        } else {
            notify(info.feedback);
        }
    }).fail(function () {
        notify("bir şeyler yanlış gitti", "error");
    });
};

const showBlockDialog = function (recipient) {
    $("#block_user").attr("data-username", recipient);
    $("#username-holder").text(recipient);
    $("#blockUserModal").modal("show");
};

const showMessageDialog = function (recipient, extraContent) {
    const msgModal = $("#sendMessageModal");
    $("#sendMessageModal span.username").text(recipient);
    $("#sendMessageModal textarea#message_body").val(extraContent);
    msgModal.attr("data-for", recipient);
    msgModal.modal("show");
};

$(".entry-actions").on("click", ".block-user-trigger", function () {
    const recipient = $(this).parent().siblings(".username").text();
    showBlockDialog(recipient);
});

$("#block_user").on("click", function () {
    const targetUser = $(this).attr("data-username");
    userAction("block", targetUser);
    $("#blockUserModal").modal("hide");
});

$(".unblock-user-trigger").on("click", function () {
    if (confirm("engel kalksın mı?")) {
        userAction("block", $(this).attr("data-username"));
        $(this).hide();
    }
});

$(".follow-user-trigger").on("click", function () {
    const targetUser = $(this).parent().attr("data-username");
    userAction("follow", targetUser);
    $(this).children("a").toggleText("takip et", "takip etme");
});

const entryAction = function (type, pk, redirect = false) {
    const query = `mutation { entry { ${type}(pk: "${pk}") { feedback ${redirect ? "redirect" : ""}} } }`;
    return $.post("/graphql/", JSON.stringify({ query })).fail(function () {
        notify("bir şeyler yanlış gitti", "error");
    });
};

$("a.upvote[role='button']").on("click", function () {
    const entryId = $(this).parents(".entry-full").attr("data-id");
    const self = $(this);
    entryAction("upvote", entryId).then(function (response) {
        const feedback = response.data.entry.upvote.feedback;
        if (feedback === null) {
            // success
            self.siblings("a.downvote[role='button']").removeClass("active");
            self.toggleClass("active");
        } else {
            notify(feedback, "error", 4000);
        }
    });
});

$("a.downvote[role='button']").on("click", function () {
    const entryId = $(this).parents(".entry-full").attr("data-id");
    const self = $(this);
    entryAction("downvote", entryId).then(function (response) {
        const feedback = response.data.entry.downvote.feedback;
        if (feedback === null) {
            self.siblings("a.upvote[role='button']").removeClass("active");
            self.toggleClass("active");
        } else {
            notify(feedback, "error", 4000);
        }
    });
});

$(".entry-actions").on("click", ".delete-entry", function () {
    if (confirm("harbiden silinsin mi?")) {
        const entry = $(this).parents(".entry-full");
        const redirect = $("ul.topic-view-entries li.entry-full").length === 1;

        entryAction("delete", entry.attr("data-id"), redirect).then(function (response) {
            const data = response.data.entry.delete;
            if (redirect) {
                window.location.replace(data.redirect);
            } else {
                entry.remove();
                notify(data.feedback);
            }
        });
    }
});

$(".delete-entry-redirect").on("click", function () {
    if (confirm("harbiden silinsin mi?")) {
        entryAction("delete", $(this).attr("data-target-entry"), true).then(function (response) {
            window.location.replace(response.data.entry.delete.redirect);
        });
    }
});

$(".entry-actions").on("click", ".pin-entry", function () {
    entryAction("pin", $(this).parents(".entry-full").attr("data-id")).then(function (response) {
        notify(response.data.entry.pin.feedback);
    });
});

const topicAction = function (type, pk) {
    const query = `mutation { topic { ${type}(pk: "${pk}") { feedback } } }`;
    $.post("/graphql/", JSON.stringify({ query }), function (response) {
        const info = response.data.topic[type];
        notify(info.feedback);
    }).fail(function () {
        notify("bir şeyler yanlış gitti", "error");
    });
};

$(".follow-topic-trigger").on("click", function () {
    $(this).toggleText("takip etme", "takip et");
    topicAction("follow", $(this).attr("data-topic-id"));
});

$("select#mobile_year_changer").on("change", function () {
    window.location = updateQueryStringParameter(location.href, "year", this.value);
});

$.fn.overflown = function () {
    const e = this[0];
    return e.scrollHeight > e.clientHeight || e.scrollWidth > e.clientWidth;
};

const truncateEntryText = () => {
    for (const element of $("article.entry p ")) {
        if ($(element).overflown()) {
            $(element).parent().append(`<div role="button" tabindex="0" class="read_more">devamını okuyayım</div>`);
        }
    }
};

window.onload = function () {
    if ($("body").hasClass("has-entries")) {
        truncateEntryText();
        $("div.read_more").on("click", function () {
            $(this).siblings("p").css("max-height", "none");
            $(this).hide();
        });
    }
};

const populateSearchResults = searchParameters => {
    if (!searchParameters) {
        return;
    }

    const slug = "hayvan-ara";

    if (userIsMobile) {
        window.location.replace(`/basliklar/${slug}/?${searchParameters}`);
    }
    LeftFrame.populate(slug, 1, null, searchParameters);
};

$("button#perform_advanced_search").on("click", function () {
    const keywords = $("input#keywords_dropdown").val();
    const authorNick = $("input#author_nick_dropdown").val();
    const isNiceOnes = $("input#nice_ones_dropdown").is(":checked");
    const isFavorites = $("input#in_favorites_dropdown").is(":checked");
    const fromDate = $("input#date_from_dropdown").val();
    const toDate = $("input#date_to_dropdown").val();
    const ordering = $("select#ordering_dropdown").val();

    const keys = {
        keywords,
        author_nick: authorNick,
        is_nice_ones: isNiceOnes,
        is_in_favorites: isFavorites,
        from_date: fromDate,
        to_date: toDate,
        ordering
    };
    populateSearchResults(dictToParameters(keys));
});

const categoryAction = function (type, pk) {
    const query = `mutation { category { ${type}(pk: "${pk}") { feedback } } }`;
    $.post("/graphql/", JSON.stringify({ query })).fail(function () {
        notify("bir şeyler yanlış gitti", "error");
    });
};

const composeMessage = function (recipient, body) {
    const variables = { recipient, body };
    const query = `mutation compose($body: String!, $recipient: String!) { message { compose(body: $body, recipient: $recipient) { feedback } } }`;
    $.post("/graphql/", JSON.stringify({ query, variables }), function (response) {
        notify(response.data.message.compose.feedback);
    }).fail(function () {
        notify("o mesaj gitmedi yalnız", "error");
    });
};

$(".entry-actions").on("click", ".send-message-trigger", function () {
    const recipient = $(this).parent().siblings(".username").text();
    const entryInQuestion = $(this).parents(".entry-full").attr("data-id");
    showMessageDialog(recipient, `\`#${entryInQuestion}\` hakkında:\n`);
});

$("#send_message_btn").on("click", function () {
    const textarea = $("#sendMessageModal textarea");
    const msgModal = $("#sendMessageModal");
    const body = textarea.val();

    if (body.length < 3) {
        // not strictly needed but written so as to reduce api calls.
        notify("az bir şeyler yaz yeğenim");
        return;
    }

    const recipient = msgModal.attr("data-for");
    msgModal.modal("hide");
    composeMessage(recipient, body);
    textarea.val("");
});

$("button#follow-category-trigger").on("click", function () {
    categoryAction("follow", $(this).data("category-id"));
    $(this).toggleText("bırak ya", "takip et");
    $(this).toggleClass("faded");
});

$("form.search_mobile, form.reporting-form").submit(function () {
    const emptyFields = $(this).find(":input").filter(function () {
        return $(this).val() === "";
    });
    emptyFields.prop("disabled", true);
    return true;
});

$("body").on("keypress", "[role=button]", function (event) {
    if (event.which === 13 || event.which === 32) { // space or enter
        $(this).trigger("click");
    }
});

$("a[role=button].quicksearch").on("click", function () {
    const term = $(this).attr("data-keywords");
    let parameter;
    if (term.startsWith("@") && term.substr(1)) {
        parameter = `author_nick=${term.substr(1)}`;
    } else {
        parameter = `keywords=${term}`;
    }
    const searchParameters = parameter + "&ordering=newer";
    populateSearchResults(searchParameters);
});

$("#left-frame-nav").scroll(function () {
    localStorage.setItem("where", $(this).scrollTop());
});

$(".entry-full a.action[role='button']").on("click", function () {
    if ($(this).hasClass("loaded")) {
        return;
    }

    const entry = $(this).parents(".entry-full");
    const entryID = entry.attr("data-id");
    const topicTitle = entry.attr("data-topic");
    const actions = $(this).siblings(".entry-actions");
    const authenticated = $("meta[name=authentication]").attr("content") === "1";

    actions.empty();

    if (authenticated) {
        if (entry.hasClass("owner")) {
            actions.append(`<a role="button" tabindex="0" class="dropdown-item pin-entry">profilime sabitle</a>`);
            actions.append(`<a role="button" tabindex="0" class="dropdown-item delete-entry">sil</a>`);
            actions.append(`<a href="/entry/update/${entryID}/" class="dropdown-item">düzelt</a>`);
        } else {
            if (!entry.hasClass("private")) {
                actions.append(`<a role="button" tabindex="0" class="dropdown-item send-message-trigger">mesaj gönder</a>`);
                actions.append(`<a role="button" tabindex="0" class="dropdown-item block-user-trigger">engelle</a>`);
            }
        }
    }

    actions.append(`<a class="dropdown-item" href="/iletisim/?referrer_entry=${entryID}&referrer_topic=${topicTitle}">şikayet</a>`);
    $(this).addClass("loaded");
});

$("ul.user-links").on("click", "li.block-user a", function () {
    const recipient = $(this).parents(".user-links").attr("data-username");
    showBlockDialog(recipient);
});

$("ul.user-links").on("click", "li.send-message a", function () {
    const recipient = $(this).parents(".user-links").attr("data-username");
    showMessageDialog(recipient);
});

$(".block-user-trigger").on("click", function () {
    showBlockDialog($(this).attr("data-username"));
});

const wishTopic = function (title, hint = null) {
    const query = `mutation wish($title: String!, $hint: String){topic{wish(title: $title, hint: $hint){feedback hint}}}`;
    const variables = { title, hint };
    return $.post("/graphql/", JSON.stringify({ query, variables })).done(function (response) {
        notify(response.data.topic.wish.feedback);
    }).fail(function () {
        notify("bu işlemi şimdi gerçekleştiremiyoruz", "error");
    });
};

$("a.wish-prepare[role=button]").on("click", function () {
    $(this).siblings(":not(.wish-purge)").toggle();
    $(this).toggleText("biri bu başlığı doldursun", "boşver");
});

$("a.wish-send[role=button]").on("click", function () {
    const self = $(this);
    const textarea = self.siblings("textarea");
    const title = self.parent().attr("data-topic");
    const hint = textarea.val();
    wishTopic(title, hint).then(function (response) {
        textarea.val("");
        self.toggle();
        self.siblings().toggle();
        const hintFormatted = response.data.topic.wish.hint;
        $("ul#wish-list").show().prepend(`<li class="list-group-item owner">bu başlığa az önce ukte verdiniz. ${hintFormatted ? `notunuz: <p class="m-0"><i>${hintFormatted.replace(/\n/g, "<br>")}</i></p>` : ""}</li>`);
        $(window).scrollTop(0);
    });
});

$("a.wish-purge[role=button]").on("click", function () {
    const self = $(this);
    const title = self.parent().attr("data-topic");
    if (confirm("harbiden silinsin mi?")) {
        wishTopic(title).then(function () {
            self.toggle();
            self.siblings(".wish-prepare").text("biri bu başlığı doldursun").toggle();
            $("ul#wish-list").children("li.owner").hide();
        });
    }
});
