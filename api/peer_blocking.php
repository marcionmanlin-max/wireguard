<?php
/**
 * IonMan DNS - Per-Peer Category Blocking API
 *
 * GET    /peer-blocking                     — List all peers with their category rules
 * GET    /peer-blocking/categories          — List available categories
 * GET    /peer-blocking/{peer_id}           — Get categories for a specific peer
 * PUT    /peer-blocking/{peer_id}           — Set categories for a specific peer
 * POST   /peer-blocking/bulk               — Set categories for multiple peers
 * GET    /peer-blocking/groups              — List groups
 * POST   /peer-blocking/groups              — Create group
 * PUT    /peer-blocking/groups/{id}         — Update group (name, categories)
 * DELETE /peer-blocking/groups/{id}         — Delete group
 * POST   /peer-blocking/groups/{id}/members — Set group members
 */

$conn = db();

// Load categories from JSON
$categories_file = dirname(__DIR__) . '/config/categories.json';
$categories_data = json_decode(file_get_contents($categories_file), true) ?: [];

// Available category keys and labels
$cat_meta = [];
foreach ($categories_data as $key => $info) {
    $cat_meta[$key] = [
        'key' => $key,
        'label' => $info['label'] ?? $key,
        'icon' => $info['icon'] ?? 'Shield',
        'domain_count' => count($info['domains'] ?? []),
    ];
}

