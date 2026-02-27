<?php
/**
 * IonMan DNS - Category-based blocking
 * Toggle blocking of social media, streaming, gaming, etc.
 */

$conn = db();

$categories = [
    'social' => [
        'label' => 'Social Media',
        'description' => 'Facebook, Twitter/X, Instagram, TikTok, Snapchat, Reddit, Pinterest, LinkedIn, Threads, WhatsApp',
        'domains' => [
            // Facebook
            'facebook.com', 'www.facebook.com', 'web.facebook.com', 'm.facebook.com',
            'static.xx.fbcdn.net', 'fbcdn.net', 'fb.com', 'fbsbx.com',
            'messenger.com', 'www.messenger.com',
            // Instagram
            'instagram.com', 'www.instagram.com', 'i.instagram.com', 'graph.instagram.com',
            'scontent.cdninstagram.com',
            // Twitter/X
            'twitter.com', 'www.twitter.com', 'x.com', 'www.x.com',
            'api.twitter.com', 'mobile.twitter.com', 'tweetdeck.twitter.com',
            'abs.twimg.com', 'pbs.twimg.com',
            // TikTok
            'tiktok.com', 'www.tiktok.com', 'vm.tiktok.com', 'm.tiktok.com',
            'p16-sign.tiktokcdn-us.com', 'v16-webapp.tiktok.com',
            'tiktokcdn.com', 'musical.ly',
            // Snapchat
            'snapchat.com', 'www.snapchat.com', 'app.snapchat.com',
            'sc-cdn.net', 'snap-dev.net',
            // Reddit
            'reddit.com', 'www.reddit.com', 'old.reddit.com', 'i.redd.it', 'v.redd.it',
            // Pinterest
            'pinterest.com', 'www.pinterest.com', 'i.pinimg.com',
            // LinkedIn
            'linkedin.com', 'www.linkedin.com', 'static.licdn.com',
            // Threads
            'threads.net', 'www.threads.net',
            // WhatsApp
            'web.whatsapp.com', 'whatsapp.com', 'www.whatsapp.com',
            // Telegram
            'telegram.org', 'web.telegram.org', 't.me',
            // Discord
            'discord.com', 'www.discord.com', 'cdn.discordapp.com', 'gateway.discord.gg',
            // Viber
            'viber.com', 'www.viber.com',
            // Tumblr
            'tumblr.com', 'www.tumblr.com',
            // Mastodon
            'mastodon.social', 'mastodon.online',
        ],
    ],
    'streaming' => [
        'label' => 'Streaming & Video',
        'description' => 'YouTube, Netflix, Disney+, Hulu, HBO Max, Twitch, Spotify, Apple TV+, Prime Video, Crunchyroll &amp; more',
        'domains' => [
            // YouTube
            'youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com',
            'youtu.be', 'ytimg.com', 'i.ytimg.com', 'googlevideo.com',
            'yt3.ggpht.com',
            // Netflix
            'netflix.com', 'www.netflix.com', 'assets.nflxext.com',
            'cdn-0.nflximg.com', 'api-global.netflix.com',
            // Disney+
            'disneyplus.com', 'www.disneyplus.com', 'disney-plus.net',
            'bamgrid.com', 'disney.api.edge.bamgrid.com',
            // Hulu
            'hulu.com', 'www.hulu.com', 'assetshuluimcom-a.akamaihd.net',
            // HBO Max / Max
            'hbomax.com', 'www.hbomax.com', 'max.com', 'www.max.com',
            'play.max.com',
            // Twitch
            'twitch.tv', 'www.twitch.tv', 'static.twitchcdn.net',
            'usher.ttvnw.net', 'clips.twitch.tv',
            // Spotify
            'spotify.com', 'open.spotify.com', 'audio-ak-spotify-com.akamaized.net',
            'heads4-ak-spotify-com.akamaized.net', 'spclient.wg.spotify.com',
            // Apple TV+
            'tv.apple.com', 'apple.com/apple-tv-plus',
            // Prime Video
            'primevideo.com', 'www.primevideo.com', 'atv-ps.amazon.com',
            // Crunchyroll
            'crunchyroll.com', 'www.crunchyroll.com', 'static.crunchyroll.com',
            // Peacock
            'peacocktv.com', 'www.peacocktv.com',
            // Paramount+
            'paramountplus.com', 'www.paramountplus.com',
            // Tubi
            'tubitv.com', 'www.tubitv.com',
            // Pluto TV
            'pluto.tv', 'www.pluto.tv',
            // Dailymotion
            'dailymotion.com', 'www.dailymotion.com',
            // Vimeo
            'vimeo.com', 'www.vimeo.com', 'player.vimeo.com',
            // SoundCloud
            'soundcloud.com', 'www.soundcloud.com',
            // Apple Music
            'music.apple.com', 'itunes.apple.com',
            // Amazon Music
            'music.amazon.com',
            // Deezer
            'deezer.com', 'www.deezer.com',
            // iQIYI
            'iqiyi.com', 'www.iqiyi.com',
            // Bilibili
            'bilibili.com', 'www.bilibili.com',
        ],
    ],
    'gaming' => [
        'label' => 'Gaming',
        'description' => 'Steam, Epic, PUBG, Mobile Legends, Roblox, Minecraft, Fortnite, Genshin Impact, Valorant, LoL &amp; more',
        'domains' => [
            // Steam
            'store.steampowered.com', 'steamcommunity.com', 'steampowered.com',
            'steamstatic.com', 'steamcdn-a.akamaihd.net',
            // Epic Games / Fortnite
            'epicgames.com', 'www.epicgames.com', 'store.epicgames.com',
            'fortnite.com', 'www.fortnite.com', 'cdn.unrealengine.com',
            // PUBG / Krafton
            'pubg.com', 'www.pubg.com', 'accounts.pubg.com',
            'pubgmobile.com', 'www.pubgmobile.com',
            'krafton.com', 'www.krafton.com',
            // Mobile Legends (Moonton)
            'mobilelegends.com', 'www.mobilelegends.com',
            'moonton.com', 'www.moonton.com',
            'm.mobilelegends.com', 'api.mobilelegends.com',
            // Roblox
            'roblox.com', 'www.roblox.com', 'web.roblox.com',
            'apis.roblox.com', 'assetgame.roblox.com',
            // Minecraft
            'minecraft.net', 'www.minecraft.net', 'mojang.com', 'www.mojang.com',
            // Genshin Impact / HoYoverse
            'genshin.hoyoverse.com', 'hoyoverse.com', 'www.hoyoverse.com',
            'mihoyo.com', 'www.mihoyo.com', 'honkaistarrail.com',
            // Valorant / Riot Games
            'playvalorant.com', 'www.playvalorant.com',
            'riotgames.com', 'www.riotgames.com', 'riot.games',
            'leagueoflegends.com', 'www.leagueoflegends.com',
            // Call of Duty
            'callofduty.com', 'www.callofduty.com', 'activision.com', 'www.activision.com',
            // Garena / Free Fire
            'garena.com', 'www.garena.com', 'ff.garena.com',
            // PlayStation
            'playstation.com', 'store.playstation.com', 'www.playstation.com',
            // Xbox
            'xbox.com', 'www.xbox.com', 'xbox.live.com',
            // EA / Origin
            'ea.com', 'www.ea.com', 'origin.com', 'www.origin.com',
            // Blizzard
            'blizzard.com', 'www.blizzard.com', 'battle.net', 'www.battle.net',
            // Ubisoft
            'ubisoft.com', 'www.ubisoft.com', 'ubi.com',
            // Clash of Clans / Supercell
            'supercell.com', 'www.supercell.com', 'clashofclans.com',
            // Genshin / Star Rail CDN
            'hoyolab.com', 'www.hoyolab.com',
            // Among Us
            'innersloth.com', 'www.innersloth.com',
            // Apex Legends
            'ea.com/games/apex-legends',
            // DOTA 2
            'dota2.com', 'www.dota2.com',
            // Nintendo
            'nintendo.com', 'www.nintendo.com', 'accounts.nintendo.com',
        ],
    ],
    'gambling' => [
        'label' => 'Gambling',
        'description' => 'Top 20 betting sites, casinos, poker rooms',
        'domains' => [
            'bet365.com', 'www.bet365.com',
            'pokerstars.com', 'www.pokerstars.com',
            'draftkings.com', 'www.draftkings.com',
            'fanduel.com', 'www.fanduel.com',
            'betway.com', 'www.betway.com',
            '888casino.com', 'www.888casino.com',
            'williamhill.com', 'www.williamhill.com',
            'bovada.lv', 'www.bovada.lv',
            'betfair.com', 'www.betfair.com',
            'paddypower.com', 'www.paddypower.com',
            'unibet.com', 'www.unibet.com',
            'bwin.com', 'www.bwin.com',
            'betmgm.com', 'www.betmgm.com',
            'caesars.com', 'www.caesars.com',
            'pointsbet.com', 'www.pointsbet.com',
            'stake.com', 'www.stake.com',
            '1xbet.com', 'www.1xbet.com',
            'bet9ja.com', 'www.bet9ja.com',
            'betsson.com', 'www.betsson.com',
            'ladbrokes.com', 'www.ladbrokes.com',
        ],
    ],
    'porn' => [
        'label' => 'Adult Content',
        'description' => 'Top 20 adult/NSFW websites',
        'domains' => [
            'pornhub.com', 'www.pornhub.com',
            'xvideos.com', 'www.xvideos.com',
            'xnxx.com', 'www.xnxx.com',
            'xhamster.com', 'www.xhamster.com',
            'redtube.com', 'www.redtube.com',
            'youporn.com', 'www.youporn.com',
            'onlyfans.com', 'www.onlyfans.com',
            'brazzers.com', 'www.brazzers.com',
            'chaturbate.com', 'www.chaturbate.com',
            'stripchat.com', 'www.stripchat.com',
            'cam4.com', 'www.cam4.com',
            'livejasmin.com', 'www.livejasmin.com',
            'spankbang.com', 'www.spankbang.com',
            'eporner.com', 'www.eporner.com',
            'tube8.com', 'www.tube8.com',
            'beeg.com', 'www.beeg.com',
            'fapello.com', 'www.fapello.com',
            'rule34.xxx', 'e621.net',
            'hentaihaven.xxx', 'nhentai.net',
        ],
    ],
    'movies' => [
        'label' => 'Movies & TV',
        'description' => 'Netflix, Disney+, HBO Max, Hulu, Prime Video, Apple TV+, Peacock, Paramount+, Tubi, iWantTFC, Viu, WeTV &amp; more',
        'domains' => [
            // Netflix
            'netflix.com', 'www.netflix.com', 'assets.nflxext.com',
            'cdn-0.nflximg.com', 'api-global.netflix.com',
            'nflxso.net', 'nflximg.net', 'nflxvideo.net',
            // Disney+
            'disneyplus.com', 'www.disneyplus.com', 'disney-plus.net',
            'bamgrid.com', 'disney.api.edge.bamgrid.com',
            'disneystreaming.com', 'cdn.registerdisney.go.com',
            // HBO Max / Max
            'hbomax.com', 'www.hbomax.com', 'max.com', 'www.max.com',
            'play.max.com', 'comet.hbo.com',
            // Hulu
            'hulu.com', 'www.hulu.com', 'assetshuluimcom-a.akamaihd.net',
            'hulustream.com', 'huluim.com',
            // Prime Video
            'primevideo.com', 'www.primevideo.com', 'atv-ps.amazon.com',
            'aiv-cdn.net', 'aiv-delivery.net',
            // Apple TV+
            'tv.apple.com', 'apple.com/apple-tv-plus',
            // Peacock
            'peacocktv.com', 'www.peacocktv.com',
            // Paramount+
            'paramountplus.com', 'www.paramountplus.com',
            // Tubi
            'tubitv.com', 'www.tubitv.com',
            // Pluto TV
            'pluto.tv', 'www.pluto.tv',
            // Crunchyroll
            'crunchyroll.com', 'www.crunchyroll.com', 'static.crunchyroll.com',
            // Funimation
            'funimation.com', 'www.funimation.com',
            // iWantTFC (Philippines)
            'iwanttfc.com', 'www.iwanttfc.com', 'tfc.tv', 'www.tfc.tv',
            // Viu (Asia)
            'viu.com', 'www.viu.com',
            // WeTV (Tencent)
            'wetv.vip', 'www.wetv.vip',
            // MUBI
            'mubi.com', 'www.mubi.com',
            // Rakuten Viki
            'viki.com', 'www.viki.com',
            // BritBox
            'britbox.com', 'www.britbox.com',
            // Starz
            'starz.com', 'www.starz.com',
            // Showtime
            'sho.com', 'www.sho.com', 'showtime.com', 'www.showtime.com',
            // Discovery+
            'discoveryplus.com', 'www.discoveryplus.com',
            // MGM+
            'mgmplus.com', 'www.mgmplus.com',
            // Curiosity Stream
            'curiositystream.com', 'www.curiositystream.com',
            // Plex
            'plex.tv', 'www.plex.tv', 'app.plex.tv',
            // Roku Channel
            'therokuchannel.roku.com',
            // iflix (SEA)
            'iflix.com', 'www.iflix.com',
            // Vidio (Indonesia)
            'vidio.com', 'www.vidio.com',
            // Hotstar (India/SEA)
            'hotstar.com', 'www.hotstar.com',
            // Shahid (Middle East)
            'shahid.mbc.net',
        ],
    ],
    'dating' => [
        'label' => 'Dating',
        'description' => 'Top 15 dating apps and sites',
        'domains' => [
            'tinder.com', 'www.tinder.com',
            'bumble.com', 'www.bumble.com',
            'match.com', 'www.match.com',
            'okcupid.com', 'www.okcupid.com',
            'hinge.co', 'www.hinge.co',
            'badoo.com', 'www.badoo.com',
            'pof.com', 'www.pof.com',
            'zoosk.com', 'www.zoosk.com',
            'eharmony.com', 'www.eharmony.com',
            'elitesingles.com', 'www.elitesingles.com',
            'coffee-meets-bagel.com', 'www.coffeemeetsbagel.com',
            'happn.com', 'www.happn.com',
            'grindr.com', 'www.grindr.com',
            'silversingles.com', 'www.silversingles.com',
            'ourtime.com', 'www.ourtime.com',
        ],
    ],
    'messaging' => [
        'label' => 'Messaging',
        'description' => 'WhatsApp, Telegram, Messenger, Signal, Viber, Line, WeChat, Skype, Slack, Teams, Zoom, Discord',
        'domains' => [
            // WhatsApp
            'web.whatsapp.com', 'whatsapp.com', 'www.whatsapp.com',
            'whatsapp.net', 'mmg.whatsapp.net', 'media.fna.whatsapp.net',
            // Telegram
            'telegram.org', 'web.telegram.org', 't.me',
            'telegram.me', 'cdn.telegram.org',
            // Facebook Messenger
            'messenger.com', 'www.messenger.com',
            // Signal
            'signal.org', 'www.signal.org', 'updates.signal.org',
            'chat.signal.org', 'storage.signal.org', 'cdn.signal.org', 'cdn2.signal.org',
            // Viber
            'viber.com', 'www.viber.com', 'dl.viber.com',
            // Line
            'line.me', 'www.line.me', 'liff.line.me',
            'd.line-scdn.net', 'obs.line-scdn.net',
            // WeChat
            'wechat.com', 'www.wechat.com', 'weixin.qq.com',
            'web.wechat.com', 'wx.qq.com', 'file.wx.qq.com',
            // Skype
            'skype.com', 'www.skype.com', 'web.skype.com',
            'login.skype.com', 'trouter.skype.com',
            // Slack
            'slack.com', 'www.slack.com', 'app.slack.com',
            'edgeapi.slack.com', 'files.slack.com',
            // Microsoft Teams
            'teams.microsoft.com', 'teams.live.com',
            'statics.teams.cdn.office.net',
            // Zoom
            'zoom.us', 'www.zoom.us', 'us02web.zoom.us',
            'us04web.zoom.us', 'us05web.zoom.us', 'us06web.zoom.us',
            // Discord
            'discord.com', 'www.discord.com', 'cdn.discordapp.com', 'gateway.discord.gg',
            // KakaoTalk
            'kakaotalk.com', 'www.kakaotalk.com',
            // Threema
            'threema.ch', 'www.threema.ch',
            // Imo
            'imo.im', 'www.imo.im',
        ],
    ],
    'ads' => [
        'label' => 'Ads & Tracking',
        'description' => 'Google Ads, DoubleClick, Facebook Pixel, TikTok Ads, ad networks & trackers — always on',
        'domains' => [
            // Google Ads
            'doubleclick.net', 'ad.doubleclick.net', 'googleads.g.doubleclick.net',
            'pubads.g.doubleclick.net', 'securepubads.g.doubleclick.net', 'pagead.l.doubleclick.net',
            'pagead2.googlesyndication.com', 'tpc.googlesyndication.com', 'googlesyndication.com',
            'googleadservices.com', 'www.googleadservices.com', 'adservice.google.com',
            'googletagmanager.com', 'googletagservices.com',
            'google-analytics.com', 'analytics.google.com',
            '2mdn.net', 's0.2mdn.net',
            'ads.youtube.com', 'imasdk.googleapis.com',
            // Facebook/Meta Ads
            'ads.facebook.com', 'an.facebook.com', 'pixel.facebook.com',
            'analytics.facebook.com', 'tr.facebook.com', 'ads.instagram.com',
            // TikTok Ads
            'ads.tiktok.com', 'analytics.tiktok.com', 'business-api.tiktok.com',
            // Ad Networks
            'admob.com', 'app-measurement.com', 'crashlytics.com',
            'criteo.com', 'static.criteo.net', 'taboola.com', 'cdn.taboola.com',
            'outbrain.com', 'widgets.outbrain.com',
            'amazon-adsystem.com', 'aax.amazon-adsystem.com',
            'media.net', 'adnxs.com', 'ib.adnxs.com',
            'rubiconproject.com', 'pubmatic.com', 'ads.pubmatic.com', 'openx.net',
            'adsrvr.org', 'match.adsrvr.org',
            'scorecardresearch.com', 'sb.scorecardresearch.com',
            'quantserve.com', 'moat.com', 'z.moatads.com',
            'appsflyer.com', 'adjust.com', 'branch.io',
            // Trackers
            'mixpanel.com', 'amplitude.com', 'segment.io', 'hotjar.com',
            'fullstory.com', 'clarity.ms', 'sentry.io', 'newrelic.com', 'bugsnag.com',
            // Mobile Ad SDKs
            'chartboost.com', 'vungle.com', 'unity3d.com', 'adcolony.com',
            'mopub.com', 'ads.inmobi.com',
        ],
    ],
];

