<?php

namespace App\Services;

use App\Models\LinkPreview;

class LinkPreviewService
{
    public static function generate($message)
    {
        preg_match('/(https?:\/\/[^\s]+)/', $message->message, $matches);

        if (!$matches) {
            return;
        }

        $url = $matches[0];

        try {

            $html = @file_get_contents($url);

            if(!$html){
                return;
            }

            preg_match('/<title>(.*?)<\/title>/i', $html, $title);

            preg_match('/<meta property="og:image" content="(.*?)"/i', $html, $image);

            preg_match('/<meta name="description" content="(.*?)"/i', $html, $desc);

            $domain = parse_url($url, PHP_URL_HOST);

            LinkPreview::create([
                'message_id' => $message->id,
                'url' => $url,
                'title' => $title[1] ?? null,
                'description' => $desc[1] ?? null,
                'image' => $image[1] ?? null,
                'domain' => $domain
            ]);

        } catch (\Throwable $e) {
            return;
        }
    }
}