/**
 * Every word the site says to a reader or a contributor, in both languages.
 *
 * This is the shipped wording. The owner can change any line of it from
 * Settings - Wording, and what he writes is stored in the database and used
 * instead. Nothing here is edited to change the site's wording: that is the
 * point of the screen.
 *
 * `{name}` style placeholders are filled in at the point of use. A translation
 * that loses one just loses that piece of information, so they are listed in
 * the note beside each line that has one.
 */

export type TextEntry = {
  /** Heading it sits under on the Wording screen. */
  group: string;
  en: string;
  bn: string;
  /** Shown to the owner so he knows where the line appears. */
  note?: string;
};

export const TEXT_GROUPS = [
  "Menu and buttons",
  "Section names",
  "Front page",
  "Article page",
  "Writer pages",
  "Footer and invitation",
  "Writing a piece",
  "Sending it in",
  "The other language",
] as const;

export const TEXT_DEFAULTS: Record<string, TextEntry> = {
  // --- Menu and buttons ---------------------------------------------------
  "nav.latest": { group: "Menu and buttons", en: "Latest", bn: "সর্বশেষ", note: "First item in the section menu" },
  "nav.signIn": { group: "Menu and buttons", en: "Sign in", bn: "সাইন ইন" },
  "nav.writeForUs": { group: "Menu and buttons", en: "Write for us", bn: "আমাদের জন্য লিখুন" },
  "nav.myDesk": { group: "Menu and buttons", en: "My desk", bn: "আমার ডেস্ক" },
  "nav.newsroom": { group: "Menu and buttons", en: "Newsroom", bn: "নিউজরুম" },
  "nav.signOut": { group: "Menu and buttons", en: "Sign out", bn: "সাইন আউট" },
  "nav.account": { group: "Menu and buttons", en: "Account", bn: "অ্যাকাউন্ট" },

  // --- Section names ------------------------------------------------------
  "section.All": { group: "Section names", en: "All", bn: "সব" },
  "section.Politics": { group: "Section names", en: "Politics", bn: "রাজনীতি" },
  "section.LawAndOrder": { group: "Section names", en: "Law and order", bn: "আইনশৃঙ্খলা" },
  "section.Technology": { group: "Section names", en: "Technology", bn: "প্রযুক্তি" },
  "section.Economy": { group: "Section names", en: "Economy", bn: "অর্থনীতি" },
  "section.World": { group: "Section names", en: "World", bn: "বিশ্ব" },
  "section.Opinion": { group: "Section names", en: "Opinion", bn: "মতামত" },
  "section.Culture": { group: "Section names", en: "Culture", bn: "সংস্কৃতি" },
  "section.Literature": { group: "Section names", en: "Literature", bn: "সাহিত্য" },
  "section.Philosophy": { group: "Section names", en: "Philosophy", bn: "দর্শন" },
  "section.Science": { group: "Section names", en: "Science", bn: "বিজ্ঞান" },
  "section.Entertainment": { group: "Section names", en: "Entertainment", bn: "বিনোদন" },
  "section.Lifestyle": { group: "Section names", en: "Lifestyle", bn: "লাইফস্টাইল" },
  "section.Career": { group: "Section names", en: "Career", bn: "ক্যারিয়ার" },
  "section.General": { group: "Section names", en: "General", bn: "সাধারণ" },

  // --- Front page ---------------------------------------------------------
  "feed.alsoToday": { group: "Front page", en: "Also today", bn: "আজকের আরও খবর", note: "Heading over the left-hand column" },
  "feed.featured": { group: "Front page", en: "Featured", bn: "নির্বাচিত", note: "Heading over the right-hand column" },
  "feed.moreFromContributors": {
    group: "Front page",
    en: "More from our contributors",
    bn: "আমাদের লেখকদের আরও লেখা",
  },
  "feed.nothingHere": {
    group: "Front page",
    en: "Nothing published in this section yet.",
    bn: "এই বিভাগে এখনও কিছু প্রকাশিত হয়নি।",
  },
  "feed.inSection": {
    group: "Front page",
    en: "{name} news",
    bn: "{name} সংবাদ",
    note: "Heading on a section page. {name} is the section.",
  },

  // --- Article page -------------------------------------------------------
  "article.relatedTitle": { group: "Article page", en: "More on this", bn: "আরও পড়ুন" },
  "article.minRead": { group: "Article page", en: "{n} min read", bn: "{n} মিনিটের পড়া", note: "{n} is the number of minutes" },
  "article.moreMedia": { group: "Article page", en: "More media", bn: "আরও ছবি ও ভিডিও" },
  "article.evidenceTitle": { group: "Article page", en: "Evidence", bn: "প্রমাণ" },
  "article.evidenceNote": {
    group: "Article page",
    en: "Photographs and video filed with this report, checked and chosen by the desk.",
    bn: "এই প্রতিবেদনের সঙ্গে জমা দেওয়া ছবি ও ভিডিও, সম্পাদকের যাচাই ও নির্বাচন করা।",
  },

  // --- Writer pages -------------------------------------------------------
  "writer.verified": { group: "Writer pages", en: "Verified contributor", bn: "যাচাইকৃত লেখক" },
  "writer.contributor": { group: "Writer pages", en: "Contributor", bn: "লেখক" },
  "writer.about": { group: "Writer pages", en: "About {name}", bn: "{name} সম্পর্কে", note: "{name} is the writer" },
  "writer.defaultBio": {
    group: "Writer pages",
    en: "Contributor at The Document.",
    bn: "দ্য ডকুমেন্ট-এর লেখক।",
    note: "Used when a writer has not written their own description",
  },
  "writer.byThisWriter": {
    group: "Writer pages",
    en: "{n} published articles",
    bn: "প্রকাশিত {n}টি লেখা",
    note: "{n} is how many",
  },

  // --- Footer and invitation ----------------------------------------------
  "cta.title": { group: "Footer and invitation", en: "Write for The Document", bn: "দ্য ডকুমেন্ট-এ লিখুন" },
  "cta.body": {
    group: "Footer and invitation",
    en: "Open an account, draft your piece with photos or video, and submit it. An editor reads every submission before it is published - and sets the payout you earn for it.",
    bn: "অ্যাকাউন্ট খুলুন, ছবি বা ভিডিও সহ আপনার লেখা তৈরি করুন এবং জমা দিন। প্রকাশের আগে একজন সম্পাদক প্রতিটি লেখা পড়েন এবং আপনার সম্মানী নির্ধারণ করেন।",
  },
  "cta.button": { group: "Footer and invitation", en: "Become a contributor", bn: "লেখক হিসেবে যোগ দিন" },
  "footer.tagline": {
    group: "Footer and invitation",
    en: "news written by its readers, checked by its editors.",
    bn: "পাঠকদের লেখা, সম্পাদকদের যাচাই করা সংবাদ।",
    note: "Also editable per language in Settings - Wording above",
  },

  // --- The other language -------------------------------------------------
  "lang.readInOther": {
    group: "The other language",
    en: "বাংলায় পড়ুন",
    bn: "Read in English",
    note: "The button offering the other language, so it is written IN that other language",
  },
  "lang.notTranslatedYet": {
    group: "The other language",
    en: "This piece has not been translated yet.",
    bn: "এই লেখাটির অনুবাদ এখনও হয়নি।",
  },
  "lang.translatedBy": { group: "The other language", en: "Translated by {name}", bn: "অনুবাদ: {name}" },
  "lang.originalLanguageNote": {
    group: "The other language",
    en: "Originally written in Bangla",
    bn: "মূল লেখা ইংরেজিতে",
  },

  // --- Writing a piece ----------------------------------------------------
  "compose.headline": { group: "Writing a piece", en: "Headline", bn: "শিরোনাম", note: "Grey text in the empty headline box" },
  "compose.dek": {
    group: "Writing a piece",
    en: "One-line summary shown in the feed",
    bn: "তালিকায় দেখানো এক লাইনের সারসংক্ষেপ",
  },
  "compose.body": {
    group: "Writing a piece",
    en: "Write your piece here.\n\nBlank line starts a new paragraph. Use the buttons above for bold, italics and subtitles.",
    bn: "আপনার লেখা এখানে লিখুন।\n\nফাঁকা লাইন দিলে নতুন অনুচ্ছেদ শুরু হয়। মোটা অক্ষর, বাঁকা অক্ষর ও উপশিরোনামের জন্য উপরের বোতামগুলো ব্যবহার করুন।",
  },
  "compose.section": { group: "Writing a piece", en: "Section", bn: "বিভাগ" },
  "compose.writingIn": { group: "Writing a piece", en: "Writing in", bn: "যে ভাষায় লিখছেন" },
  "compose.editorWritesOther": {
    group: "Writing a piece",
    en: "An editor writes the {other} version.",
    bn: "{other} সংস্করণটি একজন সম্পাদক লিখবেন।",
    note: "{other} is the other language",
  },
  "compose.bylineLabel": {
    group: "Writing a piece",
    en: "Set a contributor name for this article:",
    bn: "এই লেখাটির জন্য লেখকের নাম দিন:",
    note: "Newsroom staff only",
  },
  "compose.bylineNote": {
    group: "Writing a piece",
    en: "Readers see this name on the front page and on the article.",
    bn: "পাঠকরা প্রথম পাতায় ও লেখার পাতায় এই নামটিই দেখবেন।",
  },
  "compose.mediaTitle": { group: "Writing a piece", en: "Photos and video", bn: "ছবি ও ভিডিও" },
  "compose.mediaNote": {
    group: "Writing a piece",
    en: "Images up to 8 MB, clips up to 128 MB. The first photo becomes the cover.",
    bn: "ছবি সর্বোচ্চ ৮ এমবি, ভিডিও সর্বোচ্চ ১২৮ এমবি। প্রথম ছবিটিই প্রচ্ছদ হবে।",
  },
  "compose.mediaEmpty": { group: "Writing a piece", en: "No media attached yet.", bn: "এখনও কোনো ছবি বা ভিডিও যুক্ত করা হয়নি।" },
  "compose.attach": { group: "Writing a piece", en: "Attach media", bn: "ছবি বা ভিডিও যুক্ত করুন" },
  "compose.uploading": { group: "Writing a piece", en: "Uploading...", bn: "আপলোড হচ্ছে..." },
  "compose.remove": { group: "Writing a piece", en: "Remove", bn: "সরান" },
  "compose.saveDraft": { group: "Writing a piece", en: "Save draft", bn: "খসড়া সংরক্ষণ করুন" },
  "compose.saved": {
    group: "Writing a piece",
    en: "Draft saved. You can close this and come back to it any time.",
    bn: "খসড়া সংরক্ষিত হয়েছে। আপনি এটি বন্ধ করে যেকোনো সময় ফিরে আসতে পারেন।",
  },

  // --- Sending it in ------------------------------------------------------
  "submit.button": { group: "Sending it in", en: "Submit for review", bn: "যাচাইয়ের জন্য জমা দিন" },
  "submit.resubmit": { group: "Sending it in", en: "Resubmit", bn: "আবার জমা দিন" },
  "submit.locked": {
    group: "Sending it in",
    en: "Locked while an editor reviews it",
    bn: "সম্পাদক যাচাই করার সময় এটি সম্পাদনা করা যাবে না",
  },
  "submit.published": {
    group: "Sending it in",
    en: "Published - edits go through the desk",
    bn: "প্রকাশিত - পরিবর্তনের জন্য সম্পাদকের কাছে যেতে হবে",
  },
  "submit.changesRequested": { group: "Sending it in", en: "Changes requested", bn: "পরিবর্তন চাওয়া হয়েছে" },
  "submit.editorNote": { group: "Sending it in", en: "Editor note", bn: "সম্পাদকের মন্তব্য" },
  "submit.contactTitle": {
    group: "Sending it in",
    en: "How the desk can reach you about this piece",
    bn: "এই লেখাটি নিয়ে নিউজরুম কীভাবে আপনার সঙ্গে যোগাযোগ করবে",
  },
  "submit.phone": { group: "Sending it in", en: "Phone", bn: "ফোন" },
  "submit.whatsapp": { group: "Sending it in", en: "WhatsApp (optional)", bn: "হোয়াটসঅ্যাপ (ঐচ্ছিক)" },
  "submit.contactNote": {
    group: "Sending it in",
    en: "Required before you submit. Editors often need one question answered before a story can run. Readers never see these numbers.",
    bn: "জমা দেওয়ার আগে এটি দিতে হবে। সংবাদ প্রকাশের আগে সম্পাদকের প্রায়ই একটি প্রশ্নের উত্তর প্রয়োজন হয়। পাঠকরা এই নম্বর কখনও দেখবেন না।",
  },
  "submit.witnessLabel": {
    group: "Sending it in",
    en: "If you know of anyone who saw this happen, write their name, address and phone number:",
    bn: "বর্ণিত সংবাদ বা ঘটনার কোনো প্রত্যক্ষদর্শী ও সাক্ষীর পরিচয় জানা থাকলে তাদের নাম, ঠিকানা, ও ফোন নাম্বার লিখুন:",
  },
  "submit.witnessNote": {
    group: "Sending it in",
    en: "Optional. Seen by the newsroom only, never published.",
    bn: "ঐচ্ছিক। শুধু নিউজরুম দেখবে, কখনও প্রকাশ করা হবে না।",
  },
  "submit.failed": { group: "Sending it in", en: "Could not submit this piece.", bn: "এই লেখাটি জমা দেওয়া যায়নি।" },
  "submit.done": { group: "Sending it in", en: "Submitted for review", bn: "যাচাইয়ের জন্য জমা দেওয়া হয়েছে" },
  "submit.backToDesk": { group: "Sending it in", en: "Back to my desk", bn: "আমার ডেস্কে ফিরুন" },
  "submit.viewPiece": { group: "Sending it in", en: "View the piece", bn: "লেখাটি দেখুন" },
  "submit.viewPublished": {
    group: "Sending it in",
    en: "View the published article",
    bn: "প্রকাশিত লেখাটি দেখুন",
  },
};

export type TextKey = keyof typeof TEXT_DEFAULTS;