// Get all currently blocked domains from custom_blacklist for category lookups
$blocked_lookup = [];
$bl_res = $conn->query("SELECT domain FROM custom_blacklist");
while ($row = $bl_res->fetch_assoc()) {
    $blocked_lookup[$row['domain']] = true;
}

// Brand grouping map: maps base domains to brand names
$brand_map = [
    // Social
    'facebook.com' => 'Facebook', 'fbcdn.net' => 'Facebook', 'fb.com' => 'Facebook', 'fbsbx.com' => 'Facebook',
    'facebook.net' => 'Facebook', 'fbpigeon.com' => 'Facebook',
    'messenger.com' => 'Messenger',
    'instagram.com' => 'Instagram', 'cdninstagram.com' => 'Instagram', 'i-fallback.instagram.com' => 'Instagram', 'graph-fallback.instagram.com' => 'Instagram',
    'twitter.com' => 'Twitter/X', 'x.com' => 'Twitter/X', 'twimg.com' => 'Twitter/X', 'tweetdeck.twitter.com' => 'Twitter/X',
    'tiktok.com' => 'TikTok', 'tiktokcdn.com' => 'TikTok', 'tiktokcdn-us.com' => 'TikTok', 'musical.ly' => 'TikTok',
    'tiktokv.com' => 'TikTok', 'byteoversea.com' => 'TikTok', 'byteimg.com' => 'TikTok', 'ibytedtos.com' => 'TikTok',
    'ibyteimg.com' => 'TikTok', 'muscdn.com' => 'TikTok', 'tiktokd.org' => 'TikTok', 'sgsnssdk.com' => 'TikTok',
    'bytedance.com' => 'TikTok', 'bytetcdn.com' => 'TikTok', 'bytegecko.com' => 'TikTok', 'pstatp.com' => 'TikTok',
    'ipstatp.com' => 'TikTok', 'ttlivecdn.com' => 'TikTok', 'ttwstatic.com' => 'TikTok',
    'snapchat.com' => 'Snapchat', 'sc-cdn.net' => 'Snapchat', 'snap-dev.net' => 'Snapchat',
    'reddit.com' => 'Reddit', 'redd.it' => 'Reddit',
    'pinterest.com' => 'Pinterest', 'pinimg.com' => 'Pinterest',
    'linkedin.com' => 'LinkedIn', 'licdn.com' => 'LinkedIn',
    'threads.net' => 'Threads',
    'whatsapp.com' => 'WhatsApp',
    'telegram.org' => 'Telegram', 't.me' => 'Telegram',
    'discord.com' => 'Discord', 'discordapp.com' => 'Discord', 'discord.gg' => 'Discord',
    'viber.com' => 'Viber', 'tumblr.com' => 'Tumblr',
    'mastodon.social' => 'Mastodon', 'mastodon.online' => 'Mastodon',
    // Streaming
    'youtube.com' => 'YouTube', 'youtu.be' => 'YouTube', 'ytimg.com' => 'YouTube', 'googlevideo.com' => 'YouTube', 'yt3.ggpht.com' => 'YouTube',
    'youtube-nocookie.com' => 'YouTube', 'yt4.ggpht.com' => 'YouTube', 'youtubei.googleapis.com' => 'YouTube',
    'netflix.com' => 'Netflix', 'nflxext.com' => 'Netflix', 'nflximg.com' => 'Netflix',
    'disneyplus.com' => 'Disney+', 'disney-plus.net' => 'Disney+', 'bamgrid.com' => 'Disney+',
    'hulu.com' => 'Hulu', 'hbomax.com' => 'HBO Max', 'max.com' => 'HBO Max',
    'twitch.tv' => 'Twitch', 'twitchcdn.net' => 'Twitch', 'ttvnw.net' => 'Twitch',
    'spotify.com' => 'Spotify',
    'primevideo.com' => 'Prime Video', 'crunchyroll.com' => 'Crunchyroll',
    'peacocktv.com' => 'Peacock', 'paramountplus.com' => 'Paramount+',
    'tubitv.com' => 'Tubi', 'pluto.tv' => 'Pluto TV',
    'dailymotion.com' => 'Dailymotion', 'vimeo.com' => 'Vimeo',
    'soundcloud.com' => 'SoundCloud', 'deezer.com' => 'Deezer',
    'iqiyi.com' => 'iQIYI', 'bilibili.com' => 'Bilibili',
    // Movies & TV
    'nflxso.net' => 'Netflix', 'nflximg.net' => 'Netflix', 'nflxvideo.net' => 'Netflix',
    'disneystreaming.com' => 'Disney+', 'registerdisney.go.com' => 'Disney+',
    'comet.hbo.com' => 'HBO Max',
    'hulustream.com' => 'Hulu', 'huluim.com' => 'Hulu',
    'aiv-cdn.net' => 'Prime Video', 'aiv-delivery.net' => 'Prime Video',
    'funimation.com' => 'Funimation',
    'iwanttfc.com' => 'iWantTFC', 'tfc.tv' => 'iWantTFC',
    'viu.com' => 'Viu', 'wetv.vip' => 'WeTV',
    'mubi.com' => 'MUBI', 'viki.com' => 'Viki',
    'britbox.com' => 'BritBox', 'starz.com' => 'Starz',
    'sho.com' => 'Showtime', 'showtime.com' => 'Showtime',
    'discoveryplus.com' => 'Discovery+', 'mgmplus.com' => 'MGM+',
    'curiositystream.com' => 'Curiosity Stream',
    'plex.tv' => 'Plex', 'therokuchannel.roku.com' => 'Roku Channel',
    'iflix.com' => 'iflix', 'vidio.com' => 'Vidio',
    'hotstar.com' => 'Hotstar', 'shahid.mbc.net' => 'Shahid',
    // Specific subdomain overrides (broader parent domains like apple.com, amazon.com)
    'tv.apple.com' => 'Apple TV+', 'apple.com/apple-tv-plus' => 'Apple TV+',
    'atv-ps.amazon.com' => 'Prime Video',
    'assetshuluimcom-a.akamaihd.net' => 'Hulu',
    'cdn.registerdisney.go.com' => 'Disney+',
    'music.apple.com' => 'Apple Music', 'itunes.apple.com' => 'Apple Music',
    'music.amazon.com' => 'Amazon Music',
    // Gaming
    'steampowered.com' => 'Steam', 'steamcommunity.com' => 'Steam', 'steamstatic.com' => 'Steam', 'steamcdn-a.akamaihd.net' => 'Steam',
    'epicgames.com' => 'Epic Games', 'fortnite.com' => 'Fortnite', 'unrealengine.com' => 'Epic Games',
    'pubg.com' => 'PUBG', 'pubgmobile.com' => 'PUBG', 'krafton.com' => 'PUBG',
    'mobilelegends.com' => 'Mobile Legends', 'moonton.com' => 'Mobile Legends',
    'roblox.com' => 'Roblox', 'minecraft.net' => 'Minecraft', 'mojang.com' => 'Minecraft',
    'hoyoverse.com' => 'HoYoverse', 'mihoyo.com' => 'HoYoverse', 'honkaistarrail.com' => 'HoYoverse', 'hoyolab.com' => 'HoYoverse',
    'playvalorant.com' => 'Valorant', 'riotgames.com' => 'Riot Games', 'riot.games' => 'Riot Games', 'leagueoflegends.com' => 'Riot Games',
    'callofduty.com' => 'Call of Duty', 'activision.com' => 'Activision',
    'garena.com' => 'Garena/Free Fire',
    'playstation.com' => 'PlayStation', 'xbox.com' => 'Xbox', 'xbox.live.com' => 'Xbox',
    'ea.com' => 'EA', 'origin.com' => 'EA Origin',
    'blizzard.com' => 'Blizzard', 'battle.net' => 'Blizzard',
    'ubisoft.com' => 'Ubisoft', 'ubi.com' => 'Ubisoft',
    'supercell.com' => 'Supercell', 'clashofclans.com' => 'Supercell',
    'innersloth.com' => 'Among Us', 'dota2.com' => 'Dota 2',
    'nintendo.com' => 'Nintendo',
    // Messaging
    'whatsapp.com' => 'WhatsApp', 'whatsapp.net' => 'WhatsApp',
    'telegram.org' => 'Telegram', 't.me' => 'Telegram',
    'messenger.com' => 'Messenger',
    'signal.org' => 'Signal',
    'viber.com' => 'Viber',
    'line.me' => 'Line', 'line-scdn.net' => 'Line',
    'wechat.com' => 'WeChat', 'weixin.qq.com' => 'WeChat', 'wx.qq.com' => 'WeChat',
    'skype.com' => 'Skype',
    'slack.com' => 'Slack',
    'teams.microsoft.com' => 'Microsoft Teams', 'teams.live.com' => 'Microsoft Teams',
    'zoom.us' => 'Zoom',
    'discord.com' => 'Discord', 'discordapp.com' => 'Discord', 'discord.gg' => 'Discord',
    'kakaotalk.com' => 'KakaoTalk',
    'threema.ch' => 'Threema',
    'imo.im' => 'Imo',
    // Ads & Tracking
    'doubleclick.net' => 'Google Ads', 'googlesyndication.com' => 'Google Ads', 'googleadservices.com' => 'Google Ads',
    'googletagmanager.com' => 'Google Ads', 'googletagservices.com' => 'Google Ads', 'google-analytics.com' => 'Google Analytics',
    '2mdn.net' => 'Google Ads', 'imasdk.googleapis.com' => 'YouTube Ads', 'ads.youtube.com' => 'YouTube Ads',
    'admob.com' => 'AdMob', 'app-measurement.com' => 'Firebase Analytics', 'crashlytics.com' => 'Crashlytics',
    'ads.facebook.com' => 'Facebook Ads', 'an.facebook.com' => 'Facebook Ads', 'pixel.facebook.com' => 'Facebook Pixel',
    'tr.facebook.com' => 'Facebook Pixel', 'ads.instagram.com' => 'Instagram Ads',
    'ads.tiktok.com' => 'TikTok Ads', 'analytics.tiktok.com' => 'TikTok Ads',
    'criteo.com' => 'Criteo', 'taboola.com' => 'Taboola', 'outbrain.com' => 'Outbrain',
    'amazon-adsystem.com' => 'Amazon Ads', 'media.net' => 'Media.net', 'adnxs.com' => 'AppNexus',
    'rubiconproject.com' => 'Rubicon', 'pubmatic.com' => 'PubMatic', 'openx.net' => 'OpenX',
    'adsrvr.org' => 'The Trade Desk', 'scorecardresearch.com' => 'Scorecard', 'quantserve.com' => 'Quantcast',
    'moat.com' => 'Moat', 'appsflyer.com' => 'AppsFlyer', 'adjust.com' => 'Adjust', 'branch.io' => 'Branch',
    'mixpanel.com' => 'Mixpanel', 'amplitude.com' => 'Amplitude', 'segment.io' => 'Segment',
    'hotjar.com' => 'Hotjar', 'fullstory.com' => 'FullStory', 'clarity.ms' => 'Microsoft Clarity',
    'sentry.io' => 'Sentry', 'newrelic.com' => 'New Relic', 'bugsnag.com' => 'Bugsnag',
    'chartboost.com' => 'Chartboost', 'vungle.com' => 'Vungle', 'unity3d.com' => 'Unity Ads', 'adcolony.com' => 'AdColony',
];