// Brand grouping map (same as categories.php)
$brand_map = [
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
    'threads.net' => 'Threads', 'whatsapp.com' => 'WhatsApp',
    'telegram.org' => 'Telegram', 't.me' => 'Telegram',
    'discord.com' => 'Discord', 'discordapp.com' => 'Discord', 'discord.gg' => 'Discord',
    'viber.com' => 'Viber', 'tumblr.com' => 'Tumblr',
    'mastodon.social' => 'Mastodon', 'mastodon.online' => 'Mastodon',
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
    'tv.apple.com' => 'Apple TV+', 'apple.com/apple-tv-plus' => 'Apple TV+',
    'atv-ps.amazon.com' => 'Prime Video',
    'assetshuluimcom-a.akamaihd.net' => 'Hulu',
    'cdn.registerdisney.go.com' => 'Disney+',
    'music.apple.com' => 'Apple Music', 'itunes.apple.com' => 'Apple Music',
    'music.amazon.com' => 'Amazon Music',
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

// Helper: get per-peer blocklist rules (domain-level)
function get_peer_domain_rules($conn, $peer_id) {
    $stmt = $conn->prepare("SELECT rule_key, enabled FROM client_blocking_rules WHERE target_type = 'peer' AND target_id = ? AND rule_type = 'blocklist'");
    $stmt->bind_param('i', $peer_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $rules = [];
    while ($row = $result->fetch_assoc()) {
        $rules[$row['rule_key']] = (bool)$row['enabled'];
    }
    return $rules;
}

// Helper: group category domains by brand with per-peer blocked status
function get_brand_grouped_domains($category_key, $categories_data, $peer_domain_rules) {
    if (!isset($categories_data[$category_key])) return [];
    $domains = $categories_data[$category_key]['domains'] ?? [];
    $groups = [];
    foreach ($domains as $d) {
        $brand = get_brand($d);
        if (!isset($groups[$brand])) {
            $groups[$brand] = ['display' => $brand, 'domains' => [], 'blocked' => false];
        }
        $groups[$brand]['domains'][] = $d;
        // Brand is blocked if ANY of its domains have a blocklist rule
        if (!empty($peer_domain_rules[$d])) {
            $groups[$brand]['blocked'] = true;
        }
    }
    $result = array_values($groups);
    usort($result, function($a, $b) {
        if ($a['blocked'] !== $b['blocked']) return $b['blocked'] ? 1 : -1;
        return strcasecmp($a['display'], $b['display']);
    });
    return $result;
}

// Helper: get per-peer rules
function get_peer_rules($conn, $peer_id = null) {
    $sql = "SELECT target_id, rule_key, enabled FROM client_blocking_rules WHERE target_type = 'peer' AND rule_type = 'category'";
    if ($peer_id) {
        $stmt = $conn->prepare($sql . " AND target_id = ?");
        $stmt->bind_param('i', $peer_id);
        $stmt->execute();
        $result = $stmt->get_result();
    } else {
        $result = $conn->query($sql);
    }
    $rules = [];
    while ($row = $result->fetch_assoc()) {
        $rules[$row['target_id']][$row['rule_key']] = (bool)$row['enabled'];
    }
    return $rules;
}

// Helper: get global defaults
function get_global_category_defaults($conn, $categories_data) {
    $defaults = [];
    foreach (array_keys($categories_data) as $key) {
        $stmt = $conn->prepare("SELECT setting_value FROM settings WHERE setting_key = ?");
        $setting_key = "block_$key";
        $stmt->bind_param('s', $setting_key);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $defaults[$key] = $row && $row['setting_value'] === '1';
    }
    return $defaults;
}

// Helper: trigger proxy reload (send SIGHUP or just wait for auto-reload)
function trigger_proxy_reload() {
    // The proxy auto-reloads every 30s, but we can force an immediate reload
    shell_exec("sudo pkill -HUP -f dns_proxy.py 2>/dev/null");
}

switch ($method) {
    case 'GET':
        // GET /peer-blocking/categories — list available categories
        if ($id === 'categories') {
            $defaults = get_global_category_defaults($conn, $categories_data);
            $result = [];
            foreach ($cat_meta as $key => $meta) {
                $meta['global_enabled'] = $defaults[$key] ?? false;
                $result[] = $meta;
            }
            json_response($result);
        }

        // GET /peer-blocking/groups — list groups
        if ($id === 'groups') {
            $groups = [];
            $res = $conn->query("SELECT * FROM client_groups ORDER BY name");
            while ($row = $res->fetch_assoc()) {
                // Get members
                $stmt = $conn->prepare("SELECT peer_id FROM client_group_members WHERE group_id = ?");
                $stmt->bind_param('i', $row['id']);
                $stmt->execute();
                $members = [];
                $mem_res = $stmt->get_result();
                while ($m = $mem_res->fetch_assoc()) $members[] = (int)$m['peer_id'];

                // Get group rules
                $stmt2 = $conn->prepare("SELECT rule_key, enabled FROM client_blocking_rules WHERE target_type = 'group' AND target_id = ? AND rule_type = 'category'");
                $stmt2->bind_param('i', $row['id']);
                $stmt2->execute();
                $rules = [];
                $rule_res = $stmt2->get_result();
                while ($r = $rule_res->fetch_assoc()) $rules[$r['rule_key']] = (bool)$r['enabled'];

                $groups[] = [
                    'id' => (int)$row['id'],
                    'name' => $row['name'],
                    'description' => $row['description'],
                    'members' => $members,
                    'categories' => $rules,
                ];
            }
            json_response($groups);
        }

        // GET /peer-blocking/{peer_id}/domains/{category_key} — brand-grouped domains for a category
        if ($id && is_numeric($id) && $action === 'domains') {
            $peer_id = (int)$id;
            $category_key = $segments[3] ?? null;
            if (!$category_key || !isset($cat_meta[$category_key])) {
                json_error('Invalid category key', 400);
            }
            $peer_domain_rules = get_peer_domain_rules($conn, $peer_id);
            $brands = get_brand_grouped_domains($category_key, $categories_data, $peer_domain_rules);
            $blocked_count = count(array_filter($brands, fn($b) => $b['blocked']));
            json_response([
                'category' => $cat_meta[$category_key],
                'brands' => $brands,
                'blocked_count' => $blocked_count,
                'total_brands' => count($brands),
            ]);
        }

        // GET /peer-blocking/{peer_id} — specific peer rules
        if ($id && is_numeric($id)) {
            $peer_id = (int)$id;
            $stmt = $conn->prepare("SELECT id, name, allowed_ips FROM wg_peers WHERE id = ?");
            $stmt->bind_param('i', $peer_id);
            $stmt->execute();
            $peer = $stmt->get_result()->fetch_assoc();
            if (!$peer) json_error('Peer not found', 404);

            $rules = get_peer_rules($conn, $peer_id);
            $peer_cats = $rules[$peer_id] ?? [];
            $defaults = get_global_category_defaults($conn, $categories_data);

            // Get group rules for this peer
            $group_rules = [];
            $stmt = $conn->prepare("
                SELECT cbr.rule_key, cbr.enabled, cg.name as group_name
                FROM client_group_members cgm
                JOIN client_blocking_rules cbr ON cbr.target_id = cgm.group_id AND cbr.target_type = 'group'
                JOIN client_groups cg ON cg.id = cgm.group_id
                WHERE cgm.peer_id = ? AND cbr.rule_type = 'category'
            ");
            $stmt->bind_param('i', $peer_id);
            $stmt->execute();
            $gres = $stmt->get_result();
            while ($r = $gres->fetch_assoc()) {
                $group_rules[$r['rule_key']] = [
                    'enabled' => (bool)$r['enabled'],
                    'from_group' => $r['group_name'],
                ];
            }

            // Get per-peer domain-level (blocklist) rules for brand counts
            $peer_domain_rules = get_peer_domain_rules($conn, $peer_id);

            $categories = [];
            foreach ($cat_meta as $key => $meta) {
                $effective = $defaults[$key] ?? false;
                $source = 'global';

                if (isset($group_rules[$key])) {
                    $effective = $group_rules[$key]['enabled'];
                    $source = 'group:' . $group_rules[$key]['from_group'];
                }
                if (isset($peer_cats[$key])) {
                    $effective = $peer_cats[$key];
                    $source = 'peer';
                }

                // Count blocked brands in this category for this peer
                $brands = get_brand_grouped_domains($key, $categories_data, $peer_domain_rules);
                $blocked_brands = count(array_filter($brands, fn($b) => $b['blocked']));

                $categories[$key] = [
                    'key' => $key,
                    'label' => $meta['label'],
                    'icon' => $meta['icon'],
                    'enabled' => $effective,
                    'source' => $source,
                    'has_override' => isset($peer_cats[$key]),
                    'domain_count' => $meta['domain_count'],
                    'blocked_brands' => $blocked_brands,
                    'total_brands' => count($brands),
                ];
            }

            json_response([
                'peer' => $peer,
                'categories' => $categories,
                'global_defaults' => $defaults,
            ]);
        }

        // GET /peer-blocking — all peers with rules summary
        $peers = [];
        $res = $conn->query("SELECT id, name, allowed_ips, enabled FROM wg_peers ORDER BY name");
        while ($row = $res->fetch_assoc()) $peers[] = $row;

        $all_rules = get_peer_rules($conn);
        $defaults = get_global_category_defaults($conn, $categories_data);

        $result = [];
        foreach ($peers as $peer) {
            $custom = $all_rules[$peer['id']] ?? [];
            $blocked_cats = [];
            $has_custom = !empty($custom);

            foreach (array_keys($cat_meta) as $key) {
                $effective = isset($custom[$key]) ? $custom[$key] : ($defaults[$key] ?? false);
                if ($effective) $blocked_cats[] = $key;
            }

            $result[] = [
                'id' => (int)$peer['id'],
                'name' => $peer['name'],
                'allowed_ips' => $peer['allowed_ips'],
                'enabled' => (bool)$peer['enabled'],
                'has_custom_rules' => $has_custom,
                'blocked_categories' => $blocked_cats,
                'custom_rules' => $custom,
            ];
        }

        json_response([
            'peers' => $result,
            'categories' => array_values($cat_meta),
            'global_defaults' => $defaults,
        ]);
        break;

    case 'PUT':
        // PUT /peer-blocking/groups/{id} — update group
        if ($id === 'groups' && $action) {
            $group_id = (int)$action;
            $data = get_json_body();

            if (isset($data['name'])) {
                $stmt = $conn->prepare("UPDATE client_groups SET name = ?, description = ? WHERE id = ?");
                $desc = $data['description'] ?? '';
                $stmt->bind_param('ssi', $data['name'], $desc, $group_id);
                $stmt->execute();
            }

            if (isset($data['categories'])) {
                // Delete old rules, insert new
                $stmt = $conn->prepare("DELETE FROM client_blocking_rules WHERE target_type = 'group' AND target_id = ? AND rule_type = 'category'");
                $stmt->bind_param('i', $group_id);
                $stmt->execute();

                $stmt = $conn->prepare("INSERT INTO client_blocking_rules (target_type, target_id, rule_type, rule_key, enabled) VALUES ('group', ?, 'category', ?, ?)");
                foreach ($data['categories'] as $cat_key => $enabled) {
                    $en = $enabled ? 1 : 0;
                    $stmt->bind_param('isi', $group_id, $cat_key, $en);
                    $stmt->execute();
                }
            }

            trigger_proxy_reload();
            json_response(['message' => 'Group updated']);
        }

        // PUT /peer-blocking/{peer_id} — set per-peer categories
        if ($id && is_numeric($id)) {
            $peer_id = (int)$id;
            $data = get_json_body();

            if (!isset($data['categories']) || !is_array($data['categories'])) {
                json_error('categories object required');
            }

            // Delete existing peer rules
            $stmt = $conn->prepare("DELETE FROM client_blocking_rules WHERE target_type = 'peer' AND target_id = ? AND rule_type = 'category'");
            $stmt->bind_param('i', $peer_id);
            $stmt->execute();

            // Insert new rules (only store overrides, not defaults)
            $stmt = $conn->prepare("INSERT INTO client_blocking_rules (target_type, target_id, rule_type, rule_key, enabled) VALUES ('peer', ?, 'category', ?, ?)");
            foreach ($data['categories'] as $cat_key => $enabled) {
                if (!isset($cat_meta[$cat_key])) continue;
                $en = $enabled ? 1 : 0;
                $stmt->bind_param('isi', $peer_id, $cat_key, $en);
                $stmt->execute();
            }

            trigger_proxy_reload();
            json_response(['message' => 'Peer blocking rules updated']);
        }

        json_error('Invalid request');
        break;

    case 'POST':
        // POST /peer-blocking/bulk — set categories for multiple peers
        if ($id === 'bulk') {
            $data = get_json_body();
            $peer_ids = $data['peer_ids'] ?? [];
            $categories = $data['categories'] ?? [];

            if (empty($peer_ids) || empty($categories)) {
                json_error('peer_ids and categories required');
            }

            foreach ($peer_ids as $pid) {
                $pid = (int)$pid;
                $stmt = $conn->prepare("DELETE FROM client_blocking_rules WHERE target_type = 'peer' AND target_id = ? AND rule_type = 'category'");
                $stmt->bind_param('i', $pid);
                $stmt->execute();

                $stmt2 = $conn->prepare("INSERT INTO client_blocking_rules (target_type, target_id, rule_type, rule_key, enabled) VALUES ('peer', ?, 'category', ?, ?)");
                foreach ($categories as $cat_key => $enabled) {
                    if (!isset($cat_meta[$cat_key])) continue;
                    $en = $enabled ? 1 : 0;
                    $stmt2->bind_param('isi', $pid, $cat_key, $en);
                    $stmt2->execute();
                }
            }

            trigger_proxy_reload();
            json_response(['message' => 'Bulk rules applied to ' . count($peer_ids) . ' peers']);
        }

        // POST /peer-blocking/groups — create group
        if ($id === 'groups' && !$action) {
            $data = get_json_body();
            if (empty($data['name'])) json_error('Group name required');

            $stmt = $conn->prepare("INSERT INTO client_groups (name, description) VALUES (?, ?)");
            $desc = $data['description'] ?? '';
            $stmt->bind_param('ss', $data['name'], $desc);
            $stmt->execute();
            $group_id = $conn->insert_id;

            json_response(['message' => 'Group created', 'id' => $group_id], 201);
        }

        // POST /peer-blocking/groups/{id}/members — set group members
        if ($id === 'groups' && $action && isset($segments[3]) && $segments[3] === 'members') {
            $group_id = (int)$action;
            $data = get_json_body();
            $peer_ids = $data['peer_ids'] ?? [];

            $stmt = $conn->prepare("DELETE FROM client_group_members WHERE group_id = ?");
            $stmt->bind_param('i', $group_id);
            $stmt->execute();

            $stmt = $conn->prepare("INSERT INTO client_group_members (group_id, peer_id) VALUES (?, ?)");
            foreach ($peer_ids as $pid) {
                $pid = (int)$pid;
                $stmt->bind_param('ii', $group_id, $pid);
                $stmt->execute();
            }

            trigger_proxy_reload();
            json_response(['message' => 'Group members updated']);
        }

        // POST /peer-blocking/{peer_id}/reset — remove per-peer overrides
        if ($id && is_numeric($id) && $action === 'reset') {
            $peer_id = (int)$id;
            $stmt = $conn->prepare("DELETE FROM client_blocking_rules WHERE target_type = 'peer' AND target_id = ? AND rule_type = 'category'");
            $stmt->bind_param('i', $peer_id);
            $stmt->execute();

            trigger_proxy_reload();
            json_response(['message' => 'Peer rules reset to global defaults']);
        }

        json_error('Invalid request');
        break;

    case 'PATCH':
        // PATCH /peer-blocking/{peer_id}/domains — toggle a brand for a peer
        if ($id && is_numeric($id) && $action === 'domains') {
            $peer_id = (int)$id;
            $data = get_json_body();
            $category_key = $data['category'] ?? null;
            $brand_display = $data['brand'] ?? null;
            $blocked = $data['blocked'] ?? null;

            if (!$category_key || !$brand_display || $blocked === null) {
                json_error('category, brand, and blocked required');
            }
            if (!isset($categories_data[$category_key])) {
                json_error('Invalid category');
            }

            // Find all domains for this brand in this category
            $cat_domains = $categories_data[$category_key]['domains'] ?? [];
            $brand_domains = [];
            foreach ($cat_domains as $d) {
                if (get_brand($d) === $brand_display) {
                    $brand_domains[] = $d;
                }
            }

            if (empty($brand_domains)) {
                json_error('No domains found for this brand');
            }

            if ($blocked) {
                // Add blocklist rules for all brand domains
                $stmt = $conn->prepare("INSERT INTO client_blocking_rules (target_type, target_id, rule_type, rule_key, enabled) VALUES ('peer', ?, 'blocklist', ?, 1) ON DUPLICATE KEY UPDATE enabled = 1");
                foreach ($brand_domains as $d) {
                    $stmt->bind_param('is', $peer_id, $d);
                    $stmt->execute();
                }
            } else {
                // Remove blocklist rules for all brand domains
                $stmt = $conn->prepare("DELETE FROM client_blocking_rules WHERE target_type = 'peer' AND target_id = ? AND rule_type = 'blocklist' AND rule_key = ?");
                foreach ($brand_domains as $d) {
                    $stmt->bind_param('is', $peer_id, $d);
                    $stmt->execute();
                }
            }

            trigger_proxy_reload();
            json_response(['message' => "Brand '$brand_display' " . ($blocked ? 'blocked' : 'allowed') . " for peer", 'domains_affected' => count($brand_domains)]);
        }

        json_error('Invalid request');
        break;

    case 'DELETE':
        // DELETE /peer-blocking/groups/{id}
        if ($id === 'groups' && $action) {
            $group_id = (int)$action;
            $conn->query("DELETE FROM client_group_members WHERE group_id = $group_id");
            $conn->query("DELETE FROM client_blocking_rules WHERE target_type = 'group' AND target_id = $group_id");
            $stmt = $conn->prepare("DELETE FROM client_groups WHERE id = ?");
            $stmt->bind_param('i', $group_id);
            $stmt->execute();

            trigger_proxy_reload();
            json_response(['message' => 'Group deleted']);
        }

        json_error('Invalid request');
        break;

    default:
        json_error('Method not allowed', 405);
}