// Helper to resolve a domain to its brand group name
function get_brand($domain) {
    global $brand_map;
    if (isset($brand_map[$domain])) return $brand_map[$domain];
    $parts = explode('.', $domain);
    if (count($parts) >= 2) {
        $root = $parts[count($parts)-2] . '.' . $parts[count($parts)-1];
        if (isset($brand_map[$root])) return $brand_map[$root];
    }
    return preg_replace('/^(www\.|m\.|web\.|old\.|i\.|v\.|open\.|store\.|static\.|api\.|graph\.|mobile\.|abs\.|pbs\.|sc-|p16-|v16-)/', '', $domain);
}

switch ($method) {
    case 'GET':
        $result = [];
        foreach ($categories as $key => $cat) {
            $enabled = get_setting("block_$key") === '1';
            
            // Group domains by brand name
            $groups = [];
            foreach ($cat['domains'] as $d) {
                $brand = get_brand($d);
                
                if (!isset($groups[$brand])) {
                    $groups[$brand] = [
                        'display' => $brand,
                        'domains' => [],
                        'blocked' => false,
                    ];
                }
                $groups[$brand]['domains'][] = $d;
                if (isset($blocked_lookup[$d])) {
                    $groups[$brand]['blocked'] = true;
                }
            }
            
            // Build domain list with per-domain blocked status
            $domain_list = [];
            foreach ($groups as $brand => $group) {
                $domain_list[] = [
                    'display' => $group['display'],
                    'domains' => $group['domains'],
                    'blocked' => $group['blocked'],
                ];
            }
            
            // Sort: blocked first, then alphabetically
            usort($domain_list, function($a, $b) {
                if ($a['blocked'] !== $b['blocked']) return $b['blocked'] ? 1 : -1;
                return strcasecmp($a['display'], $b['display']);
            });
            
            $blocked_count = count(array_filter($domain_list, fn($d) => $d['blocked']));
            
            // Count 24h DNS queries for this category's domains
            $cat_hits_24h = 0;
            if (!empty($cat['domains'])) {
                $escaped_domains = array_map(fn($d) => "'" . $conn->real_escape_string($d) . "'", $cat['domains']);
                $in_domains = implode(',', $escaped_domains);
                $hr = $conn->query("SELECT COUNT(*) as cnt FROM query_log WHERE logged_at >= NOW() - INTERVAL 24 HOUR AND domain IN ($in_domains)");
                $cat_hits_24h = (int)($hr ? $hr->fetch_assoc()['cnt'] : 0);
            }

            $result[] = [
                'key' => $key,
                'label' => $cat['label'],
                'description' => $cat['description'],
                'enabled' => $enabled,
                'domain_count' => count($cat['domains']),
                'domains' => $domain_list,
                'blocked_count' => $blocked_count,
                'total_groups' => count($domain_list),
                'hits_24h' => $cat_hits_24h,
            ];
        }
        json_response($result);
        break;
    
    case 'PUT':
        $data = get_json_body();
        $key = $data['key'] ?? '';
        $enabled = $data['enabled'] ?? false;
        
        if (!isset($categories[$key])) {
            json_error('Invalid category');
        }
        
        // Update global setting — DNS proxy reads this for default blocking
        set_setting("block_$key", $enabled ? '1' : '0');
        
        $cat = $categories[$key];
        
        // Trigger DNS proxy reload (proxy handles category blocking per-peer)
        shell_exec("sudo pkill -HUP -f dns_proxy.py 2>/dev/null");
        
        json_response([
            'key' => $key,
            'enabled' => $enabled,
            'message' => $cat['label'] . ($enabled ? ' blocked' : ' unblocked'),
        ]);
        break;
    
    case 'PATCH':
        // Toggle individual domain within a category (per-brand)
        // Note: With DNS proxy architecture, this updates the global setting.
        // Per-peer granularity is handled by /peer-blocking endpoints.
        $data = get_json_body();
        $key = $data['key'] ?? '';
        $display_domain = $data['domain'] ?? '';
        $blocked = $data['blocked'] ?? false;
        
        if (!isset($categories[$key])) {
            json_error('Invalid category');
        }
        
        $cat = $categories[$key];
        
        // Find matching brand domains
        $target_domains = [];
        foreach ($cat['domains'] as $d) {
            if (get_brand($d) === $display_domain) {
                $target_domains[] = $d;
            }
        }
        
        if (empty($target_domains)) {
            json_error('Domain not found in category');
        }
        
        // Track in custom_blacklist for per-brand state (UI reference only)
        $comment = "Category: {$cat['label']}";
        if ($blocked) {
            $stmt = $conn->prepare("INSERT IGNORE INTO custom_blacklist (domain, comment) VALUES (?, ?)");
            foreach ($target_domains as $domain) {
                $stmt->bind_param('ss', $domain, $comment);
                $stmt->execute();
            }
        } else {
            $stmt = $conn->prepare("DELETE FROM custom_blacklist WHERE domain = ? AND comment = ?");
            foreach ($target_domains as $domain) {
                $stmt->bind_param('ss', $domain, $comment);
                $stmt->execute();
            }
        }
        
        // Update category setting based on whether any brands are still blocked
        $still_blocked = false;
        foreach ($cat['domains'] as $d) {
            $chk = $conn->prepare("SELECT 1 FROM custom_blacklist WHERE domain = ?");
            $chk->bind_param('s', $d);
            $chk->execute();
            if ($chk->get_result()->fetch_assoc()) {
                $still_blocked = true;
                break;
            }
        }
        set_setting("block_$key", $still_blocked ? '1' : '0');
        
        // Trigger DNS proxy reload
        shell_exec("sudo pkill -HUP -f dns_proxy.py 2>/dev/null");
        
        json_response([
            'key' => $key,
            'domain' => $display_domain,
            'blocked' => $blocked,
            'domains_affected' => count($target_domains),
            'message' => $display_domain . ($blocked ? ' blocked' : ' allowed'),
        ]);
        break;
    
    default:
        json_error('Method not allowed', 405);
}
